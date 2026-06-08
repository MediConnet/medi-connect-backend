import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, notFoundResponse, paginatedResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { getAuthContext } from '../shared/auth';
import { PAYOUT_TYPE_CLINIC } from '../shared/constants';
import { resolveClinicForAuthUser } from './clinic-context';

/**
 * GET /api/clinics/payments
 * Obtener pagos recibidos del administrador
 */
export async function getClinicPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/payments - Obteniendo pagos recibidos');
  
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    // Obtener contexto de autenticación
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    // Buscar clínica del usuario
    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    const where = {
      provider_id: clinic.id,
      payout_type: PAYOUT_TYPE_CLINIC,
    };

    const total = await prisma.payouts.count({ where });

    // Obtener payouts de la clínica (ligero: sin includes pesados para evitar timeouts)
    const payouts = await prisma.payouts.findMany({
      where,
      select: {
        id: true,
        total_amount: true,
        status: true,
        paid_at: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: offset,
      take: limit,
    });

    const payoutIds = payouts.map((p) => p.id);

    // Agregados de payments por payout (sumas)
    const paymentAgg = payoutIds.length
      ? await prisma.payments.groupBy({
          by: ['payout_id'],
          where: { payout_id: { in: payoutIds } },
          _sum: { amount_total: true, platform_fee: true },
        })
      : [];

    // Agregados de distribuciones por payout
    const distAgg = payoutIds.length
      ? await prisma.clinic_payment_distributions.groupBy({
          by: ['payout_id'],
          where: { payout_id: { in: payoutIds } },
          _sum: { amount: true },
        })
      : [];

    const paymentAggMap = new Map(
      paymentAgg.map((x) => [
        x.payout_id,
        {
          totalAmount: Number(x._sum.amount_total || 0),
          appCommission: Number(x._sum.platform_fee || 0),
        },
      ]),
    );
    const distAggMap = new Map(
      distAgg.map((x) => [x.payout_id, Number(x._sum.amount || 0)]),
    );

    // Mapear a formato del frontend
    const mappedPayouts = payouts.map((payout) => {
      const sums = paymentAggMap.get(payout.id) || { totalAmount: 0, appCommission: 0 };
      const distributedAmount = distAggMap.get(payout.id) || 0;

      return {
        id: payout.id,
        clinicId: clinic.id,
        clinicName: clinic.name,
        totalAmount: sums.totalAmount,
        appCommission: sums.appCommission,
        netAmount: Number(payout.total_amount || 0),
        status: payout.status || 'pending',
        paymentDate: payout.paid_at?.toISOString() || null,
        createdAt: payout.created_at?.toISOString(),
        // Para evitar consultas pesadas, el listado no incluye detalle de citas.
        // El detalle se obtiene desde GET /api/clinics/payments/:id
        appointments: [],
        isDistributed: distributedAmount > 0,
        distributedAmount,
        remainingAmount: Number(payout.total_amount || 0) - distributedAmount,
      };
    });

    console.log(`✅ [CLINICS] ${mappedPayouts.length} pagos obtenidos (total: ${total})`);
    return paginatedResponse(mappedPayouts, total, page, limit);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al obtener pagos:', error.message);
    logger.error('Error getting clinic payments', error);
    return internalErrorResponse('Failed to get clinic payments');
  }
}

/**
 * GET /api/clinics/payments/:id
 * Obtener detalle de un pago específico
 */
export async function getClinicPaymentDetail(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/payments/:id - Obteniendo detalle de pago');
  
  const prisma = getPrismaClient();

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    const pathParts = event.requestContext.http.path.split('/');
    const paymentId = pathParts[pathParts.length - 1];

    // Buscar clínica del usuario
    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Obtener payout
    const payout = await prisma.payouts.findFirst({
      where: {
        id: paymentId,
        provider_id: clinic.id,
      },
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
    });

    if (!payout) {
      return notFoundResponse('Payment not found');
    }

    // Mapear a formato del frontend
    const totalAmount = payout.payments.reduce((sum: number, p) => sum + Number(p.amount_total || 0), 0);
    const appCommission = payout.payments.reduce((sum: number, p) => sum + Number(p.platform_fee || 0), 0);
    const distributedAmount = payout.clinic_payment_distributions?.reduce(
      (sum: number, d) => sum + Number(d.amount), 
      0
    ) || 0;

    const result = {
      id: payout.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
      totalAmount,
      appCommission,
      netAmount: Number(payout.total_amount || 0),
      status: payout.status || 'pending',
      paymentDate: payout.paid_at?.toISOString() || null,
      createdAt: payout.created_at?.toISOString(),
      appointments: payout.payments.map((p) => ({
        id: p.appointment_id,
        doctorId: p.appointments?.provider_id,
        doctorName: 'Doctor',
        patientName: p.appointments?.patients?.users?.email || 'Paciente',
        amount: Number(p.amount_total || 0),
        date: p.appointments?.scheduled_for?.toISOString() || p.created_at?.toISOString(),
      })),
      isDistributed: distributedAmount > 0,
      distributedAmount,
      remainingAmount: Number(payout.total_amount || 0) - distributedAmount,
    };

    console.log(`✅ [CLINICS] Detalle de pago ${paymentId} obtenido`);
    return successResponse(result);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al obtener detalle de pago:', error.message);
    logger.error('Error getting clinic payment detail', error);
    return internalErrorResponse('Failed to get payment detail');
  }
}

/**
 * POST /api/clinics/payments/:id/distribute
 * Distribuir pago entre médicos
 */
export async function distributePayment(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/payments/:id/distribute - Distribuyendo pago');
  
  const prisma = getPrismaClient();

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    const pathParts = event.requestContext.http.path.split('/');
    const paymentId = pathParts[pathParts.indexOf('payments') + 1];

    const body = JSON.parse(event.body || '{}');
    const { distribution } = body;

    if (!distribution || !Array.isArray(distribution)) {
      return errorResponse('distribution es requerido y debe ser un array', 400);
    }

    // Buscar clínica del usuario
    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Obtener payout
    const payout = await prisma.payouts.findFirst({
      where: {
        id: paymentId,
        provider_id: clinic.id,
      },
    });

    if (!payout) {
      return notFoundResponse('Payment not found');
    }

    // Validar que la suma de distribuciones no exceda el monto neto
    const totalDistribution = distribution.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const netAmount = Number(payout.total_amount || 0);

    if (totalDistribution > netAmount) {
      return errorResponse('La suma de distribuciones excede el monto neto recibido', 400);
    }

    // Crear distribuciones
    const distributions = await Promise.all(
      distribution.map(async (d: any) => {
        // Obtener nombre del médico desde provider
        const doctor = await prisma.clinic_doctors.findUnique({
          where: { id: d.doctorId },
          include: {
            users: {
              select: {
                id: true
              }
            }
          }
        });

        let doctorName = 'Doctor';
        if (doctor?.user_id) {
          const provider = await prisma.providers.findFirst({
            where: { user_id: doctor.user_id },
            select: { commercial_name: true }
          });
          doctorName = provider?.commercial_name || 'Doctor';
        }

        const distRecord = await prisma.clinic_payment_distributions.create({
          data: {
            id: randomUUID(),
            payout_id: paymentId,
            doctor_id: d.doctorId,
            amount: d.amount,
            percentage: (d.amount / netAmount) * 100,
            status: 'pending',
          },
        });

        return {
          doctorId: d.doctorId,
          doctorName: doctorName,
          amount: Number(distRecord.amount),
          percentage: Number(distRecord.percentage || 0),
          status: distRecord.status,
        };
      })
    );

    const result = {
      clinicPaymentId: paymentId,
      totalReceived: netAmount,
      distributions,
      totalDistributed: totalDistribution,
      remaining: netAmount - totalDistribution,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log(`✅ [CLINICS] Pago ${paymentId} distribuido entre ${distributions.length} médicos`);
    return successResponse(result);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al distribuir pago:', error.message);
    logger.error('Error distributing payment', error);
    return internalErrorResponse('Failed to distribute payment');
  }
}

/**
 * GET /api/clinics/doctors/payments
 * Obtener pagos a médicos de la clínica
 */
export async function getDoctorPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/doctors/payments - Obteniendo pagos a médicos');
  
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    // Buscar clínica del usuario
    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Evitar join pesado por relación: primero obtenemos payouts de la clínica y filtramos por payout_id
    const payoutIds = (
      await prisma.payouts.findMany({
        where: { provider_id: clinic.id, payout_type: 'clinic' },
        select: { id: true },
        take: 500,
      })
    ).map((p) => p.id);

    if (payoutIds.length === 0) {
      return paginatedResponse([], 0, page, limit);
    }

    const where = { payout_id: { in: payoutIds } };

    const total = await prisma.clinic_payment_distributions.count({ where });

    const distributions = await prisma.clinic_payment_distributions.findMany({
      where,
      include: {
        clinic_doctors: {
          include: {
            users: {
              select: { id: true }
            }
          },
        },
        payouts: true,
      },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
    });

    // Obtener nombres de doctores desde providers
    const doctorUserIds = distributions
      .map(d => d.clinic_doctors?.user_id)
      .filter((id): id is string => id !== null);
    
    const providers = doctorUserIds.length > 0
      ? await prisma.providers.findMany({
          where: { user_id: { in: doctorUserIds } },
          select: { user_id: true, commercial_name: true }
        })
      : [];
    
    const providerNameMap = new Map(providers.map(p => [p.user_id, p.commercial_name]));

    // Obtener cuentas bancarias por user_id
    const bankAccounts = doctorUserIds.length > 0
      ? await prisma.doctor_bank_accounts.findMany({
          where: { user_id: { in: doctorUserIds } },
        })
      : [];
    const bankAccountMap = new Map(bankAccounts.map(b => [b.user_id, b]));

    // Mapear a formato del frontend
    const mappedPayments = distributions.map((dist) => {
      const doctorName = dist.clinic_doctors?.user_id 
        ? providerNameMap.get(dist.clinic_doctors.user_id) || 'Doctor'
        : 'Doctor';
      
      return {
        id: dist.id,
        clinicId: clinic.id,
        clinicName: clinic.name,
        doctorId: dist.doctor_id,
        doctorName: doctorName,
        amount: Number(dist.amount),
        status: dist.status,
        paymentDate: dist.paid_at?.toISOString() || null,
        createdAt: dist.created_at?.toISOString(),
        clinicPaymentId: dist.payout_id,
        doctorBankAccount: dist.clinic_doctors?.user_id && bankAccountMap.get(dist.clinic_doctors.user_id) ? {
          bankName: bankAccountMap.get(dist.clinic_doctors.user_id)!.bank_name,
          accountNumber: bankAccountMap.get(dist.clinic_doctors.user_id)!.account_number,
          accountType: bankAccountMap.get(dist.clinic_doctors.user_id)!.account_type,
          accountHolder: bankAccountMap.get(dist.clinic_doctors.user_id)!.account_holder,
        } : undefined,
      };
    });

    console.log(`✅ [CLINICS] ${mappedPayments.length} pagos a médicos obtenidos (total: ${total})`);
    return paginatedResponse(mappedPayments, total, page, limit);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al obtener pagos a médicos:', error.message);
    logger.error('Error getting doctor payments', error);
    return internalErrorResponse('Failed to get doctor payments');
  }
}

/**
 * POST /api/clinics/doctors/:doctorId/pay
 * Pagar a un médico específico
 */
export async function payDoctor(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/doctors/:doctorId/pay - Pagando a médico');
  
  const prisma = getPrismaClient();

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    const pathParts = event.requestContext.http.path.split('/');
    const doctorId = pathParts[pathParts.indexOf('doctors') + 1];

    const body = JSON.parse(event.body || '{}');
    const { paymentId } = body;

    if (!paymentId) {
      return errorResponse('paymentId es requerido', 400);
    }

    // Buscar clínica del usuario
    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Actualizar distribución a 'paid'
    const distribution = await prisma.clinic_payment_distributions.update({
      where: { id: paymentId },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    console.log(`✅ [CLINICS] Pago ${paymentId} a médico ${doctorId} marcado como pagado`);
    return successResponse({
      id: distribution.id,
      status: distribution.status,
      paymentDate: distribution.paid_at?.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al pagar a médico:', error.message);
    logger.error('Error paying doctor', error);
    return internalErrorResponse('Failed to pay doctor');
  }
}

/**
 * GET /api/clinics/payments/:id/distribution
 * Obtener distribución de un pago
 */
export async function getPaymentDistribution(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/payments/:id/distribution - Obteniendo distribución');
  
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    const pathParts = event.requestContext.http.path.split('/');
    const paymentId = pathParts[pathParts.indexOf('payments') + 1];

    // Buscar clínica del usuario
    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Obtener payout
    const payout = await prisma.payouts.findFirst({
      where: {
        id: paymentId,
        provider_id: clinic.id,
      },
    });

    if (!payout) {
      return notFoundResponse('Payment not found');
    }

    const where = { payout_id: paymentId };

    const total = await prisma.clinic_payment_distributions.count({ where });

    // Obtener distribuciones
    const distributions = await prisma.clinic_payment_distributions.findMany({
      where,
      include: {
        clinic_doctors: {
          include: {
            users: {
              select: {
                id: true
              }
            }
          }
        },
      },
      skip: offset,
      take: limit,
    });

    const netAmount = Number(payout.total_amount || 0);

    // Obtener nombres de doctores desde providers
    const doctorUserIds = distributions
      .map(d => d.clinic_doctors?.user_id)
      .filter((id): id is string => id !== null);
    
    const providers = doctorUserIds.length > 0
      ? await prisma.providers.findMany({
          where: { user_id: { in: doctorUserIds } },
          select: {
            user_id: true,
            commercial_name: true
          }
        })
      : [];
    
    const providerNameMap = new Map(providers.map(p => [p.user_id, p.commercial_name]));

    const mappedDistributions = distributions.map((d) => {
      const doctorName = d.clinic_doctors?.user_id 
        ? providerNameMap.get(d.clinic_doctors.user_id) || 'Doctor'
        : 'Doctor';
      
      return {
        doctorId: d.doctor_id,
        doctorName: doctorName,
        amount: Number(d.amount),
        percentage: Number(d.percentage || 0),
        status: d.status,
        paymentId: d.id,
      };
    });

    console.log(`✅ [CLINICS] Distribución de pago ${paymentId} obtenida (${mappedDistributions.length} distribuciones, total: ${total})`);
    return paginatedResponse(mappedDistributions, total, page, limit);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al obtener distribución:', error.message);
    logger.error('Error getting payment distribution', error);
    return internalErrorResponse('Failed to get payment distribution');
  }
}

/**
 * GET /api/clinics/admin/payments
 * Obtener pagos pendientes a clínicas (vista de administrador)
 */
export async function getAdminClinicPaymentsList(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/admin/payments - Obteniendo pagos a clínicas');
  
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
                      users: { select: { email: true } },
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

    const clinicIds = payouts.map(p => p.provider_id).filter((id): id is string => id !== null);
    const clinics = await prisma.clinics.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true },
    });
    
    const clinicMap = new Map(clinics.map(c => [c.id, c.name]));

    const mappedPayouts = payouts.map((payout) => {
      const clinicName = payout.provider_id ? clinicMap.get(payout.provider_id) || 'Clínica' : 'Clínica';
      const totalAmount = payout.payments.reduce((sum: number, p) => sum + Number(p.amount_total || 0), 0);
      const appCommission = payout.payments.reduce((sum: number, p) => sum + Number(p.platform_fee || 0), 0);
      const distributedAmount = payout.clinic_payment_distributions?.reduce(
        (sum: number, d) => sum + Number(d.amount), 0
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
          doctorName: 'Doctor',
          patientName: p.appointments?.patients?.users?.email || 'Paciente',
          amount: Number(p.amount_total || 0),
          date: p.appointments?.scheduled_for?.toISOString() || p.created_at?.toISOString(),
        })),
        isDistributed: distributedAmount > 0,
        distributedAmount,
        remainingAmount: Number(payout.total_amount || 0) - distributedAmount,
      };
    });

    console.log(`✅ [CLINICS] ${mappedPayouts.length} pagos a clínicas obtenidos (página ${page}, total: ${total})`);
    return paginatedResponse(mappedPayouts, total, page, limit);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al obtener pagos a clínicas:', error.message);
    logger.error('Error getting clinic payments', error);
    return internalErrorResponse('Failed to get clinic payments');
  }
}

/**
 * POST /api/clinics/admin/payments/:clinicPaymentId/mark-paid
 * Marcar pago a clínica como pagado (vista de administrador)
 */
export async function markAdminClinicPaymentPaid(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/admin/payments/:clinicPaymentId/mark-paid');
  
  const prisma = getPrismaClient();

  try {
    const pathParts = event.requestContext.http.path.split('/');
    const clinicPaymentId = pathParts[pathParts.length - 2];

    if (!clinicPaymentId) {
      return errorResponse('clinicPaymentId es requerido', 400);
    }

    const payout = await prisma.payouts.update({
      where: { id: clinicPaymentId },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    await prisma.payments.updateMany({
      where: { payout_id: clinicPaymentId },
      data: {
        status: 'paid',
        paid_at: new Date(),
      },
    });

    console.log(`✅ [CLINICS] Pago a clínica ${clinicPaymentId} marcado como pagado`);
    return successResponse({
      id: payout.id,
      status: payout.status,
      paymentDate: payout.paid_at?.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al marcar pago a clínica como pagado:', error.message);
    logger.error('Error marking clinic payment as paid', error);
    return internalErrorResponse('Failed to mark clinic payment as paid');
  }
}
