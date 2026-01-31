import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getLaboratoryDashboard } from './dashboard.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Laboratories handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // GET /api/laboratories/:userId/dashboard
    if (path.includes('/api/laboratories/') && path.endsWith('/dashboard')) {
      if (method === 'GET') return await getLaboratoryDashboard(event);
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [LABORATORIES] ${method} ${path} - Error:`, error.message);
    logger.error('Error in laboratories handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
