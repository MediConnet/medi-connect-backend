import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { logger } from '../shared/logger';
import {
  getAllAmbulances,
  getAmbulanceById,
  searchAmbulances,
  getAmbulanceProfile,
  updateAmbulanceProfile,
  getAmbulanceReviews,
  getAmbulanceSettings,
} from './ambulances.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Ambulances handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // GET /api/ambulances/profile - Obtener perfil
    if (path === '/api/ambulances/profile' && method === 'GET') {
      return await getAmbulanceProfile(event);
    }

    // PUT /api/ambulances/profile - Actualizar perfil
    if (path === '/api/ambulances/profile' && method === 'PUT') {
      return await updateAmbulanceProfile(event);
    }

    // GET /api/ambulances/reviews - Obtener reseñas
    if (path === '/api/ambulances/reviews' && method === 'GET') {
      return await getAmbulanceReviews(event);
    }

    // GET /api/ambulances/settings - Obtener configuración
    if (path === '/api/ambulances/settings' && method === 'GET') {
      return await getAmbulanceSettings(event);
    }

    // GET /api/ambulances - Listar ambulancias
    if (path === '/api/ambulances' && method === 'GET') {
      return await getAllAmbulances(event);
    }

    // GET /api/ambulances/search - Buscar ambulancias
    if (path === '/api/ambulances/search' && method === 'GET') {
      return await searchAmbulances(event);
    }

    // GET /api/ambulances/{id} - Obtener ambulancia por ID
    if (path.startsWith('/api/ambulances/') && method === 'GET') {
      const pathParts = path.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      // Si no es "search", "profile", "reviews", "settings", es un ID
      if (!['search', 'profile', 'reviews', 'settings'].includes(lastPart)) {
        return await getAmbulanceById(event);
      }
    }

    return errorResponse('Not found', 404, undefined, event);
  } catch (error: any) {
    logger.error('Error in ambulances handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error', event);
  }
}
