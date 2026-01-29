import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';

// GET /api/clinics/notifications
export async function getClinicNotifications(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/notifications - Obteniendo notificaciones de clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/notifications - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit || '50', 10);
    const unreadOnly = queryParams.unreadOnly === 'true';

    const where: any = { clinic_id: clinic.id };
    if (unreadOnly) {
      where.is_read = false;
    }

    const notifications = await prisma.clinic_notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    console.log(`✅ [CLINICS] Notificaciones obtenidas: ${notifications.length}`);
    return successResponse(notifications);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener notificaciones:`, error.message);
    logger.error('Error getting clinic notifications', error);
    return internalErrorResponse('Failed to get notifications');
  }
}

// GET /api/clinics/notifications/unread-count
export async function getUnreadCount(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/notifications/unread-count - Obteniendo conteo de no leídas');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    const count = await prisma.clinic_notifications.count({
      where: {
        clinic_id: clinic.id,
        is_read: false,
      },
    });

    return successResponse({ count });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener conteo de no leídas:`, error.message);
    logger.error('Error getting unread count', error);
    return internalErrorResponse('Failed to get unread count');
  }
}

// PATCH /api/clinics/notifications/:id/read
export async function markNotificationAsRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PATCH /api/clinics/notifications/{id}/read - Marcando notificación como leída');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const notificationId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/notifications/', '/read');

    // Verificar que la notificación pertenece a la clínica del usuario
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    const notification = await prisma.clinic_notifications.findFirst({
      where: {
        id: notificationId,
        clinic_id: clinic.id,
      },
    });

    if (!notification) {
      return notFoundResponse('Notification not found');
    }

    const updated = await prisma.clinic_notifications.update({
      where: { id: notificationId },
      data: { is_read: true },
    });

    console.log(`✅ [CLINICS] Notificación marcada como leída: ${notificationId}`);
    return successResponse({
      id: updated.id,
      is_read: updated.is_read,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al marcar notificación como leída:`, error.message);
    logger.error('Error marking notification as read', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid notification ID', 400);
    }
    return internalErrorResponse('Failed to mark notification as read');
  }
}

// PATCH /api/clinics/notifications/read-all
export async function markAllAsRead(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PATCH /api/clinics/notifications/read-all - Marcando todas como leídas');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    const result = await prisma.clinic_notifications.updateMany({
      where: {
        clinic_id: clinic.id,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });

    console.log(`✅ [CLINICS] ${result.count} notificaciones marcadas como leídas`);
    return successResponse({
      count: result.count,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al marcar todas como leídas:`, error.message);
    logger.error('Error marking all as read', error);
    return internalErrorResponse('Failed to mark all as read');
  }
}
