import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, createReceptionMessageSchema, markReceptionMessagesReadSchema } from '../shared/validators';

// GET /api/clinics/reception/messages
export async function getReceptionMessages(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/reception/messages - Obteniendo mensajes de recepción');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/reception/messages - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Construir filtros
    const where: any = {
      clinic_id: clinic.id,
    };

    // Si se envía doctorId, filtrar solo mensajes con ese médico
    if (queryParams.doctorId) {
      where.doctor_id = queryParams.doctorId;
    }

    // Obtener mensajes
    const messages = await prisma.reception_messages.findMany({
      where,
      include: {
        clinic_doctors: {
          select: {
            id: true,
            name: true,
            user_id: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc', // ⭐ Más antiguos primero
      },
    });

    // Mapear a formato de respuesta
    const messagesData = messages.map((msg) => ({
      id: msg.id,
      clinicId: msg.clinic_id || null,
      doctorId: msg.doctor_id || null,
      doctorName: msg.clinic_doctors?.name || 'Médico', // ⭐ REQUERIDO
      from: msg.sender_type === 'doctor' ? 'doctor' : 'reception', // ⭐ "reception" o "doctor"
      message: msg.message,
      timestamp: msg.created_at?.toISOString() || new Date().toISOString(), // ⭐ Formato ISO
      isRead: msg.is_read ?? false,
      senderName: msg.sender_type === 'doctor' 
        ? (msg.clinic_doctors?.name || 'Médico')
        : (clinic.name || 'Recepción'), // ⭐ Nombre de la clínica o del médico
    }));

    console.log(`✅ [CLINICS] Mensajes obtenidos exitosamente (${messagesData.length} mensajes)`);
    return successResponse(messagesData);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener mensajes:`, error.message);
    logger.error('Error getting reception messages', error);
    return internalErrorResponse('Failed to get reception messages');
  }
}

// POST /api/clinics/reception/messages
export async function createReceptionMessage(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/reception/messages - Enviando mensaje a médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] POST /api/clinics/reception/messages - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, createReceptionMessageSchema);

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Validar que el doctorId pertenezca a la clínica
    const doctor = await prisma.clinic_doctors.findFirst({
      where: {
        id: body.doctorId,
        clinic_id: clinic.id,
        is_active: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado o no pertenece a esta clínica: ${body.doctorId}`);
      return errorResponse('Doctor not found or does not belong to this clinic', 400);
    }

    // Crear mensaje
    const message = await prisma.reception_messages.create({
      data: {
        id: randomUUID(),
        clinic_id: clinic.id,
        doctor_id: doctor.id,
        message: body.message,
        sender_type: 'reception', // ⭐ Siempre "reception" cuando se envía desde clínica
        is_read: false,
      },
      include: {
        clinic_doctors: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`✅ [CLINICS] Mensaje creado exitosamente: ${message.id}`);

    return successResponse({
      id: message.id,
      clinicId: message.clinic_id || null,
      doctorId: message.doctor_id || null,
      doctorName: doctor.name || 'Médico', // ⭐ REQUERIDO
      from: 'reception', // ⭐ Siempre "reception"
      message: message.message,
      timestamp: message.created_at?.toISOString() || new Date().toISOString(),
      isRead: false,
      senderName: clinic.name || 'Recepción Clínica Central', // ⭐ Nombre de la clínica
    }, 201);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al crear mensaje:`, error.message);
    logger.error('Error creating reception message', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to create reception message');
  }
}

// PATCH /api/clinics/reception/messages/read
export async function markReceptionMessagesRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PATCH /api/clinics/reception/messages/read - Marcando mensajes como leídos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PATCH /api/clinics/reception/messages/read - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, markReceptionMessagesReadSchema);

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
      select: {
        id: true,
      },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Validar que todos los mensajes pertenezcan a la clínica
    const messages = await prisma.reception_messages.findMany({
      where: {
        id: { in: body.messageIds },
        clinic_id: clinic.id,
      },
      select: {
        id: true,
      },
    });

    if (messages.length !== body.messageIds.length) {
      console.error(`❌ [CLINICS] Algunos mensajes no pertenecen a esta clínica`);
      return errorResponse('Some messages do not belong to this clinic', 400);
    }

    // Marcar como leídos
    await prisma.reception_messages.updateMany({
      where: {
        id: { in: body.messageIds },
        clinic_id: clinic.id,
      },
      data: {
        is_read: true,
      },
    });

    console.log(`✅ [CLINICS] ${body.messageIds.length} mensajes marcados como leídos`);
    return successResponse({
      success: true,
      message: 'Mensajes marcados como leídos',
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al marcar mensajes como leídos:`, error.message);
    logger.error('Error marking reception messages as read', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to mark messages as read');
  }
}
