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
      return errorResponse('Authentication required', 401);
    }

    // Buscar el provider_id del médico
    const doctor = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!doctor) {
      return notFoundResponse('Doctor not found');
    }

    // 1. Obtener pagos directos del admin (médico independiente)
    // Primero obtenemos las citas del médico
    const appointments = await prisma.appointments.findMany({
      where: {
        provider_id: doctor.id,
      },
      include: {
        payments: {
          where: {
            payment_source: 'admin',
          },
        },
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
    });

    // Extraer los pagos de las citas
    const directPayments = appointments
      .filter(apt => apt.payments.length > 0)
      .flatMap(apt => 
        apt.payments.map(payment => ({
          ...payment,
          appointments: apt,
        }))
      );

    // 2. Obtener pagos de clínicas (médico asociado)
    // Buscar si el médico está asociado a alguna clínica
    const clinicDoctor = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
      },
      include: {
        clinics: true,
      },
    });

    let clinicPayments: any[] = [];
    if (clinicDoctor) {
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
    const mappedDirectPayments = directPayments.map((payment) => {
      const patientUser = payment.appointments?.patients?.users;
      const patientName = patientUser?.email || 'Paciente';

      return {
        id: payment.id,
        appointmentId: payment.appointment_id,
        patientName,
        date: payment.appointments?.scheduled_for?.toISOString() || payment.created_at?.toISOString(),
        amount: Number(payment.amount_total || 0),
        commission: Number(payment.platform_fee || 0),
        netAmount: Number(payment.amount_total || 0) - Number(payment.platform_fee || 0),
        status: payment.paid_at ? 'paid' : 'pending',
        paymentMethod: payment.payment_method || 'card',
        createdAt: payment.created_at?.toISOString(),
        source: 'admin',
      };
    });

    // Mapear pagos de clínicas
    const mappedClinicPayments = clinicPayments.map((distribution) => ({
      id: distribution.id,
      appointmentId: null, // No hay cita específica, es una distribución
      patientName: 'Distribución de clínica',
      date: distribution.created_at?.toISOString(),
      amount: Number(distribution.amount),
      commission: 0, // La comisión ya fue descontada por el admin
      netAmount: Number(distribution.amount),
      status: distribution.status || 'pending',
      paymentMethod: 'transfer',
      createdAt: distribution.created_at?.toISOString(),
      source: 'clinic',
      clinicId: clinicDoctor?.clinic_id,
      clinicName: clinicDoctor?.clinics?.name || 'Clínica',
    }));

    // Combinar ambos tipos de pagos
    const allPayments = [...mappedDirectPayments, ...mappedClinicPayments];

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
    return internalErrorResponse('Failed to get doctor payments');
  }
}
