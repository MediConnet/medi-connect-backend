import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { AuthContext, requireAuth } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';

// --- GET NOTIFICATIONS ---
export async function getNotifications(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] GET /api/patients/notifications - Obteniendo notificaciones');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
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
    const unreadOnly = queryParams.unread === 'true';
    const limit = parseInt(queryParams.limit || '50', 10);
    const offset = parseInt(queryParams.offset || '0', 10);

    // Construir filtro
    const where: any = { patient_id: patient.id };
    if (unreadOnly) {
      where.is_read = false;
    }

    // Obtener notificaciones
    const notifications = await prisma.notifications.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    });

    console.log(`✅ [PATIENTS] Se encontraron ${notifications.length} notificaciones`);
    
    // Transformar notificaciones de forma segura
    const formattedNotifications = notifications.map(notif => {
      try {
        return {
          id: notif.id,
          type: notif.type || 'general',
          title: notif.title || '',
          body: notif.body || '',
          isRead: notif.is_read || false,
          data: notif.data || {},
          createdAt: notif.created_at || new Date(),
        };
      } catch (mapError: any) {
        console.error('❌ [PATIENTS] Error mapeando notificación:', mapError.message);
        return {
          id: notif.id,
          type: 'general',
          title: 'Notificación',
          body: '',
          isRead: false,
          data: {},
          createdAt: new Date(),
        };
      }
    });
    
    return successResponse(formattedNotifications, 200, event);
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al obtener notificaciones:', error.message);
    console.error('❌ [PATIENTS] Stack completo:', error.stack);
    logger.error('Error getting notifications', error);
    
    // Retornar error más descriptivo
    const errorMessage = error.message || 'Failed to get notifications';
    return internalErrorResponse(errorMessage, event);
  }
}

// --- GET UNREAD COUNT ---
export async function getUnreadCount(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] GET /api/patients/notifications/unread - Obteniendo contador de no leídas');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
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
      return successResponse({ count: 0 });
    }

    // Contar notificaciones no leídas
    const count = await prisma.notifications.count({
      where: {
        patient_id: patient.id,
        is_read: false,
      },
    });

    console.log(`✅ [PATIENTS] Hay ${count} notificaciones no leídas`);
    return successResponse({ count });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al obtener contador:', error.message);
    logger.error('Error getting unread count', error);
    return internalErrorResponse('Failed to get unread count');
  }
}

// --- MARK AS READ ---
export async function markNotificationAsRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] PUT /api/patients/notifications/:id/read - Marcando como leída');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const notificationId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/patients/notifications/',
      '/read'
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse('Patient not found', 404);
    }

    // Buscar la notificación
    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return errorResponse('Notification not found', 404);
    }

    // Verificar que la notificación pertenece al paciente
    if (notification.patient_id !== patient.id) {
      return errorResponse('Access denied', 403);
    }

    // Marcar como leída
    await prisma.notifications.update({
      where: { id: notificationId },
      data: {
        is_read: true,
      },
    });

    console.log('✅ [PATIENTS] Notificación marcada como leída');
    return successResponse({
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al marcar como leída:', error.message);
    logger.error('Error marking notification as read', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid notification ID', 400);
    }
    return internalErrorResponse('Failed to mark notification as read');
  }
}

// --- MARK ALL AS READ ---
export async function markAllNotificationsAsRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] PUT /api/patients/notifications/read-all - Marcando todas como leídas');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
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
      return errorResponse('Patient not found', 404);
    }

    // Marcar todas como leídas
    const result = await prisma.notifications.updateMany({
      where: {
        patient_id: patient.id,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });

    console.log(`✅ [PATIENTS] ${result.count} notificaciones marcadas como leídas`);
    return successResponse({
      count: result.count,
      message: 'All notifications marked as read',
    });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al marcar todas como leídas:', error.message);
    logger.error('Error marking all notifications as read', error);
    return internalErrorResponse('Failed to mark all notifications as read');
  }
}
