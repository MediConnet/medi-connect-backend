import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse } from '../shared/response';
import { requireAuth, AuthContext } from '../shared/auth';
import { randomUUID } from 'crypto';

/**
 * GET /api/doctors/clinic-info
 * Obtener información básica de la clínica a la que está asociado el médico
 */
export async function getClinicInfo(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
      include: {
        clinics: true,
      },
    });

    if (!doctorAssociation || !doctorAssociation.clinics) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const clinic = doctorAssociation.clinics;

    return successResponse({
      id: clinic.id,
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      whatsapp: clinic.whatsapp,
      logoUrl: clinic.logo_url,
    });
  } catch (error: any) {
    console.error('Error getting clinic info:', error);
    return errorResponse(error.message || 'Error al obtener información de la clínica', 500);
  }
}

/**
 * GET /api/doctors/clinic/profile
 * Obtener perfil profesional del médico asociado a una clínica
 */
export async function getClinicProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
      include: {
        clinics: true,
      },
    });

    if (!doctorAssociation || !doctorAssociation.clinics) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const clinic = doctorAssociation.clinics;

    return successResponse({
      id: doctorAssociation.id,
      clinicId: clinic.id,
      clinicInfo: {
        id: clinic.id,
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone,
        whatsapp: clinic.whatsapp,
        logoUrl: clinic.logo_url,
      },
      specialty: doctorAssociation.specialty,
      experience: doctorAssociation.experience,
      bio: doctorAssociation.bio,
      education: doctorAssociation.education,
      certifications: doctorAssociation.certifications,
      profileImageUrl: doctorAssociation.profile_image_url,
      phone: doctorAssociation.phone,
      whatsapp: doctorAssociation.whatsapp,
      email: doctorAssociation.email,
    });
  } catch (error: any) {
    console.error('Error getting clinic profile:', error);
    return errorResponse(error.message || 'Error al obtener perfil', 500);
  }
}

/**
 * PUT /api/doctors/clinic/profile
 * Actualizar perfil profesional del médico asociado
 */
export async function updateClinicProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const body = JSON.parse(event.body || '{}');
    const { specialty, experience, bio, education, certifications, phone, whatsapp } = body;

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const updated = await prisma.clinic_doctors.update({
      where: { id: doctorAssociation.id },
      data: {
        specialty,
        bio,
        education,
        certifications,
        phone,
        whatsapp,
        updated_at: new Date(),
      },
      include: {
        clinics: true,
      },
    });

    if (!updated.clinics) {
      return errorResponse('Error al obtener información de la clínica', 500);
    }

    const clinic = updated.clinics;

    return successResponse({
      id: updated.id,
      clinicId: clinic.id,
      clinicInfo: {
        id: clinic.id,
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone,
        whatsapp: clinic.whatsapp,
        logoUrl: clinic.logo_url,
      },
      specialty: updated.specialty,
      experience: updated.experience,
      bio: updated.bio,
      education: updated.education,
      certifications: updated.certifications,
      profileImageUrl: updated.profile_image_url,
      phone: updated.phone,
      whatsapp: updated.whatsapp,
      email: updated.email,
    });
  } catch (error: any) {
    console.error('Error updating clinic profile:', error);
    return errorResponse(error.message || 'Error al actualizar perfil', 500);
  }
}

/**
 * GET /api/doctors/clinic/appointments
 * Obtener citas confirmadas del médico asociado (sin información financiera)
 */
export async function getClinicAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return successResponse([]);
    }

    const appointments = await prisma.appointments.findMany({
      where: {
        provider_id: provider.id,
        clinic_id: doctorAssociation.clinic_id,
        status: {
          in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'],
        },
      },
      include: {
        patients: true,
      },
      orderBy: [
        { scheduled_for: 'asc' },
      ],
    });

    const formattedAppointments = appointments.map((apt) => {
      const scheduledFor = apt.scheduled_for ? new Date(apt.scheduled_for) : null;
      
      return {
        id: apt.id,
        patientId: apt.patient_id,
        patientName: apt.patients?.full_name || 'Paciente',
        patientPhone: apt.patients?.phone || '',
        date: scheduledFor ? scheduledFor.toISOString().split('T')[0] : '',
        time: scheduledFor ? scheduledFor.toTimeString().slice(0, 5) : '',
        reason: apt.reason || 'Consulta general',
        status: apt.status,
      };
    });

    return successResponse(formattedAppointments);
  } catch (error: any) {
    console.error('Error getting clinic appointments:', error);
    return errorResponse(error.message || 'Error al obtener citas', 500);
  }
}

/**
 * PATCH /api/doctors/clinic/appointments/:appointmentId/status
 * Actualizar estado de cita (marcar como atendida o no asistió)
 */
export async function updateClinicAppointmentStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const appointmentId = event.pathParameters?.appointmentId;
    if (!appointmentId) {
      return errorResponse('ID de cita requerido', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { status } = body;

    if (!status || !['COMPLETED', 'NO_SHOW'].includes(status)) {
      return errorResponse('Estado inválido. Debe ser COMPLETED o NO_SHOW', 400);
    }

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    const appointment = await prisma.appointments.findFirst({
      where: {
        id: appointmentId,
        provider_id: provider.id,
        clinic_id: doctorAssociation.clinic_id,
      },
    });

    if (!appointment) {
      return errorResponse('Cita no encontrada o no tienes permiso para modificarla', 404);
    }

    const updated = await prisma.appointments.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        patients: true,
      },
    });

    const scheduledFor = updated.scheduled_for ? new Date(updated.scheduled_for) : null;

    return successResponse({
      id: updated.id,
      patientId: updated.patient_id,
      patientName: updated.patients?.full_name || 'Paciente',
      patientPhone: updated.patients?.phone || '',
      date: scheduledFor ? scheduledFor.toISOString().split('T')[0] : '',
      time: scheduledFor ? scheduledFor.toTimeString().slice(0, 5) : '',
      reason: updated.reason || 'Consulta general',
      status: updated.status,
    });
  } catch (error: any) {
    console.error('Error updating appointment status:', error);
    return errorResponse(error.message || 'Error al actualizar estado de cita', 500);
  }
}

/**
 * GET /api/doctors/clinic/reception/messages
 * Obtener mensajes entre el médico y la recepción de la clínica
 */
export async function getReceptionMessages(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const messages = await prisma.reception_messages.findMany({
      where: {
        doctor_id: doctorAssociation.id,
      },
      include: {
        clinics: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      clinicId: msg.clinic_id,
      doctorId: msg.doctor_id,
      from: msg.sender_type,
      message: msg.message,
      timestamp: msg.created_at,
      isRead: msg.is_read,
      senderName: msg.sender_type === 'reception' 
        ? `Recepción ${msg.clinics?.name || 'Clínica'}` 
        : doctorAssociation.name || 'Doctor',
    }));

    return successResponse(formattedMessages);
  } catch (error: any) {
    console.error('Error getting reception messages:', error);
    return errorResponse(error.message || 'Error al obtener mensajes', 500);
  }
}

/**
 * POST /api/doctors/clinic/reception/messages
 * Enviar mensaje a la recepción de la clínica
 */
export async function createReceptionMessage(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const body = JSON.parse(event.body || '{}');
    const { message } = body;

    if (!message || message.trim() === '') {
      return errorResponse('El mensaje no puede estar vacío', 400);
    }

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
      include: {
        clinics: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const newMessage = await prisma.reception_messages.create({
      data: {
        id: randomUUID(),
        clinic_id: doctorAssociation.clinic_id,
        doctor_id: doctorAssociation.id,
        message: message.trim(),
        sender_type: 'doctor',
        is_read: false,
        created_at: new Date(),
      },
      include: {
        clinics: true,
      },
    });

    return successResponse({
      id: newMessage.id,
      clinicId: newMessage.clinic_id,
      doctorId: newMessage.doctor_id,
      from: newMessage.sender_type,
      message: newMessage.message,
      timestamp: newMessage.created_at,
      isRead: newMessage.is_read,
      senderName: doctorAssociation.name || 'Doctor',
    });
  } catch (error: any) {
    console.error('Error sending reception message:', error);
    return errorResponse(error.message || 'Error al enviar mensaje', 500);
  }
}

/**
 * PATCH /api/doctors/clinic/reception/messages/read
 * Marcar mensajes como leídos
 */
export async function markReceptionMessagesAsRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const body = JSON.parse(event.body || '{}');
    const { messageIds } = body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return errorResponse('Debe proporcionar al menos un ID de mensaje', 400);
    }

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    await prisma.reception_messages.updateMany({
      where: {
        id: { in: messageIds },
        doctor_id: doctorAssociation.id,
      },
      data: {
        is_read: true,
      },
    });

    return successResponse({ success: true });
  } catch (error: any) {
    console.error('Error marking messages as read:', error);
    return errorResponse(error.message || 'Error al marcar mensajes como leídos', 500);
  }
}

/**
 * GET /api/doctors/clinic/date-blocks
 * Obtener solicitudes de bloqueo de fechas del médico
 */
export async function getDateBlocks(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const dateBlocks = await prisma.date_block_requests.findMany({
      where: {
        doctor_id: doctorAssociation.id,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedBlocks = dateBlocks.map((block) => ({
      id: block.id,
      doctorId: block.doctor_id,
      clinicId: block.clinic_id,
      startDate: block.date.toISOString().split('T')[0],
      endDate: block.date.toISOString().split('T')[0],
      reason: block.reason,
      status: block.status,
      createdAt: block.created_at,
      reviewedAt: block.updated_at,
      reviewedBy: null,
      rejectionReason: null,
    }));

    return successResponse(formattedBlocks);
  } catch (error: any) {
    console.error('Error getting date blocks:', error);
    return errorResponse(error.message || 'Error al obtener bloqueos de fechas', 500);
  }
}

/**
 * POST /api/doctors/clinic/date-blocks/request
 * Solicitar bloqueo de fechas
 */
export async function requestDateBlock(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const body = JSON.parse(event.body || '{}');
    const { startDate, endDate, reason } = body;

    if (!startDate || !endDate) {
      return errorResponse('Las fechas de inicio y fin son requeridas', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return errorResponse('La fecha de inicio debe ser anterior a la fecha de fin', 400);
    }

    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
    });

    if (!doctorAssociation) {
      return errorResponse('No estás asociado a ninguna clínica', 404);
    }

    const dateBlock = await prisma.date_block_requests.create({
      data: {
        id: randomUUID(),
        clinic_id: doctorAssociation.clinic_id,
        doctor_id: doctorAssociation.id,
        date: start,
        reason: reason || 'Sin especificar',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return successResponse({
      id: dateBlock.id,
      doctorId: dateBlock.doctor_id,
      clinicId: dateBlock.clinic_id,
      startDate: startDate,
      endDate: endDate,
      reason: dateBlock.reason,
      status: dateBlock.status,
      createdAt: dateBlock.created_at,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });
  } catch (error: any) {
    console.error('Error requesting date block:', error);
    return errorResponse(error.message || 'Error al solicitar bloqueo de fechas', 500);
  }
}

/**
 * GET /api/doctors/clinic/notifications
 * Obtener notificaciones del médico asociado
 */
export async function getClinicNotifications(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    // Por ahora retornamos un array vacío
    // Se puede implementar una tabla específica para notificaciones de médicos asociados
    return successResponse([]);
  } catch (error: any) {
    console.error('Error getting clinic notifications:', error);
    return errorResponse(error.message || 'Error al obtener notificaciones', 500);
  }
}
