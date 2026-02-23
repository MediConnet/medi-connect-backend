import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  getAppointments,
  startPaymentProcess,
} from "./appointments.controller";
import { updateDeviceToken } from "./device.controller";
import {
  addFavorite,
  getFavorites,
  removeFavorite,
} from "./favorites.controller";
import {
  getMedicalHistory,
  getMedicalHistoryById,
} from "./medical-history.controller";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notifications.controller";
import { getProfile, updateProfile } from "./profile.controller";
import {
  createReminder,
  deleteReminder,
  getReminders,
  toggleReminder,
  updateReminder,
} from "./reminders.controller";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`\n🔵 [PATIENTS HANDLER] ${method} ${path} - Handler invocado`);
  logger.info("Patients handler invoked", { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    // --- Rutas de Perfil ---
    if (path === "/api/patients/profile") {
      if (method === "GET") return await getProfile(event);
      if (method === "PUT") return await updateProfile(event);
    }

    // --- Rutas de Citas ---
    // 1. Rutas específicas (Bloqueo para Pago)
    if (
      path.startsWith("/api/patients/appointments/") &&
      path.endsWith("/lock") &&
      method === "POST"
    ) {
      return await startPaymentProcess(event);
    }

    // 2. Rutas por ID (Detalle y Cancelar)
    if (path.startsWith("/api/patients/appointments/")) {
      if (method === "GET") return await getAppointmentById(event);
      if (method === "DELETE") return await cancelAppointment(event);
    }

    // 3. Rutas generales (Listar y Crear)
    if (path === "/api/patients/appointments") {
      if (method === "GET") return await getAppointments(event);
      if (method === "POST") return await createAppointment(event);
    }

    // --- Rutas de Historial Médico ---
    if (path.startsWith("/api/patients/medical-history/") && method === "GET") {
      return await getMedicalHistoryById(event);
    }
    if (path === "/api/patients/medical-history") {
      if (method === "GET") return await getMedicalHistory(event);
    }

    // --- Rutas de Favoritos ---
    // DELETE /api/patients/favorites/:id
    if (path.startsWith("/api/patients/favorites/") && method === "DELETE") {
      return await removeFavorite(event);
    }

    // GET / POST /api/patients/favorites
    if (path === "/api/patients/favorites") {
      if (method === "GET") return await getFavorites(event);
      if (method === "POST") return await addFavorite(event);
    }

    // --- Rutas de Notificaciones ---
    if (path === "/api/patients/notifications/unread") {
      if (method === "GET") return await getUnreadCount(event);
    }
    if (path === "/api/patients/notifications/read-all") {
      if (method === "PUT") return await markAllNotificationsAsRead(event);
    }
    if (
      path.startsWith("/api/patients/notifications/") &&
      path.endsWith("/read") &&
      method === "PUT"
    ) {
      return await markNotificationAsRead(event);
    }
    if (path === "/api/patients/notifications") {
      if (method === "GET") return await getNotifications(event);
    }

    // --- Rutas de Recordatorios ---
    if (
      path.startsWith("/api/patients/reminders/") &&
      path.endsWith("/toggle") &&
      method === "PATCH"
    ) {
      return await toggleReminder(event);
    }
    if (
      path.startsWith("/api/patients/reminders/") &&
      !path.endsWith("/toggle") &&
      method === "PATCH"
    ) {
      return await updateReminder(event);
    }
    if (path.startsWith("/api/patients/reminders/") && method === "DELETE") {
      return await deleteReminder(event);
    }
    if (path === "/api/patients/reminders") {
      if (method === "GET") return await getReminders(event);
      if (method === "POST") return await createReminder(event);
    }

    // --- Rutas de Dispositivo (Token Push) ---
    if (path === "/api/patients/device/token" && method === "PUT") {
      return await updateDeviceToken(event);
    }

    // Si no coincide ninguna ruta
    console.log(`❌ [PATIENTS HANDLER] Ruta no encontrada: ${method} ${path}`);
    return errorResponse("Not found", 404, undefined, event);
  } catch (error: any) {
    console.error(`❌ [PATIENTS] ${method} ${path} - Error:`, error.message);
    logger.error("Error in patients handler", error, { method, path });
    return internalErrorResponse(
      error.message || "Internal server error",
      event,
    );
  }
}
