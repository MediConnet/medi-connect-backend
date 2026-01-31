import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { getAllAmbulances, getAmbulanceById, searchAmbulances } from './ambulances.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Ambulances handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
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
      // Si no es "search", es un ID
      if (lastPart !== 'search') {
        return await getAmbulanceById(event);
      }
    }

    return errorResponse('Not found', 404, undefined, event);
  } catch (error: any) {
    logger.error('Error in ambulances handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error', event);
  }
}
