import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getSupplies, getSupplyById, getSupplyReviews, createSupplyReview, getSupplyDashboard } from './supplies.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Supplies handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // GET /api/supplies
    if (path === '/api/supplies') {
      if (method === 'GET') return await getSupplies(event);
    }

    // GET /api/supplies/:id/reviews
    if (path.startsWith('/api/supplies/') && path.endsWith('/reviews')) {
      if (method === 'GET') return await getSupplyReviews(event);
      if (method === 'POST') return await createSupplyReview(event);
    }

    // GET /api/supplies/:userId/dashboard
    if (path.includes('/api/supplies/') && path.endsWith('/dashboard')) {
      if (method === 'GET') return await getSupplyDashboard(event);
    }

    // GET /api/supplies/:id (debe ir al final para no capturar rutas con /reviews o /dashboard)
    if (path.startsWith('/api/supplies/')) {
      if (method === 'GET') return await getSupplyById(event);
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] ${method} ${path} - Error:`, error.message);
    logger.error('Error in supplies handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
