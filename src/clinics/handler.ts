import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getProfile, updateProfile, uploadLogo } from './profile.controller';
import { getDashboard } from './dashboard.controller';
import { getDoctors, updateDoctorStatus, updateDoctorOffice, deleteDoctor, getDoctorProfile } from './doctors.controller';
import { validateInvitation, acceptInvitation, rejectInvitation, sendInvitation, generateInvitationLink } from './invitations.controller';
import { getAppointments, updateAppointmentStatus, getTodayReception, updateReceptionStatus } from './appointments.controller';
import { getDoctorSchedule, updateDoctorSchedule } from './schedules.controller';
import { getClinicSchedule, updateClinicSchedule } from './clinic-schedules.controller';
import { getClinicNotifications, getUnreadCount, markNotificationAsRead, markAllAsRead } from './notifications.controller';
import { getReceptionMessages, createReceptionMessage, markReceptionMessagesRead } from './reception-messages.controller';
import { getClinicPayments, getClinicPaymentDetail, distributePayment, getDoctorPayments, payDoctor, getPaymentDistribution } from './payments.controller';
import { extractIdFromPath } from '../shared/validators';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`🔍 [CLINICS HANDLER] Método: ${method}, Path: ${path}`);
  logger.info('Clinics handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    console.log(`🔍 [CLINICS HANDLER] Comparando path: "${path}"`);
    
    // --- Rutas de Perfil ---
    if (path === '/api/clinics/profile') {
      console.log(`✅ [CLINICS HANDLER] Ruta de perfil encontrada`);
      if (method === 'GET') return await getProfile(event);
      if (method === 'PUT') return await updateProfile(event);
    }

    // --- Rutas de Horarios de Clínica ---
    if (path === '/api/clinics/schedule') {
      console.log(`✅ [CLINICS HANDLER] Ruta de schedule de clínica encontrada`);
      if (method === 'GET') return await getClinicSchedule(event);
      if (method === 'PUT') return await updateClinicSchedule(event);
    }

    // --- Ruta de Subida de Logo ---
    if (path === '/api/clinics/upload-logo') {
      console.log(`✅ [CLINICS HANDLER] Ruta de upload-logo encontrada`);
      if (method === 'POST') return await uploadLogo(event);
    }

    // --- Rutas de Dashboard ---
    if (path === '/api/clinics/dashboard') {
      console.log(`✅ [CLINICS HANDLER] Ruta de dashboard encontrada`);
      if (method === 'GET') return await getDashboard(event);
    }

    // --- Rutas de Médicos ---
    if (path === '/api/clinics/doctors') {
      console.log(`✅ [CLINICS HANDLER] Ruta de médicos encontrada`);
      if (method === 'GET') return await getDoctors(event);
    }

    // --- Rutas de Invitación de Médicos ---
    // POST /api/clinics/invitations (nueva ruta)
    if (path === '/api/clinics/invitations') {
      console.log(`✅ [CLINICS HANDLER] Ruta de invitations encontrada`);
      if (method === 'POST') return await sendInvitation(event);
    }

    // Soporta ambas rutas para compatibilidad con frontend
    if (path === '/api/clinics/invite' || path === '/api/clinics/doctors/invite/link') {
      if (method === 'POST') return await generateInvitationLink(event);
    }

    if (path === '/api/clinics/doctors/invite') {
      if (method === 'POST') return await sendInvitation(event);
    }

    // --- Rutas de Estado de Médico ---
    if (path.startsWith('/api/clinics/doctors/') && path.endsWith('/status')) {
      if (method === 'PATCH') return await updateDoctorStatus(event);
    }

    // --- Rutas de Consultorio de Médico ---
    if (path.startsWith('/api/clinics/doctors/') && path.endsWith('/office')) {
      if (method === 'PATCH') return await updateDoctorOffice(event);
    }

    // --- Rutas de Eliminación de Médico ---
    if (path.startsWith('/api/clinics/doctors/') && 
        !path.includes('/status') && 
        !path.includes('/office') && 
        !path.includes('/schedule') && 
        !path.includes('/invite')) {
      if (method === 'DELETE') return await deleteDoctor(event);
    }

    // --- Rutas de Horarios de Médico ---
    if (path.startsWith('/api/clinics/doctors/') && path.endsWith('/schedule')) {
      if (method === 'GET') return await getDoctorSchedule(event);
      if (method === 'PUT') return await updateDoctorSchedule(event);
    }

    // --- Rutas de Perfil de Médico ---
    if (path.startsWith('/api/clinics/doctors/') && path.endsWith('/profile')) {
      if (method === 'GET') return await getDoctorProfile(event);
    }

    // --- Rutas de Invitaciones (públicas) ---
    if (path.startsWith('/api/clinics/invite/') && path.endsWith('/accept')) {
      if (method === 'POST') {
        return await acceptInvitation(event);
      }
    }

    if (path.startsWith('/api/clinics/invite/') && path.endsWith('/reject')) {
      if (method === 'POST') {
        return await rejectInvitation(event);
      }
    }

    if (path.startsWith('/api/clinics/invite/')) {
      if (method === 'GET') return await validateInvitation(event);
    }

    // --- Rutas de Citas ---
    if (path === '/api/clinics/appointments' || path.startsWith('/api/clinics/appointments?')) {
      console.log(`✅ [CLINICS HANDLER] Ruta de citas encontrada`);
      if (method === 'GET') return await getAppointments(event);
    }

    // --- Rutas de Estado de Cita ---
    if (path.startsWith('/api/clinics/appointments/') && path.endsWith('/status')) {
      if (method === 'PATCH') return await updateAppointmentStatus(event);
    }

    // --- Rutas de Recepción ---
    if (path === '/api/clinics/reception/today') {
      console.log(`✅ [CLINICS HANDLER] Ruta de recepción encontrada`);
      if (method === 'GET') return await getTodayReception(event);
    }

    // --- Rutas de Estado de Recepción ---
    if (path.startsWith('/api/clinics/appointments/') && path.endsWith('/reception')) {
      if (method === 'PATCH') return await updateReceptionStatus(event);
    }

    // --- Rutas de Mensajes de Recepción ---
    if (path === '/api/clinics/reception/messages' || (path.startsWith('/api/clinics/reception/messages') && path.includes('?'))) {
      if (method === 'GET') return await getReceptionMessages(event);
      if (method === 'POST') return await createReceptionMessage(event);
    }

    if (path === '/api/clinics/reception/messages/read') {
      if (method === 'PATCH') return await markReceptionMessagesRead(event);
    }

    // --- Rutas de Notificaciones ---
    if (path === '/api/clinics/notifications') {
      if (method === 'GET') return await getClinicNotifications(event);
    }

    if (path === '/api/clinics/notifications/unread-count') {
      if (method === 'GET') return await getUnreadCount(event);
    }

    if (path === '/api/clinics/notifications/read-all') {
      if (method === 'PATCH') return await markAllAsRead(event);
    }

    if (path.startsWith('/api/clinics/notifications/') && path.endsWith('/read')) {
      if (method === 'PATCH') return await markNotificationAsRead(event);
    }

    // --- Rutas de Pagos ---
    // IMPORTANTE: Las rutas más específicas deben ir ANTES de las generales
    
    // Ruta: POST /api/clinics/payments/:id/distribute
    if (path.startsWith('/api/clinics/payments/') && path.endsWith('/distribute')) {
      if (method === 'POST') {
        console.log(`✅ [CLINICS HANDLER] Ruta de distribuir pago encontrada: ${path}`);
        return await distributePayment(event);
      }
    }

    // Ruta: GET /api/clinics/payments/:id/distribution
    if (path.startsWith('/api/clinics/payments/') && path.endsWith('/distribution')) {
      if (method === 'GET') {
        console.log(`✅ [CLINICS HANDLER] Ruta de distribución encontrada: ${path}`);
        return await getPaymentDistribution(event);
      }
    }

    // Ruta: GET /api/clinics/payments/:id (detalle de pago específico)
    if (path.startsWith('/api/clinics/payments/') && 
        !path.includes('/distribute') && 
        !path.includes('/distribution')) {
      if (method === 'GET') {
        console.log(`✅ [CLINICS HANDLER] Ruta de detalle de pago encontrada: ${path}`);
        return await getClinicPaymentDetail(event);
      }
    }

    // Ruta base: GET /api/clinics/payments (debe ir DESPUÉS de las rutas específicas)
    if (path === '/api/clinics/payments') {
      if (method === 'GET') {
        console.log(`✅ [CLINICS HANDLER] Ruta de pagos encontrada: ${path}`);
        return await getClinicPayments(event);
      }
    }

    // Ruta: GET /api/clinics/doctors/payments
    if (path === '/api/clinics/doctors/payments') {
      if (method === 'GET') {
        console.log(`✅ [CLINICS HANDLER] Ruta de pagos a médicos encontrada: ${path}`);
        return await getDoctorPayments(event);
      }
    }

    if (path.startsWith('/api/clinics/doctors/') && path.endsWith('/pay')) {
      if (method === 'POST') return await payDoctor(event);
    }

    // Si no coincide ninguna ruta
    console.log(`❌ [CLINICS HANDLER] Ruta no encontrada: ${method} ${path}`);
    return errorResponse(`Route not found: ${method} ${path}`, 404);

  } catch (error: any) {
    console.error(`❌ [CLINICS] ${method} ${path} - Error:`, error.message);
    logger.error('Error in clinics handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
