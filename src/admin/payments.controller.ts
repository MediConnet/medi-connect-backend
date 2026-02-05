import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';

/**
 * GET /api/admin/payments/doctors
 * Obtener pagos pendientes a médicos independientes
 */
export async function getDoctorPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] GET /api/admin/payments/doctors - Obteniendo pagos a médicos');
  
  const prisma = getPrismaClient();

  try {
    // Obtener todos los payments con source='admin' y status='pending'
    const payments = await prisma.payments.findMany({
      where: {
        payment_source: 'admin',
        payment_method: 'card', // Solo pagos con tarjeta
        status: 'pending',
      },
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
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Mapear a formato del frontend
    const mappedPayments = payments.map((payment) => ({
      id: payment.id,
      appointmentId: payment.appointment_id,
      patientName: payment.appointments?.patients?.users?.email || 'Paciente',
      date: payment.appointments?.scheduled_for?.toISOString() || payment.created_at?.toISOString(),
      amount: Number(payment.amount_total || 0),
      commission: Number(payment.platform_fee || 0),
      netAmount: Number(payment.provider_amount || 0),
      status: payment.status || 'pending',
      paymentMethod: payment.payment_method || 'card',
      createdAt: payment.created_at?.toISOString(),
      source: 'admin',
      providerId: payment.appointments?.provider_id,
      providerName: payment.appointments?.providers?.commercial_name,
    }));

    console.log(`✅ [ADMIN] ${mappedPayments.length} pagos a médicos obtenidos`);
    return successResponse(mappedPayments);
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

  try {
    // Obtener payouts de tipo 'clinic' con status='pending'
    const payouts = await prisma.payouts.findMany({
      where: {
        payout_type: 'clinic',
        status: 'pending',
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

    // Obtener clínicas para mapear nombres
    const clinicIds = payouts.map(p => p.provider_id).filter((id): id is string => id !== null);
    const clinics = await prisma.clinics.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true },
    });
    
    const clinicMap = new Map(clinics.map(c => [c.id, c.name]));

    // Mapear a formato del frontend
    const mappedPayouts = payouts.map((payout) => {
      const clinicName = payout.provider_id ? clinicMap.get(payout.provider_id) || 'Clínica' : 'Clínica';
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
      };
    });

    console.log(`✅ [ADMIN] ${mappedPayouts.length} pagos a clínicas obtenidos`);
    return successResponse(mappedPayouts);
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
    // Obtener pagos a médicos pagados
    const doctorPayments = await prisma.payments.findMany({
      where: {
        payment_source: 'admin',
        status: 'paid',
      },
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
      orderBy: {
        paid_at: 'desc',
      },
      take: 50, // Limitar a últimos 50
    });

    // Obtener pagos a clínicas pagados
    const clinicPayments = await prisma.payouts.findMany({
      where: {
        payout_type: 'clinic',
        status: 'paid',
      },
      orderBy: {
        paid_at: 'desc',
      },
      take: 50,
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
      status: p.status,
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
      doctorPayments: mappedDoctorPayments,
      clinicPayments: mappedClinicPayments,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error al obtener historial:', error.message);
    logger.error('Error getting payment history', error);
    return internalErrorResponse('Failed to get payment history');
  }
}
