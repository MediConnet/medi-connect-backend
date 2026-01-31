import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getHomeContent, getHomeFeatures, getFeaturedServices } from './content.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Home handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // GET /api/home/content
    if (path === '/api/home/content') {
      if (method === 'GET') return await getHomeContent(event);
    }

    // GET /api/home/features
    if (path === '/api/home/features') {
      if (method === 'GET') return await getHomeFeatures(event);
    }

    // GET /api/home/featured-services
    if (path === '/api/home/featured-services') {
      if (method === 'GET') return await getFeaturedServices(event);
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [HOME] ${method} ${path} - Error:`, error.message);
    logger.error('Error in home handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
