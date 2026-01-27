import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse, successResponse } from '../shared/response';

// Importar Controllers (Separación de Responsabilidades)
import { getAppointments, updateAppointmentStatus } from './appointments.controller';
import { getDashboard } from './dashboard.controller';
import { getPatients } from './patients.controller';
import { getProfile, updateProfile } from './profile.controller';
import { getSpecialties } from './specialties.controller';

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
    // Update status (con o sin ID en path, el controller maneja fallback)
    if (path.startsWith('/api/doctors/appointments/') && path.endsWith('/status')) {
      if (method === 'PUT') return await updateAppointmentStatus(event);
    }

    // --- Patients ---
    if (path === '/api/doctors/patients') {
      if (method === 'GET') return await getPatients(event);
    }

    // --- Reviews & Payments (Placeholders por ahora) ---
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

    return errorResponse('Not found', 404);

  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error: ${error.message}`);
    return internalErrorResponse(error.message || 'Internal server error');
  }
}