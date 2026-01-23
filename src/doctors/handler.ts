import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getAppointments } from './appointments.controller';
import { getProfile, updateProfile } from './profile.controller';


export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Doctors handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // --- Rutas de Perfil ---
    if (path === '/api/doctors/profile') {
      if (method === 'GET') return await getProfile(event);
      if (method === 'PUT') return await updateProfile(event);
    }

    // --- Rutas de Citas ---
    if (path === '/api/doctors/appointments') {
      if (method === 'GET') return await getAppointments(event);
    }

    // Si no coincide ninguna ruta
    return errorResponse('Not found', 404);

  } catch (error: any) {
    logger.error('Error in doctors handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}