import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, paginatedResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { CARD_METHODS, CHARGED_PAYMENT_STATUSES, DIRECT_PAYMENT_SOURCES, PAYOUT_TYPE_CLINIC } from '../shared/constants';

function normalizePaymentStatus(status?: string | null, paidAt?: Date | null): 'pending' | 'paid' {
  if (paidAt) return 'paid';
  return status && CHARGED_PAYMENT_STATUSES.includes(status) ? 'paid' : 'pending';
}

/**
 * GET /api/admin/payments/doctors
 * Obtener pagos pendientes a médicos independientes
 */
export async function getDoctorPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] GET /api/admin/payments/doctors - Obteniendo pagos a médicos');
  
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const where = {
      payment_source: { in: DIRECT_PAYMENT_SOURCES },
      payment_method: { in: CARD_METHODS },
      clinic_id: null,
      appointments: {
        clinic_id: null,
      },
      OR: [
        { paid_at: { not: null } },
        { status: { in: CHARGED_PAYMENT_STATUSES } },
      ],
    };

    const [payments, total] = await Promise.all([
      prisma.payments.findMany({
        where,
        include: {
          appointments: {
            include: {
              patients: {
                select: {
                  id: true,
                  users: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
              providers: {
                select: {
                  id: true,
                  commercial_name: true,
                  user_id: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.payments.count({ where }),
    ]);

    // Fetch doctor bank accounts
    const doctorUserIds = payments
      .map((p) => p.appointments?.providers?.user_id)
      .filter((id): id is string => !!id);

    const bankAccounts = doctorUserIds.length > 0
      ? await prisma.doctor_bank_accounts.findMany({
          where: { user_id: { in: doctorUserIds } },
        })
      : [];
    const bankAccountMap = new Map(bankAccounts.map((b) => [b.user_id, b]));

    // Mapear a formato del frontend
    const mappedPayments = payments.map((payment) => {
      const docUser = payment.appointments?.providers?.user_id;
      const bank = docUser ? bankAccountMap.get(docUser) : null;

      return {
        id: payment.id,
        appointmentId: payment.appointment_id,
        patientName: payment.appointments?.patients?.users?.email || 'Paciente',
        date: payment.appointments?.scheduled_for?.toISOString() || payment.created_at?.toISOString(),
        amount: Number(payment.amount_total || 0),
        commission: Number(payment.platform_fee || 0),
        netAmount: Number(payment.provider_amount || 0),
        status: normalizePaymentStatus(payment.status, payment.paid_at),
        paymentMethod: payment.payment_method || 'card',
        createdAt: payment.created_at?.toISOString(),
        source: 'admin',
        providerId: payment.appointments?.provider_id,
        providerName: payment.appointments?.providers?.commercial_name,
        doctorBankAccount: bank ? {
          bankName: bank.bank_name,
          accountNumber: bank.account_number,
          accountType: bank.account_type,
          accountHolder: bank.account_holder,
          identificationNumber: bank.identification_number || undefined,
          email: bank.email || undefined,
        } : undefined,
      };
    });

    console.log(`✅ [ADMIN] ${mappedPayments.length} pagos a médicos obtenidos (página ${page}, total: ${total})`);
    return paginatedResponse(mappedPayments, total, page, limit);
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al obtener pagos a médicos:', error.message);
    logger.error('Error getting doctor payments', error);
    return internalErrorResponse('Failed to get doctor payments');
  }
}

/**
 * GET /api/admin/payments/clinics
 * Obtener pagos pendientes a clínicas
 */
export async function getClinicPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] GET /api/admin/payments/clinics - Obteniendo pagos a clínicas');
  
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const where = {
      payout_type: PAYOUT_TYPE_CLINIC,
      status: 'pending',
    };

    const [payouts, total] = await Promise.all([
      prisma.payouts.findMany({
        where,
        include: {
          payments: {
            include: {
              appointments: {
                include: {
                  patients: {
                    select: {
                      users: {
                        select: {
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          clinic_payment_distributions: true,
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.payouts.count({ where }),
    ]);

    // Obtener clínicas para mapear nombres y cuentas bancarias
    const clinicIds = payouts.map(p => p.provider_id).filter((id): id is string => id !== null);
    const clinics = await prisma.clinics.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true, bank_account: true },
    });
    
    const clinicMap = new Map(clinics.map(c => [c.id, { name: c.name, bankAccount: c.bank_account }]));

    // Mapear a formato del frontend
    const mappedPayouts = payouts.map((payout) => {
      const clinicData = payout.provider_id ? clinicMap.get(payout.provider_id) : null;
      const clinicName = clinicData?.name || 'Clínica';
      const clinicBankAccount = clinicData?.bankAccount || null;
      const totalAmount = payout.payments.reduce((sum: number, p) => sum + Number(p.amount_total || 0), 0);
      const appCommission = payout.payments.reduce((sum: number, p) => sum + Number(p.platform_fee || 0), 0);
      const distributedAmount = payout.clinic_payment_distributions?.reduce(
        (sum: number, d) => sum + Number(d.amount), 
        0
      ) || 0;

      return {
        id: payout.id,
        clinicId: payout.provider_id,
        clinicName,
        totalAmount,
        appCommission,
        netAmount: Number(payout.total_amount || 0),
        status: payout.status || 'pending',
        paymentDate: payout.paid_at?.toISOString() || null,
        createdAt: payout.created_at?.toISOString(),
        appointments: payout.payments.map((p) => ({
          id: p.appointment_id,
          doctorId: p.appointments?.provider_id,
          doctorName: 'Doctor', // TODO: Obtener nombre del médico
          patientName: p.appointments?.patients?.users?.email || 'Paciente',
          amount: Number(p.amount_total || 0),
          date: p.appointments?.scheduled_for?.toISOString() || p.created_at?.toISOString(),
        })),
        isDistributed: distributedAmount > 0,
        distributedAmount,
        remainingAmount: Number(payout.total_amount || 0) - distributedAmount,
        clinicBankAccount: clinicBankAccount ? {
          bankName: (clinicBankAccount as any).bankName,
          accountNumber: (clinicBankAccount as any).accountNumber,
          accountType: (clinicBankAccount as any).accountType,
          accountHolder: (clinicBankAccount as any).accountHolder,
          identificationNumber: (clinicBankAccount as any).identificationNumber || undefined,
          email: (clinicBankAccount as any).email || undefined,
        } : null,
      };
    });

    console.log(`✅ [ADMIN] ${mappedPayouts.length} pagos a clínicas obtenidos (página ${page}, total: ${total})`);
    return paginatedResponse(mappedPayouts, total, page, limit);
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al obtener pagos a clínicas:', error.message);
    logger.error('Error getting clinic payments', error);
    return internalErrorResponse('Failed to get clinic payments');
  }
}

/**
 * POST /api/admin/payments/doctors/:doctorId/mark-paid
 * Marcar pagos a médico como pagados
 */
export async function markDoctorPaymentsPaid(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] POST /api/admin/payments/doctors/:doctorId/mark-paid');
  
  const prisma = getPrismaClient();

  try {
    const body = JSON.parse(event.body || '{}');
    const { paymentIds } = body;

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return errorResponse('paymentIds es requerido y debe ser un array', 400);
    }

    // Actualizar payments a 'paid'
    const result = await prisma.payments.updateMany({
      where: {
        id: { in: paymentIds },
        status: 'pending',
      },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    // Calcular total pagado
    const paidPayments = await prisma.payments.findMany({
      where: { id: { in: paymentIds } },
      select: { provider_amount: true },
    });

    const totalAmount = paidPayments.reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);

    console.log(`✅ [ADMIN] ${result.count} pagos marcados como pagados`);
    return successResponse({
      paidCount: result.count,
      totalAmount,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al marcar pagos como pagados:', error.message);
    logger.error('Error marking doctor payments as paid', error);
    return internalErrorResponse('Failed to mark payments as paid');
  }
}

/**
 * POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid
 * Marcar pago a clínica como pagado
 */
export async function markClinicPaymentPaid(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid');
  
  const prisma = getPrismaClient();

  try {
    const pathParts = event.requestContext.http.path.split('/');
    const clinicPaymentId = pathParts[pathParts.length - 2];

    if (!clinicPaymentId) {
      return errorResponse('clinicPaymentId es requerido', 400);
    }

    // Actualizar payout a 'paid'
    const payout = await prisma.payouts.update({
      where: { id: clinicPaymentId },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    // Actualizar payments relacionados
    await prisma.payments.updateMany({
      where: { payout_id: clinicPaymentId },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    console.log(`✅ [ADMIN] Pago a clínica ${clinicPaymentId} marcado como pagado`);
    return successResponse({
      id: payout.id,
      status: payout.status,
      paymentDate: payout.paid_at?.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al marcar pago a clínica como pagado:', error.message);
    logger.error('Error marking clinic payment as paid', error);
    return internalErrorResponse('Failed to mark clinic payment as paid');
  }
}

/**
 * GET /api/admin/payments/history
 * Obtener historial de pagos realizados
 */
export async function getPaymentHistory(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] GET /api/admin/payments/history - Obteniendo historial');
  
  const prisma = getPrismaClient();

  try {
    // Historial contable: incluir cobros directos admin + PayPhone.
    // Este endpoint retorna datos agregados, no una tabla paginada individual.
    // Se mantiene sin paginación de lista porque combina dos fuentes (doctors + clinics).
    const doctorWhere = {
      payment_source: { in: DIRECT_PAYMENT_SOURCES },
      OR: [
        { paid_at: { not: null } },
        { status: { in: CHARGED_PAYMENT_STATUSES } },
      ],
    };

    const doctorPayments = await prisma.payments.findMany({
      where: doctorWhere,
      include: {
        appointments: {
          include: {
            patients: {
              select: {
                users: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { paid_at: 'desc' },
    });

    // Obtener pagos a clínicas pagados
    const clinicWhere = {
      payout_type: PAYOUT_TYPE_CLINIC,
      status: 'paid',
    };

    const clinicPayments = await prisma.payouts.findMany({
      where: clinicWhere,
      orderBy: { paid_at: 'desc' },
    });

    // Obtener nombres de clínicas
    const clinicIds = clinicPayments.map(p => p.provider_id).filter((id): id is string => id !== null);
    const clinics = await prisma.clinics.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true },
    });
    const clinicMap = new Map(clinics.map(c => [c.id, c.name]));

    const mappedDoctorPayments = doctorPayments.map((p) => ({
      id: p.id,
      patientName: p.appointments?.patients?.users?.email || 'Paciente',
      amount: Number(p.provider_amount || 0),
      paymentDate: p.paid_at?.toISOString(),
      status: normalizePaymentStatus(p.status, p.paid_at),
    }));

    const mappedClinicPayments = clinicPayments.map((p) => ({
      id: p.id,
      clinicName: p.provider_id ? clinicMap.get(p.provider_id) || 'Clínica' : 'Clínica',
      netAmount: Number(p.total_amount || 0),
      paymentDate: p.paid_at?.toISOString(),
      status: p.status,
    }));

    console.log(`✅ [ADMIN] Historial obtenido: ${mappedDoctorPayments.length} médicos, ${mappedClinicPayments.length} clínicas`);
    return successResponse({
      clinicPayments: mappedClinicPayments,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al obtener historial:', error.message);
    logger.error('Error getting payment history', error);
    return internalErrorResponse('Failed to get payment history');
  }
}
