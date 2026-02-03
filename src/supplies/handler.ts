import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import {
  getSupplyStores,
  getSupplyStoreById,
  getSupplyStoreReviews,
  createSupplyStoreReview,
  getSupplyStoreDashboard,
} from './supplies.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`🔍 [SUPPLIES HANDLER] Método: ${method}, Path: ${path}`);
  logger.info('Supplies handler invoked', { method, path });

  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // GET /api/supplies - Listar tiendas
    if (path === '/api/supplies' && method === 'GET') {
      return await getSupplyStores(event);
    }

    // GET /api/supplies/:userId/dashboard - Dashboard de proveedor
    if (path.match(/^\/api\/supplies\/[^/]+\/dashboard$/) && method === 'GET') {
      return await getSupplyStoreDashboard(event);
    }

    // GET /api/supplies/:id/reviews - Obtener reseñas
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === 'GET') {
      return await getSupplyStoreReviews(event);
    }

    // POST /api/supplies/:id/reviews - Crear reseña
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === 'POST') {
      return await createSupplyStoreReview(event);
    }

    // GET /api/supplies/:id - Detalle de tienda
    if (path.match(/^\/api\/supplies\/[^/]+$/) && method === 'GET') {
      return await getSupplyStoreById(event);
    }

    console.log(`❌ [SUPPLIES HANDLER] Ruta no encontrada: ${method} ${path}`);
    return errorResponse(`Route not found: ${method} ${path}`, 404);

  } catch (error: any) {
    console.error(`❌ [SUPPLIES] ${method} ${path} - Error:`, error.message);
    logger.error('Error in supplies handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
