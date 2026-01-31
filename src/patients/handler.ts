import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getProfile, updateProfile } from './profile.controller';
import { createAppointment, getAppointments, getAppointmentById, cancelAppointment } from './appointments.controller';
import { getMedicalHistory, getMedicalHistoryById } from './medical-history.controller';
import { getFavorites, addFavorite, removeFavorite } from './favorites.controller';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadCount } from './notifications.controller';
import { getReminders, createReminder, updateReminder, deleteReminder, toggleReminder } from './reminders.controller';
import { requireAuth, AuthContext } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Patients handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // --- Rutas de Perfil ---
    if (path === '/api/patients/profile') {
      if (method === 'GET') return await getProfile(event);
      if (method === 'PUT') return await updateProfile(event);
    }

    // --- Rutas de Citas ---
    if (path === '/api/patients/appointments') {
      if (method === 'GET') return await getAppointments(event);
      if (method === 'POST') return await createAppointment(event);
    }

    // GET /api/patients/appointments/:id
    if (path.startsWith('/api/patients/appointments/') && method === 'GET') {
      return await getAppointmentById(event);
    }

    // DELETE /api/patients/appointments/:id
    if (path.startsWith('/api/patients/appointments/') && method === 'DELETE') {
      return await cancelAppointment(event);
    }

    // --- Rutas de Historial Médico ---
    if (path === '/api/patients/medical-history') {
      if (method === 'GET') return await getMedicalHistory(event);
    }

    // GET /api/patients/medical-history/:id
    if (path.startsWith('/api/patients/medical-history/') && method === 'GET') {
      return await getMedicalHistoryById(event);
    }

    // --- Rutas de Favoritos ---
    if (path === '/api/patients/favorites') {
      if (method === 'GET') return await getFavorites(event);
      if (method === 'POST') return await addFavorite(event);
    }

    // DELETE /api/patients/favorites/:id
    if (path.startsWith('/api/patients/favorites/') && method === 'DELETE') {
      return await removeFavorite(event);
    }

    // --- Rutas de Notificaciones ---
    if (path === '/api/patients/notifications') {
      if (method === 'GET') return await getNotifications(event);
    }

    if (path === '/api/patients/notifications/unread') {
      if (method === 'GET') return await getUnreadCount(event);
    }

    if (path === '/api/patients/notifications/read-all') {
      if (method === 'PUT') return await markAllNotificationsAsRead(event);
    }

    // PUT /api/patients/notifications/:id/read
    if (path.startsWith('/api/patients/notifications/') && path.endsWith('/read') && method === 'PUT') {
      return await markNotificationAsRead(event);
    }

    // --- Rutas de Recordatorios ---
    if (path === '/api/patients/reminders') {
      if (method === 'GET') return await getReminders(event);
      if (method === 'POST') return await createReminder(event);
    }

    // PATCH /api/patients/reminders/{id}
    if (path.startsWith('/api/patients/reminders/') && path.endsWith('/toggle') && method === 'PATCH') {
      return await toggleReminder(event);
    }

    // PATCH /api/patients/reminders/{id} (actualizar)
    if (path.startsWith('/api/patients/reminders/') && !path.endsWith('/toggle') && method === 'PATCH') {
      return await updateReminder(event);
    }

    // DELETE /api/patients/reminders/{id}
    if (path.startsWith('/api/patients/reminders/') && method === 'DELETE') {
      return await deleteReminder(event);
    }

    // Si no coincide ninguna ruta
    return errorResponse('Not found', 404, undefined, event);

  } catch (error: any) {
    console.error(`❌ [PATIENTS] ${method} ${path} - Error:`, error.message);
    logger.error('Error in patients handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error', event);
  }
}
