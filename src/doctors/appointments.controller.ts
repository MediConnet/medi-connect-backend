import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
// Importamos los enums necesarios (Asegúrate de haber hecho 'prisma generate' tras los cambios en el schema)
import { enum_appt_status, enum_payment_method, enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, successResponse } from '../shared/response';
import { parseBody, updateAppointmentStatusSchema } from '../shared/validators';

export async function getAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    console.log('✅ [DOCTORS] GET /api/doctors/appointments - Obteniendo citas');
    
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [DOCTORS] Provider no encontrado para este usuario');
      return successResponse({
        appointments: [],
        pagination: { limit: 50, offset: 0, total: 0 },
      });
    }

    const queryParams = event.queryStringParameters || {};
    
    // Validamos que el status que viene por URL sea válido según el Enum
    let statusFilter: enum_appt_status | undefined;
    if (queryParams.status && Object.values(enum_appt_status).includes(queryParams.status as enum_appt_status)) {
      statusFilter = queryParams.status as enum_appt_status;
    }

    const limit = parseInt(queryParams.limit || '50', 10);
    const offset = parseInt(queryParams.offset || '0', 10);

    const whereClause = {
      provider_id: provider.id,
      ...(statusFilter && { status: statusFilter }),
    };

    const [appointments, total] = await Promise.all([
      prisma.appointments.findMany({
        where: whereClause,
        include: {
          patients: {
            select: {
              id: true,
              full_name: true,
              phone: true,
              users: {
                select: {
                  profile_picture_url: true,
                },
              },
            },
          },
          payments: {
            select: {
              id: true,
              amount_total: true,
              status: true,
            },
            take: 1, 
          }
        },
        orderBy: { scheduled_for: 'asc' }, 
        take: limit,
        skip: offset,
      }),
      
      prisma.appointments.count({
        where: whereClause,
      }),
    ]);

    const formattedAppointments = appointments.map(appt => {
      
      // --- Lógica de Información de Pago ---
      let methodLabel = 'Efectivo';
      let finalAmount = Number(appt.cost || 0); 
      
      if (appt.payment_method === enum_payment_method.CARD) {
        methodLabel = 'Tarjeta';
        const stripePayment = appt.payments?.[0];
        if (stripePayment && stripePayment.amount_total) {
          finalAmount = Number(stripePayment.amount_total);
        }
      } else {
        methodLabel = 'Efectivo';
      }

      const paymentDetails = {
        method_label: methodLabel,
        amount: finalAmount,
        is_paid: appt.is_paid ?? false, 
      };

      return {
        ...appt,
        scheduled_for: appt.scheduled_for?.toISOString() || null,
        
        patients: appt.patients ? {
          id: appt.patients.id,
          full_name: appt.patients.full_name,
          phone: appt.patients.phone,
          profile_picture_url: appt.patients.users?.profile_picture_url || null,
        } : null,

        payment_details: paymentDetails,
        
        payments: undefined 
      };
    });

    return successResponse({
      appointments: formattedAppointments,
      pagination: {
        limit,
        offset,
        total,
      },
    });

  } catch (error) {
    console.error('❌ [DOCTORS] Error getting appointments:', error);
    // Orden corregido: Mensaje, luego Código
    return errorResponse('Error interno al obtener las citas', 500);
  }
}

/**
 * Actualizar estado de una cita 
 */
export async function updateAppointmentStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) return authResult;
    
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    let appointmentId = event.pathParameters?.id;

    if (!appointmentId && event.requestContext?.http?.path) {
        const pathParts = event.requestContext.http.path.split('/');
        if (pathParts.length >= 2) {
            appointmentId = pathParts[pathParts.length - 2];
        }
    }

    if (!appointmentId) return errorResponse('ID de cita requerido', 400);

    const { status } = parseBody(event.body, updateAppointmentStatusSchema); 
    const newStatus = status as enum_appt_status; 

    console.log(`✅ [DOCTORS] UPDATE Status cita ${appointmentId} a ${newStatus}`);

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) return errorResponse('Proveedor no encontrado', 404);

    const existingAppointment = await prisma.appointments.findFirst({
      where: { id: appointmentId, provider_id: provider.id }
    });

    if (!existingAppointment) {
      return errorResponse('Cita no encontrada o no pertenece al doctor', 404);
    }

    // --- LÓGICA DE NEGOCIO ---
    let isPaidUpdate = existingAppointment.is_paid; 

    if (
      newStatus === enum_appt_status.COMPLETED && 
      existingAppointment.payment_method === enum_payment_method.CASH
    ) {
      isPaidUpdate = true;
    }
    
    if (
      newStatus === enum_appt_status.CONFIRMED && 
      existingAppointment.payment_method === enum_payment_method.CASH
    ) {
      isPaidUpdate = false;
    }

    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        status: newStatus,
        is_paid: isPaidUpdate
      }
    });

    return successResponse({
      success: true,
      message: 'Estado de cita actualizado correctamente',
      data: updatedAppointment
    });

  } catch (error) {
    console.error('❌ [DOCTORS] Error updating appointment status:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    const statusCode = message.includes('Validation error') ? 400 : 500;
    
    return errorResponse(message, statusCode);
  }
}