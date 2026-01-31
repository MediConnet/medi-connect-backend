import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getActivePharmacyChains } from '../admin/pharmacy-chains.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Pharmacy chains handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    const { optionsResponse } = await import('../shared/response');
    return optionsResponse(event);
  }

  try {
    // GET /api/pharmacy-chains - Listar solo cadenas activas (público)
    if (method === 'GET' && path === '/api/pharmacy-chains') {
      console.log('✅ [PUBLIC] GET /api/pharmacy-chains - Obteniendo cadenas activas');
      const result = await getActivePharmacyChains(event);
      console.log(`✅ [PUBLIC] GET /api/pharmacy-chains - Completado con status ${result.statusCode}`);
      return result;
    }

    console.log(`❌ [PUBLIC] ${method} ${path} - Ruta no encontrada (404)`);
    const { errorResponse } = await import('../shared/response');
    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [PUBLIC] ${method} ${path} - Error:`, error.message);
    logger.error('Error in pharmacy chains handler', error, { method, path });
    const { internalErrorResponse } = await import('../shared/response');
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
