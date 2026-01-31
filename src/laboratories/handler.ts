import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { getAllLaboratories, getLaboratoryById, searchLaboratories } from './laboratories.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Laboratories handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // GET /api/laboratories - Listar laboratorios
    if (path === '/api/laboratories' && method === 'GET') {
      return await getAllLaboratories(event);
    }

    // GET /api/laboratories/search - Buscar laboratorios
    if (path === '/api/laboratories/search' && method === 'GET') {
      return await searchLaboratories(event);
    }

    // GET /api/laboratories/{id} - Obtener laboratorio por ID
    if (path.startsWith('/api/laboratories/') && method === 'GET') {
      const pathParts = path.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      // Si no es "search", es un ID
      if (lastPart !== 'search') {
        return await getLaboratoryById(event);
      }
    }

    return errorResponse('Not found', 404, undefined, event);
  } catch (error: any) {
    logger.error('Error in laboratories handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error', event);
  }
}
