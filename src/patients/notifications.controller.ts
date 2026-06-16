import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  paginatedResponse,
  successResponse,
} from "../shared/response";
import { extractIdFromPath } from "../shared/validators";

// --- GET NOTIFICATIONS ---
export async function getNotifications(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] GET /api/patients/notifications - Obteniendo notificaciones",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
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
      console.log(
        "⚠️ [PATIENTS] Paciente no encontrado, retornando array vacío",
      );
      return successResponse([]);
    }

    const queryParams = event.queryStringParameters || {};
    const unreadOnly = queryParams.unread === "true";
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;

    const where: any = { patient_id: patient.id };
    if (unreadOnly) {
      where.is_read = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: {
          created_at: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.notifications.count({ where }),
    ]);

    console.log(
      `✅ [PATIENTS] Se encontraron ${notifications.length} notificaciones`,
    );

    const formattedNotifications = notifications.map((notif) => ({
      id: notif.id,
      type: notif.type || "general",
      title: notif.title || "",
      body: notif.body || "",
      is_read: notif.is_read || false,
      data: notif.data || {},
      created_at: notif.created_at || new Date(),
    }));

    return paginatedResponse(formattedNotifications, total, page, limit, 200, event);
  } catch (error: any) {
    console.error(
      "❌ [PATIENTS] Error al obtener notificaciones:",
      error.message,
    );
    logger.error("Error getting notifications", error);

    const errorMessage = error.message || "Failed to get notifications";
    return internalErrorResponse(errorMessage, event);
  }
}

// --- GET UNREAD COUNT ---
export async function getUnreadCount(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] GET /api/patients/notifications/unread - Obteniendo contador de no leídas",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
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
    console.error("❌ [PATIENTS] Error al obtener contador:", error.message);
    logger.error("Error getting unread count", error);
    return internalErrorResponse("Failed to get unread count");
  }
}

// --- MARK AS READ ---
export async function markNotificationAsRead(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] PUT /api/patients/notifications/:id/read - Marcando como leída",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const notificationId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/notifications/",
      "/read",
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse("Patient not found", 404);
    }

    // Buscar la notificación
    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return errorResponse("Notification not found", 404);
    }

    // Verificar que la notificación pertenece al paciente
    if (notification.patient_id !== patient.id) {
      return errorResponse("Access denied", 403);
    }

    // Marcar como leída
    await prisma.notifications.update({
      where: { id: notificationId },
      data: {
        is_read: true,
      },
    });

    console.log("✅ [PATIENTS] Notificación marcada como leída");
    return successResponse({
      message: "Notification marked as read",
    });
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al marcar como leída:", error.message);
    logger.error("Error marking notification as read", error);
    if (error.message.includes("Invalid path format")) {
      return errorResponse("Invalid notification ID", 400);
    }
    return internalErrorResponse("Failed to mark notification as read");
  }
}

// --- MARK ALL AS READ ---
export async function markAllNotificationsAsRead(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] PUT /api/patients/notifications/read-all - Marcando todas como leídas",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
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
      return errorResponse("Patient not found", 404);
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

    console.log(
      `✅ [PATIENTS] ${result.count} notificaciones marcadas como leídas`,
    );
    return successResponse({
      count: result.count,
      message: "All notifications marked as read",
    });
  } catch (error: any) {
    console.error(
      "❌ [PATIENTS] Error al marcar todas como leídas:",
      error.message,
    );
    logger.error("Error marking all notifications as read", error);
    return internalErrorResponse("Failed to mark all notifications as read");
  }
}

// --- CLEAR ALL NOTIFICATIONS ---
export async function clearAllNotifications(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] DELETE /api/patients/notifications - Borrando todas las notificaciones",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
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
      return errorResponse("Patient not found", 404);
    }

    // Borrar todas las notificaciones
    const result = await prisma.notifications.deleteMany({
      where: {
        patient_id: patient.id,
      },
    });

    console.log(
      `✅ [PATIENTS] ${result.count} notificaciones eliminadas`,
    );
    return successResponse({
      count: result.count,
      message: "All notifications cleared successfully",
    });
  } catch (error: any) {
    console.error(
      "❌ [PATIENTS] Error al borrar notificaciones:",
      error.message,
    );
    logger.error("Error clearing notifications", error);
    return internalErrorResponse("Failed to clear notifications");
  }
}

// --- DELETE SINGLE NOTIFICATION ---
export async function deleteNotification(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] DELETE /api/patients/notifications/:id - Eliminando notificación",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const notificationId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/notifications/",
      ""
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse("Patient not found", 404);
    }

    // Buscar la notificación
    const notification = await prisma.notifications.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return errorResponse("Notification not found", 404);
    }

    // Verificar que pertenece al paciente
    if (notification.patient_id !== patient.id) {
      return errorResponse("Access denied", 403);
    }

    // Eliminar la notificación
    await prisma.notifications.delete({
      where: { id: notificationId },
    });

    console.log(`✅ [PATIENTS] Notificación ${notificationId} eliminada`);
    return successResponse({
      message: "Notification deleted successfully",
    });
  } catch (error: any) {
    console.error(
      "❌ [PATIENTS] Error al eliminar notificación:",
      error.message,
    );
    logger.error("Error deleting notification", error);
    if (error.message.includes("Invalid path format")) {
      return errorResponse("Invalid notification ID", 400);
    }
    return internalErrorResponse("Failed to delete notification");
  }
}


