import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import {
  getClinicInfo as getDoctorClinicInfo,
  getClinicProfile as getDoctorClinicProfile,
  updateClinicProfile as updateDoctorClinicProfile,
  getClinicAppointments as getDoctorClinicAppointments,
  updateClinicAppointmentStatus as updateDoctorClinicAppointmentStatus,
  getReceptionMessages as getDoctorReceptionMessages,
  createReceptionMessage as createDoctorReceptionMessage,
  markReceptionMessagesAsRead as markDoctorReceptionMessagesAsRead,
  getDateBlocks as getDoctorDateBlocks,
  requestDateBlock as requestDoctorDateBlock,
  getClinicNotifications as getDoctorClinicNotifications,
} from './doctor-associated.controller';
import { validateInvitation, acceptInvitation, rejectInvitation, sendInvitation, generateInvitationLink, associateInvitation } from './invitations.controller';
import { getDoctorSchedule, updateDoctorSchedule } from './doctor-schedules.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`🔍 [ASSOCIATION HANDLER] Método: ${method}, Path: ${path}`);
  logger.info('Association handler invoked', { method, path });

  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // --- Rutas de Invitación de Médicos ---

    // POST /api/association/doctors/invitation - Generar link de invitación (usado por frontend)
    if (path === '/api/association/doctors/invitation') {
      console.log(`✅ [ASSOCIATION HANDLER] Ruta de invitación encontrada: ${path}`);
      if (method === 'POST') return await generateInvitationLink(event);
    }

    // POST /api/association/invitations (nueva ruta alternativa)
    if (path === '/api/association/invitations') {
      console.log(`✅ [ASSOCIATION HANDLER] Ruta de invitations encontrada`);
      if (method === 'POST') return await sendInvitation(event);
    }

    // POST /api/association/invite - Generar link sin enviar email
    if (path === '/api/association/invite' || path === '/api/association/doctors/invite/link') {
      if (method === 'POST') return await generateInvitationLink(event);
    }

    // POST /api/association/doctors/invite - Enviar invitación por email
    if (path === '/api/association/doctors/invite') {
      console.log(`✅ [ASSOCIATION HANDLER] Ruta de invitación por email encontrada: ${path}`);
      if (method === 'POST') return await sendInvitation(event);
    }

    // --- Rutas de Médico Asociado ---
    if (path === '/api/association/doctors/me/info') {
      if (method === 'GET') return await getDoctorClinicInfo(event);
    }

    if (path === '/api/association/doctors/me/profile') {
      if (method === 'GET') return await getDoctorClinicProfile(event);
      if (method === 'PUT') return await updateDoctorClinicProfile(event);
    }

    if (path === '/api/association/doctors/me/schedule') {
      if (method === 'GET') return await getDoctorSchedule(event);
      if (method === 'PUT') return await updateDoctorSchedule(event);
    }

    if (path === '/api/association/doctors/me/appointments' || path.startsWith('/api/association/doctors/me/appointments?')) {
      if (method === 'GET') return await getDoctorClinicAppointments(event);
    }

    if (path.startsWith('/api/association/doctors/me/appointments/') && path.endsWith('/status')) {
      if (method === 'PATCH') return await updateDoctorClinicAppointmentStatus(event);
    }

    if (path === '/api/association/doctors/me/messages' || path.startsWith('/api/association/doctors/me/messages?')) {
      if (method === 'GET') return await getDoctorReceptionMessages(event);
      if (method === 'POST') return await createDoctorReceptionMessage(event);
    }

    if (path === '/api/association/doctors/me/messages/read') {
      if (method === 'PATCH') return await markDoctorReceptionMessagesAsRead(event);
    }

    if (path === '/api/association/doctors/me/date-blocks' || path.startsWith('/api/association/doctors/me/date-blocks?')) {
      if (method === 'GET') return await getDoctorDateBlocks(event);
      if (method === 'POST') return await requestDoctorDateBlock(event);
    }

    if (path === '/api/association/doctors/me/notifications' || path.startsWith('/api/association/doctors/me/notifications?')) {
      if (method === 'GET') return await getDoctorClinicNotifications(event);
    }

    // --- Rutas de Invitaciones (públicas) ---
    if (path.startsWith('/api/association/invite/') && path.endsWith('/accept')) {
      if (method === 'POST') {
        return await acceptInvitation(event);
      }
    }

    if (path.startsWith('/api/association/invite/') && path.endsWith('/associate')) {
      if (method === 'POST') {
        return await associateInvitation(event);
      }
    }

    if (path.startsWith('/api/association/invite/') && path.endsWith('/reject')) {
      if (method === 'POST') {
        return await rejectInvitation(event);
      }
    }

    if (path.startsWith('/api/association/invite/')) {
      if (method === 'GET') return await validateInvitation(event);
    }

    console.log(`❌ [ASSOCIATION HANDLER] Ruta no encontrada: ${method} ${path}`);
    return errorResponse(`Route not found: ${method} ${path}`, 404);

  } catch (error: any) {
    console.error(`❌ [ASSOCIATION] ${method} ${path} - Error:`, error.message);
    logger.error('Error in association handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
