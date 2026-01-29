import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse, successResponse } from '../shared/response';

// Importar Controllers (Separación de Responsabilidades)
import { getAppointments, updateAppointmentStatus } from './appointments.controller';
import { getDashboard } from './dashboard.controller';
import { createDiagnosis, getDiagnosis } from './diagnoses.controller';
import { getPatients } from './patients.controller';
import { getProfile, updateProfile } from './profile.controller';
import { getSpecialties } from './specialties.controller';
import {
  getClinicInfo,
  getClinicProfile,
  updateClinicProfile,
  getClinicAppointments,
  updateClinicAppointmentStatus,
  getReceptionMessages,
  createReceptionMessage,
  markReceptionMessagesAsRead,
  getDateBlocks,
  requestDateBlock,
  getClinicNotifications,
} from './clinic.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Doctors handler invoked', { method, path });

  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // --- Profile ---
    if (path === '/api/doctors/profile') {
      if (method === 'GET') return await getProfile(event);
      if (method === 'PUT') return await updateProfile(event);
    }

    // --- Dashboard ---
    if (path === '/api/doctors/dashboard') {
      if (method === 'GET') return await getDashboard(event);
    }

    // --- Appointments ---
    if (path === '/api/doctors/appointments') {
      if (method === 'GET') return await getAppointments(event);
    }
    
    // Update status (PUT /status)
    if (path.startsWith('/api/doctors/appointments/') && path.endsWith('/status')) {
      if (method === 'PUT') return await updateAppointmentStatus(event);
    }

    // --- NUEVA RUTA: Create Diagnosis (POST /diagnosis) ---
    if (path.startsWith('/api/doctors/appointments/') && path.endsWith('/diagnosis')) {
      if (method === 'POST') return await createDiagnosis(event);
    }

    if (path.startsWith('/api/doctors/appointments/') && path.endsWith('/diagnosis')) {
      if (method === 'POST') return await createDiagnosis(event);
      if (method === 'GET') return await getDiagnosis(event); 
    }

    // --- Patients ---
    if (path === '/api/doctors/patients') {
      if (method === 'GET') return await getPatients(event);
    }

    // --- Reviews & Payments (Placeholders) ---
    if (path === '/api/doctors/reviews' && method === 'GET') {
        return successResponse({ reviews: [] });
    }
    if (path.startsWith('/api/doctors/payments') && method === 'GET') {
        return successResponse({ payments: [] });
    }

    // --- Specialties ---
    if (path === '/api/specialties') {
      if (method === 'GET') return await getSpecialties(event);
    }

    // --- Clinic Associated Doctor Routes ---
    if (path === '/api/doctors/clinic-info') {
      if (method === 'GET') return await getClinicInfo(event);
    }

    if (path === '/api/doctors/clinic/profile') {
      if (method === 'GET') return await getClinicProfile(event);
      if (method === 'PUT') return await updateClinicProfile(event);
    }

    if (path === '/api/doctors/clinic/appointments' || path.startsWith('/api/doctors/clinic/appointments?')) {
      if (method === 'GET') return await getClinicAppointments(event);
    }

    if (path.startsWith('/api/doctors/clinic/appointments/') && path.endsWith('/status')) {
      if (method === 'PATCH') return await updateClinicAppointmentStatus(event);
    }

    if (path === '/api/doctors/clinic/reception/messages') {
      if (method === 'GET') return await getReceptionMessages(event);
      if (method === 'POST') return await createReceptionMessage(event);
    }

    if (path === '/api/doctors/clinic/reception/messages/read') {
      if (method === 'PATCH') return await markReceptionMessagesAsRead(event);
    }

    if (path === '/api/doctors/clinic/date-blocks' || path.startsWith('/api/doctors/clinic/date-blocks?')) {
      if (method === 'GET') return await getDateBlocks(event);
    }

    if (path === '/api/doctors/clinic/date-blocks/request') {
      if (method === 'POST') return await requestDateBlock(event);
    }

    if (path === '/api/doctors/clinic/notifications' || path.startsWith('/api/doctors/clinic/notifications?')) {
      if (method === 'GET') return await getClinicNotifications(event);
    }

    return errorResponse('Not found', 404);

  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error: ${error.message}`);
    return internalErrorResponse(error.message || 'Internal server error');
  }
}