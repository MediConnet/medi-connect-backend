import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse } from '../shared/response';
import { parseBody, extractIdFromPath, updateClinicProfileDoctorSchema, createReceptionMessageSchema, requestDateBlockSchema, updateAppointmentStatusSchema } from '../shared/validators';
import { getClinicDoctor, validateClinicDoctorAccess, validateAppointmentAccess } from '../shared/clinic-doctor-helpers';
import { logger } from '../shared/logger';

// GET /api/doctors/clinic-info
export async function getClinicInfo(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/clinic-info - Obteniendo información de clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const clinicDoctor = await getClinicDoctor(authContext);

  if (!clinicDoctor) {
    console.log(`⚠️ [DOCTORS] Doctor ${authContext.user.id} no está asociado a ninguna clínica`);
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  console.log(`✅ [DOCTORS] Doctor está asociado a clínica: ${clinicDoctor.clinic_id}`);

  return successResponse({
    clinicId: clinicDoctor.clinic_id,
    clinicName: clinicDoctor.clinics?.name,
    doctorId: clinicDoctor.id,
    officeNumber: clinicDoctor.office_number,
    isActive: clinicDoctor.is_active,
  });
}

// GET /api/doctors/clinic/profile
export async function getClinicProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/clinic/profile - Obteniendo perfil de clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const clinicDoctor = await getClinicDoctor(authContext);

  if (!clinicDoctor || !clinicDoctor.clinics) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  const clinic = clinicDoctor.clinics;

  return successResponse({
    id: clinic.id,
    name: clinic.name,
    logoUrl: clinic.logo_url,
    address: clinic.address,
    phone: clinic.phone,
    whatsapp: clinic.whatsapp,
    description: clinic.description,
    latitude: clinic.latitude ? Number(clinic.latitude) : null,
    longitude: clinic.longitude ? Number(clinic.longitude) : null,
    doctorInfo: {
      id: clinicDoctor.id,
      name: clinicDoctor.name,
      specialty: clinicDoctor.specialty,
      officeNumber: clinicDoctor.office_number,
      profileImageUrl: clinicDoctor.profile_image_url,
      phone: clinicDoctor.phone,
      whatsapp: clinicDoctor.whatsapp,
    },
  });
}

// PUT /api/doctors/clinic/profile
export async function updateClinicProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] PUT /api/doctors/clinic/profile - Actualizando perfil de médico en clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const body = parseBody(event.body, updateClinicProfileDoctorSchema);
  const prisma = getPrismaClient();

  const clinicDoctor = await getClinicDoctor(authContext);
  if (!clinicDoctor) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  try {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (body.officeNumber !== undefined) updateData.office_number = body.officeNumber;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.whatsapp !== undefined) updateData.whatsapp = body.whatsapp;
    if (body.profileImageUrl !== undefined) updateData.profile_image_url = body.profileImageUrl || null;

    const updated = await prisma.clinic_doctors.update({
      where: { id: clinicDoctor.id },
      data: updateData,
    });

    return successResponse({
      id: updated.id,
      officeNumber: updated.office_number,
      phone: updated.phone,
      whatsapp: updated.whatsapp,
      profileImageUrl: updated.profile_image_url,
    });
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al actualizar perfil:`, error.message);
    logger.error('Error updating clinic doctor profile', error);
    return internalErrorResponse('Failed to update profile');
  }
}

// GET /api/doctors/clinic/appointments
export async function getClinicAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/clinic/appointments - Obteniendo citas de clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const clinicDoctor = await getClinicDoctor(authContext);

  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    const where: any = {
      clinic_id: clinicDoctor.clinic_id,
      provider_id: clinicDoctor.user_id,
    };

    // Filtros opcionales
    if (queryParams.date) {
      const date = new Date(queryParams.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.scheduled_for = {
        gte: date,
        lt: nextDay,
      };
    }

    if (queryParams.status) {
      where.status = queryParams.status.toUpperCase();
    }

    const appointments = await prisma.appointments.findMany({
      where,
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
            phone: true,
          },
        },
        clinics: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { scheduled_for: 'desc' },
      take: parseInt(queryParams.limit || '50', 10),
    });

    // OCULTAR información financiera
    return successResponse(appointments.map(apt => ({
      id: apt.id,
      scheduledFor: apt.scheduled_for,
      status: apt.status,
      reason: apt.reason,
      receptionStatus: apt.reception_status,
      receptionNotes: apt.reception_notes,
      patient: apt.patients ? {
        id: apt.patients.id,
        fullName: apt.patients.full_name,
        phone: apt.patients.phone,
      } : null,
      clinic: apt.clinics ? {
        id: apt.clinics.id,
        name: apt.clinics.name,
      } : null,
      // NO incluir: cost, payment_method, is_paid
    })));
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al obtener citas:`, error.message);
    logger.error('Error getting clinic appointments', error);
    return internalErrorResponse('Failed to get appointments');
  }
}

// PATCH /api/doctors/clinic/appointments/:id/status
export async function updateClinicAppointmentStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] PATCH /api/doctors/clinic/appointments/{id}/status - Actualizando estado de cita');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const appointmentId = extractIdFromPath(event.requestContext.http.path, '/api/doctors/clinic/appointments/', '/status');
  const body = parseBody(event.body, updateAppointmentStatusSchema);

  const validation = await validateAppointmentAccess(authContext, appointmentId);
  if (!validation.valid) {
    return errorResponse(validation.error || 'Access denied', 403);
  }

  const prisma = getPrismaClient();

  try {
    // Mapear estados
    const statusMap: Record<string, string> = {
      'scheduled': 'CONFIRMED',
      'confirmed': 'CONFIRMED',
      'attended': 'attended',
      'cancelled': 'CANCELLED',
      'no_show': 'CANCELLED',
    };

    const dbStatus = statusMap[body.status] || body.status.toUpperCase();

    const updated = await prisma.appointments.update({
      where: { id: appointmentId },
      data: { status: dbStatus },
    });

    return successResponse({
      id: updated.id,
      status: body.status,
      updatedAt: updated.scheduled_for?.toISOString() || null,
    });
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al actualizar estado:`, error.message);
    logger.error('Error updating appointment status', error);
    return internalErrorResponse('Failed to update appointment status');
  }
}

// GET /api/doctors/clinic/reception/messages
export async function getReceptionMessages(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/clinic/reception/messages - Obteniendo mensajes de recepción');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const clinicDoctor = await getClinicDoctor(authContext);

  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    const where: any = {
      clinic_id: clinicDoctor.clinic_id,
      doctor_id: clinicDoctor.id,
    };

    if (queryParams.unreadOnly === 'true') {
      where.is_read = false;
    }

    const messages = await prisma.reception_messages.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(queryParams.limit || '50', 10),
    });

    return successResponse(messages);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al obtener mensajes:`, error.message);
    logger.error('Error getting reception messages', error);
    return internalErrorResponse('Failed to get messages');
  }
}

// POST /api/doctors/clinic/reception/messages
export async function createReceptionMessage(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] POST /api/doctors/clinic/reception/messages - Creando mensaje de recepción');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const body = parseBody(event.body, createReceptionMessageSchema);
  const prisma = getPrismaClient();
  const { randomUUID } = await import('crypto');

  const clinicDoctor = await getClinicDoctor(authContext);
  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  try {
    const message = await prisma.reception_messages.create({
      data: {
        id: randomUUID(),
        clinic_id: clinicDoctor.clinic_id,
        doctor_id: clinicDoctor.id,
        message: body.message,
        sender_type: 'doctor',
        is_read: false,
      },
    });

    return successResponse(message, 201);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al crear mensaje:`, error.message);
    logger.error('Error creating reception message', error);
    return internalErrorResponse('Failed to create message');
  }
}

// PATCH /api/doctors/clinic/reception/messages/read
export async function markReceptionMessagesAsRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] PATCH /api/doctors/clinic/reception/messages/read - Marcando mensajes como leídos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  const clinicDoctor = await getClinicDoctor(authContext);
  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  try {
    const result = await prisma.reception_messages.updateMany({
      where: {
        clinic_id: clinicDoctor.clinic_id,
        doctor_id: clinicDoctor.id,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });

    return successResponse({
      count: result.count,
    });
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al marcar mensajes:`, error.message);
    logger.error('Error marking messages as read', error);
    return internalErrorResponse('Failed to mark messages as read');
  }
}

// GET /api/doctors/clinic/date-blocks
export async function getDateBlocks(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/clinic/date-blocks - Obteniendo bloqueos de fecha');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const clinicDoctor = await getClinicDoctor(authContext);

  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    const where: any = {
      clinic_id: clinicDoctor.clinic_id,
      doctor_id: clinicDoctor.id,
    };

    if (queryParams.status) {
      where.status = queryParams.status;
    }

    const dateBlocks = await prisma.date_block_requests.findMany({
      where,
      orderBy: { date: 'desc' },
      take: parseInt(queryParams.limit || '50', 10),
    });

    return successResponse(dateBlocks);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al obtener bloqueos:`, error.message);
    logger.error('Error getting date blocks', error);
    return internalErrorResponse('Failed to get date blocks');
  }
}

// POST /api/doctors/clinic/date-blocks/request
export async function requestDateBlock(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] POST /api/doctors/clinic/date-blocks/request - Solicitando bloqueo de fecha');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const body = parseBody(event.body, requestDateBlockSchema);
  const prisma = getPrismaClient();
  const { randomUUID } = await import('crypto');

  const clinicDoctor = await getClinicDoctor(authContext);
  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  try {
    const dateBlock = await prisma.date_block_requests.create({
      data: {
        id: randomUUID(),
        clinic_id: clinicDoctor.clinic_id,
        doctor_id: clinicDoctor.id,
        date: new Date(body.date),
        reason: body.reason,
        status: 'pending',
      },
    });

    return successResponse(dateBlock, 201);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al solicitar bloqueo:`, error.message);
    logger.error('Error requesting date block', error);
    return internalErrorResponse('Failed to request date block');
  }
}

// GET /api/doctors/clinic/notifications (opcional)
export async function getClinicNotifications(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/clinic/notifications - Obteniendo notificaciones de clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const clinicDoctor = await getClinicDoctor(authContext);

  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return notFoundResponse('Doctor is not associated with any clinic');
  }

  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    const where: any = {
      clinic_id: clinicDoctor.clinic_id,
    };

    if (queryParams.unreadOnly === 'true') {
      where.is_read = false;
    }

    const notifications = await prisma.clinic_notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(queryParams.limit || '50', 10),
    });

    // Filtrar solo notificaciones relevantes para el médico
    const relevantNotifications = notifications.filter(notif => {
      const data = notif.data as any;
      return data?.doctor_id === clinicDoctor.id;
    });

    return successResponse(relevantNotifications);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al obtener notificaciones:`, error.message);
    logger.error('Error getting clinic notifications', error);
    return internalErrorResponse('Failed to get notifications');
  }
}
