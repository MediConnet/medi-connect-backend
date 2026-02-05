import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, notFoundResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { getAuthContext } from '../shared/auth';

/**
 * GET /api/clinics/payments
 * Obtener pagos recibidos del administrador
 */
export async function getClinicPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/payments - Obteniendo pagos recibidos');
  
  const prisma = getPrismaClient();

  try {
    // Obtener contexto de autenticación
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    // Buscar clínica del usuario
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Obtener payouts de la clínica
    const payouts = await prisma.payouts.findMany({
      where: {
        provider_id: clinic.id,
        payout_type: 'clinic',
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
      orderBy: {
        created_at: 'desc',
      },
    });

    // Mapear a formato del frontend
    const mappedPayouts = payouts.map((payout) => {
      const totalAmount = payout.payments.reduce((sum: number, p) => sum + Number(p.amount_total || 0), 0);
      const appCommission = payout.payments.reduce((sum: number, p) => sum + Number(p.platform_fee || 0), 0);
      const distributedAmount = payout.clinic_payment_distributions?.reduce(
        (sum: number, d) => sum + Number(d.amount), 
        0
      ) || 0;

      return {
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
          doctorName: 'Doctor', // TODO: Obtener nombre del médico
          patientName: p.appointments?.patients?.users?.email || 'Paciente',
          amount: Number(p.amount_total || 0),
          date: p.appointments?.scheduled_for?.toISOString() || p.created_at?.toISOString(),
        })),
        isDistributed: distributedAmount > 0,
        distributedAmount,
        remainingAmount: Number(payout.total_amount || 0) - distributedAmount,
      };
    });

    console.log(`✅ [CLINICS] ${mappedPayouts.length} pagos obtenidos`);
    return successResponse(mappedPayouts);
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
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

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
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

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
        // Obtener nombre del médico
        const doctor = await prisma.clinic_doctors.findUnique({
          where: { id: d.doctorId },
        });

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
          doctorName: doctor?.name || 'Doctor',
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

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    // Buscar clínica del usuario
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Obtener distribuciones de pagos
    const distributions = await prisma.clinic_payment_distributions.findMany({
      where: {
        payouts: {
          provider_id: clinic.id,
        },
      },
      include: {
        clinic_doctors: {
          include: {
            doctor_bank_accounts: true,
          },
        },
        payouts: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Mapear a formato del frontend
    const mappedPayments = distributions.map((dist) => ({
      id: dist.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
      doctorId: dist.doctor_id,
      doctorName: dist.clinic_doctors?.name || 'Doctor',
      amount: Number(dist.amount),
      status: dist.status,
      paymentDate: dist.paid_at?.toISOString() || null,
      createdAt: dist.created_at?.toISOString(),
      clinicPaymentId: dist.payout_id,
      doctorBankAccount: dist.clinic_doctors?.doctor_bank_accounts ? {
        bankName: dist.clinic_doctors.doctor_bank_accounts.bank_name,
        accountNumber: dist.clinic_doctors.doctor_bank_accounts.account_number,
        accountType: dist.clinic_doctors.doctor_bank_accounts.account_type,
        accountHolder: dist.clinic_doctors.doctor_bank_accounts.account_holder,
      } : undefined,
    }));

    console.log(`✅ [CLINICS] ${mappedPayments.length} pagos a médicos obtenidos`);
    return successResponse(mappedPayments);
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
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

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

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Authentication required', 401);
    }

    const pathParts = event.requestContext.http.path.split('/');
    const paymentId = pathParts[pathParts.indexOf('payments') + 1];

    // Buscar clínica del usuario
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

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

    // Obtener distribuciones
    const distributions = await prisma.clinic_payment_distributions.findMany({
      where: { payout_id: paymentId },
      include: {
        clinic_doctors: true,
      },
    });

    const totalDistributed = distributions.reduce((sum: number, d) => sum + Number(d.amount), 0);
    const netAmount = Number(payout.total_amount || 0);

    const result = {
      clinicPaymentId: paymentId,
      totalReceived: netAmount,
      distributions: distributions.map((d) => ({
        doctorId: d.doctor_id,
        doctorName: d.clinic_doctors?.name || 'Doctor',
        amount: Number(d.amount),
        percentage: Number(d.percentage || 0),
        status: d.status,
        paymentId: d.id,
      })),
      totalDistributed,
      remaining: netAmount - totalDistributed,
      createdAt: distributions[0]?.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: distributions[0]?.updated_at?.toISOString() || new Date().toISOString(),
    };

    console.log(`✅ [CLINICS] Distribución de pago ${paymentId} obtenida`);
    return successResponse(result);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al obtener distribución:', error.message);
    logger.error('Error getting payment distribution', error);
    return internalErrorResponse('Failed to get payment distribution');
  }
}
