import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { AuthContext, requireAuth } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';

// --- GET APPOINTMENTS ---
export async function getAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] GET /api/patients/appointments - Obteniendo citas del paciente');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    console.error('❌ [PATIENTS] GET /api/patients/appointments - Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      console.log('⚠️ [PATIENTS] Paciente no encontrado, retornando array vacío');
      return successResponse([]);
    }

    // Obtener parámetros de consulta
    const queryParams = event.queryStringParameters || {};
    const status = queryParams.status; // 'CONFIRMED', 'CANCELLED', 'COMPLETED'
    const limit = parseInt(queryParams.limit || '50', 10);
    const offset = parseInt(queryParams.offset || '0', 10);

    // Construir filtro
    const where: any = { patient_id: patient.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    // Obtener citas
    const appointments = await prisma.appointments.findMany({
      where,
      include: {
        providers: {
          select: {
            id: true,
            commercial_name: true,
            logo_url: true,
            service_categories: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        provider_branches: {
          select: {
            id: true,
            name: true,
            address_text: true,
            phone_contact: true,
          },
        },
      },
      orderBy: {
        scheduled_for: 'desc',
      },
      take: limit,
      skip: offset,
    });

    console.log(`✅ [PATIENTS] Se encontraron ${appointments.length} citas`);
    return successResponse(
      appointments.map(apt => ({
        id: apt.id,
        scheduledFor: apt.scheduled_for,
        status: apt.status,
        reason: apt.reason,
        isPaid: apt.is_paid || false,
        provider: apt.providers ? {
          id: apt.providers.id,
          name: apt.providers.commercial_name,
          logoUrl: apt.providers.logo_url,
          category: apt.providers.service_categories?.name || null,
        } : null,
        branch: apt.provider_branches ? {
          id: apt.provider_branches.id,
          name: apt.provider_branches.name,
          address: apt.provider_branches.address_text,
          phone: apt.provider_branches.phone_contact,
        } : null,
      }))
    );
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al obtener citas:', error.message);
    logger.error('Error getting patient appointments', error);
    return internalErrorResponse('Failed to get appointments');
  }
}

// --- GET APPOINTMENT BY ID ---
export async function getAppointmentById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] GET /api/patients/appointments/:id - Obteniendo detalle de cita');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const appointmentId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/patients/appointments/',
      ''
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return notFoundResponse('Patient not found');
    }

    // Obtener la cita
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
      include: {
        providers: {
          select: {
            id: true,
            commercial_name: true,
            logo_url: true,
            description: true,
            service_categories: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        provider_branches: {
          select: {
            id: true,
            name: true,
            address_text: true,
            phone_contact: true,
            email_contact: true,
          },
        },
      },
    });

    if (!appointment) {
      return notFoundResponse('Appointment not found');
    }

    // Verificar que la cita pertenece al paciente
    if (appointment.patient_id !== patient.id) {
      return errorResponse('Access denied', 403);
    }

    console.log('✅ [PATIENTS] Cita obtenida exitosamente');
    return successResponse({
      id: appointment.id,
      scheduledFor: appointment.scheduled_for,
      status: appointment.status,
      reason: appointment.reason,
      isPaid: appointment.is_paid || false,
      provider: appointment.providers ? {
        id: appointment.providers.id,
        name: appointment.providers.commercial_name,
        logoUrl: appointment.providers.logo_url,
        description: appointment.providers.description,
        category: appointment.providers.service_categories?.name || null,
      } : null,
      branch: appointment.provider_branches ? {
        id: appointment.provider_branches.id,
        name: appointment.provider_branches.name,
        address: appointment.provider_branches.address_text,
        phone: appointment.provider_branches.phone_contact,
        email: appointment.provider_branches.email_contact,
      } : null,
    });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al obtener cita:', error.message);
    logger.error('Error getting appointment', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid appointment ID', 400);
    }
    return internalErrorResponse('Failed to get appointment');
  }
}

// --- CANCEL APPOINTMENT ---
export async function cancelAppointment(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] DELETE /api/patients/appointments/:id - Cancelando cita');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const appointmentId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/patients/appointments/',
      ''
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return notFoundResponse('Patient not found');
    }

    // Obtener la cita
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return notFoundResponse('Appointment not found');
    }

    // Verificar que la cita pertenece al paciente
    if (appointment.patient_id !== patient.id) {
      return errorResponse('Access denied', 403);
    }

    // Verificar que la cita no esté en el pasado
    if (appointment.scheduled_for && new Date(appointment.scheduled_for) < new Date()) {
      return errorResponse('Cannot cancel past appointments', 400);
    }

    // Actualizar estado a CANCELLED
    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
      },
    });

    console.log('✅ [PATIENTS] Cita cancelada exitosamente');
    return successResponse({
      id: updatedAppointment.id,
      status: updatedAppointment.status,
      message: 'Appointment cancelled successfully',
    });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al cancelar cita:', error.message);
    logger.error('Error cancelling appointment', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid appointment ID', 400);
    }
    return internalErrorResponse('Failed to cancel appointment');
  }
}
