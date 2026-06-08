import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, paginatedResponse, successResponse } from '../shared/response';
import { parseBody, createReceptionMessageSchema, markReceptionMessagesReadSchema } from '../shared/validators';
import { resolveClinicForAuthUser } from '../clinics/clinic-context';

// GET /api/clinics/reception/messages
export async function getReceptionMessages(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] GET /api/association/reception/messages - Obteniendo mensajes de recepción');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [ASSOCIATION] GET /api/association/reception/messages - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      console.error('❌ [ASSOCIATION] Clínica no encontrada');
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

    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;

    const total = await prisma.reception_messages.count({ where });

    // Obtener mensajes
    const messages = await prisma.reception_messages.findMany({
      where,
      include: {
        clinic_doctors: {
          select: {
            id: true,
            user_id: true,
          },
        },
      },
      orderBy: {
        created_at: 'asc', // ⭐ Más antiguos primero
      },
      skip: offset,
      take: limit,
    });

    // Obtener nombres de doctores desde providers
    const doctorUserIds = messages
      .map(m => m.clinic_doctors?.user_id)
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

    // Mapear a formato de respuesta
    const messagesData = messages.map((msg) => {
      const doctorName = msg.clinic_doctors?.user_id 
        ? providerNameMap.get(msg.clinic_doctors.user_id) || 'Médico'
        : 'Médico';
      
      return {
        id: msg.id,
        clinicId: msg.clinic_id || null,
        doctorId: msg.doctor_id || null,
        doctorName: doctorName, // ⭐ REQUERIDO
        from: msg.sender_type === 'doctor' ? 'doctor' : 'reception', // ⭐ "reception" o "doctor"
        message: msg.message,
        timestamp: msg.created_at?.toISOString() || new Date().toISOString(), // ⭐ Formato ISO
        isRead: msg.is_read ?? false,
        senderName: msg.sender_type === 'doctor' 
          ? doctorName
          : (clinic.name || 'Recepción'), // ⭐ Nombre de la clínica o del médico
      };
    });

    console.log(`✅ [ASSOCIATION] Mensajes obtenidos exitosamente (${messagesData.length} mensajes, total: ${total})`);
    return paginatedResponse(messagesData, total, page, limit);
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al obtener mensajes:`, error.message);
    logger.error('Error getting reception messages', error);
    return internalErrorResponse('Failed to get reception messages');
  }
}

// POST /api/clinics/reception/messages
export async function createReceptionMessage(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] POST /api/association/reception/messages - Enviando mensaje a médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [ASSOCIATION] POST /api/association/reception/messages - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, createReceptionMessageSchema);

    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      console.error('❌ [ASSOCIATION] Clínica no encontrada');
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
        user_id: true,
      },
    });

    if (!doctor) {
      console.error(`❌ [ASSOCIATION] Médico no encontrado o no pertenece a esta clínica: ${body.doctorId}`);
      return errorResponse('Doctor not found or does not belong to this clinic', 400);
    }

    // Obtener nombre del doctor desde provider
    let doctorName = 'Médico';
    if (doctor.user_id) {
      const provider = await prisma.providers.findFirst({
        where: { user_id: doctor.user_id },
        select: { commercial_name: true }
      });
      doctorName = provider?.commercial_name || 'Médico';
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
    });

    console.log(`✅ [ASSOCIATION] Mensaje creado exitosamente: ${message.id}`);

    return successResponse({
      id: message.id,
      clinicId: message.clinic_id || null,
      doctorId: message.doctor_id || null,
      doctorName: doctorName, // ⭐ REQUERIDO
      from: 'reception', // ⭐ Siempre "reception"
      message: message.message,
      timestamp: message.created_at?.toISOString() || new Date().toISOString(),
      isRead: false,
      senderName: clinic.name || 'Recepción Clínica Central', // ⭐ Nombre de la clínica
    }, 201);
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al crear mensaje:`, error.message);
    logger.error('Error creating reception message', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to create reception message');
  }
}

// PATCH /api/clinics/reception/messages/read
export async function markReceptionMessagesRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ASSOCIATION] PATCH /api/association/reception/messages/read - Marcando mensajes como leídos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [ASSOCIATION] PATCH /api/association/reception/messages/read - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, markReceptionMessagesReadSchema);

    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      console.error('❌ [ASSOCIATION] Clínica no encontrada');
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
      console.error(`❌ [ASSOCIATION] Algunos mensajes no pertenecen a esta clínica`);
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

    console.log(`✅ [ASSOCIATION] ${body.messageIds.length} mensajes marcados como leídos`);
    return successResponse({
      success: true,
      message: 'Mensajes marcados como leídos',
    });
  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] Error al marcar mensajes como leídos:`, error.message);
    logger.error('Error marking reception messages as read', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to mark messages as read');
  }
}
