import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, notFoundResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { getAuthContext } from '../shared/auth';

/**
 * GET /api/doctors/payments
 * Obtener pagos del médico (tanto de admin como de clínicas)
 */
export async function getDoctorPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/payments - Obteniendo pagos del médico');
  
  const prisma = getPrismaClient();

  try {
    // Obtener contexto de autenticación
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Token inválido o expirado', 401);
    }

    // Buscar el provider_id del médico
    const doctor = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!doctor) {
      return errorResponse('Solo médicos pueden acceder a esta ruta', 403);
    }

    // Obtener filtros de query params
    const queryParams = event.queryStringParameters || {};
    const statusFilter = queryParams.status; // 'pending' o 'paid'
    const sourceFilter = queryParams.source; // 'admin' o 'clinic'

    // 1. Obtener pagos directos del admin (médico independiente)
    const payments = await prisma.payments.findMany({
      where: {
        appointments: {
          provider_id: doctor.id,
        },
        payment_source: sourceFilter === 'clinic' ? undefined : 'admin',
      },
      include: {
        appointments: {
          include: {
            patients: {
              include: {
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
        created_at: 'desc',
      },
    });

    // 2. Obtener pagos de clínicas (médico asociado)
    const clinicDoctor = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
      },
      include: {
        clinics: true,
      },
    });

    let clinicPayments: any[] = [];
    if (clinicDoctor && sourceFilter !== 'admin') {
      clinicPayments = await prisma.clinic_payment_distributions.findMany({
        where: {
          doctor_id: clinicDoctor.id,
        },
        include: {
          payouts: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    }

    // Mapear pagos directos del admin
    const mappedDirectPayments = payments.map((payment) => {
      const patient = payment.appointments?.patients;
      const patientName = patient?.users?.email || 'Paciente';
      const scheduledFor = payment.appointments?.scheduled_for;
      const dateStr = scheduledFor ? new Date(scheduledFor).toISOString().split('T')[0] : 
                      payment.created_at ? new Date(payment.created_at).toISOString().split('T')[0] : '';

      const amount = Number(payment.amount_total || 0);
      const commission = Number(payment.platform_fee || 0);
      const netAmount = amount - commission;
      const isPaid = payment.paid_at !== null;

      return {
        id: payment.id,
        appointmentId: payment.appointment_id,
        patientName,
        date: dateStr,
        amount,
        commission,
        netAmount,
        status: isPaid ? 'paid' : 'pending',
        paymentMethod: payment.payment_method || 'card',
        createdAt: payment.created_at?.toISOString(),
        source: 'admin' as const,
        clinicId: null,
        clinicName: null,
      };
    });

    // Mapear pagos de clínicas
    const mappedClinicPayments = clinicPayments.map((distribution) => {
      const dateStr = distribution.created_at ? new Date(distribution.created_at).toISOString().split('T')[0] : '';
      const isPaid = distribution.status === 'paid';

      return {
        id: distribution.id,
        appointmentId: null,
        patientName: 'Distribución de clínica',
        date: dateStr,
        amount: Number(distribution.amount),
        commission: 0,
        netAmount: Number(distribution.amount),
        status: isPaid ? 'paid' : 'pending',
        paymentMethod: 'transfer' as const,
        createdAt: distribution.created_at?.toISOString(),
        source: 'clinic' as const,
        clinicId: clinicDoctor?.clinic_id || null,
        clinicName: clinicDoctor?.clinics?.name || null,
      };
    });

    // Combinar ambos tipos de pagos
    let allPayments = [...mappedDirectPayments, ...mappedClinicPayments];

    // Aplicar filtro de status si existe
    if (statusFilter) {
      allPayments = allPayments.filter(p => p.status === statusFilter);
    }

    // Ordenar por fecha de creación (más reciente primero)
    allPayments.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    console.log(`✅ [DOCTORS] ${allPayments.length} pagos obtenidos (${mappedDirectPayments.length} admin, ${mappedClinicPayments.length} clínica)`);
    return successResponse(allPayments);
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al obtener pagos:', error.message);
    logger.error('Error getting doctor payments', error);
    return internalErrorResponse('Error al obtener pagos');
  }
}

/**
 * GET /api/doctors/payments/:id
 * Obtener detalle de un pago específico del médico
 */
export async function getDoctorPaymentById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/payments/:id - Obteniendo detalle de pago');
  
  const prisma = getPrismaClient();

  try {
    // Obtener contexto de autenticación
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse('Token inválido o expirado', 401);
    }

    // Buscar el provider_id del médico
    const doctor = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!doctor) {
      return errorResponse('Solo médicos pueden acceder a esta ruta', 403);
    }

    // Extraer ID del path
    const pathParts = event.requestContext.http.path.split('/');
    const paymentId = pathParts[pathParts.length - 1];

    if (!paymentId) {
      return errorResponse('ID de pago requerido', 400);
    }

    // Intentar buscar en payments (pagos de admin)
    const payment = await prisma.payments.findFirst({
      where: {
        id: paymentId,
        appointments: {
          provider_id: doctor.id,
        },
      },
      include: {
        appointments: {
          include: {
            patients: {
              include: {
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
    });

    if (payment) {
      // Es un pago de admin
      const patient = payment.appointments?.patients;
      const patientName = patient?.users?.email || 'Paciente';
      const scheduledFor = payment.appointments?.scheduled_for;
      const dateStr = scheduledFor ? new Date(scheduledFor).toISOString().split('T')[0] : 
                      payment.created_at ? new Date(payment.created_at).toISOString().split('T')[0] : '';

      const amount = Number(payment.amount_total || 0);
      const commission = Number(payment.platform_fee || 0);
      const netAmount = amount - commission;
      const isPaid = payment.paid_at !== null;

      const response = {
        id: payment.id,
        appointmentId: payment.appointment_id,
        patientName,
        date: dateStr,
        amount,
        commission,
        netAmount,
        status: isPaid ? 'paid' : 'pending',
        paymentMethod: payment.payment_method || 'card',
        createdAt: payment.created_at?.toISOString(),
        source: 'admin' as const,
        clinicId: null,
        clinicName: null,
        appointment: payment.appointments ? {
          id: payment.appointments.id,
          reason: payment.appointments.reason || 'Consulta general',
          scheduledFor: payment.appointments.scheduled_for?.toISOString(),
        } : null,
      };

      console.log(`✅ [DOCTORS] Pago encontrado (admin): ${paymentId}`);
      return successResponse(response);
    }

    // Si no es pago de admin, buscar en clinic_payment_distributions
    const clinicDoctor = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
      },
      include: {
        clinics: true,
      },
    });

    if (clinicDoctor) {
      const distribution = await prisma.clinic_payment_distributions.findFirst({
        where: {
          id: paymentId,
          doctor_id: clinicDoctor.id,
        },
        include: {
          payouts: true,
        },
      });

      if (distribution) {
        const dateStr = distribution.created_at ? new Date(distribution.created_at).toISOString().split('T')[0] : '';
        const isPaid = distribution.status === 'paid';

        const response = {
          id: distribution.id,
          appointmentId: null,
          patientName: 'Distribución de clínica',
          date: dateStr,
          amount: Number(distribution.amount),
          commission: 0,
          netAmount: Number(distribution.amount),
          status: isPaid ? 'paid' : 'pending',
          paymentMethod: 'transfer' as const,
          createdAt: distribution.created_at?.toISOString(),
          source: 'clinic' as const,
          clinicId: clinicDoctor.clinic_id,
          clinicName: clinicDoctor.clinics?.name || null,
          appointment: null,
        };

        console.log(`✅ [DOCTORS] Pago encontrado (clinic): ${paymentId}`);
        return successResponse(response);
      }
    }

    // No se encontró el pago
    console.error(`❌ [DOCTORS] Pago no encontrado: ${paymentId}`);
    return notFoundResponse('Pago no encontrado');

  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al obtener detalle de pago:', error.message);
    logger.error('Error getting doctor payment by id', error);
    return internalErrorResponse('Error al obtener detalle de pago');
  }
}
