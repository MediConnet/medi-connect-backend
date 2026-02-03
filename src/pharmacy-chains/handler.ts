import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getActivePharmacyChains } from '../admin/pharmacy-chains.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`🔍 [PHARMACY-CHAINS HANDLER] Método: ${method}, Path: ${path}`);
  logger.info('Pharmacy chains handler invoked', { method, path });

  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // GET /api/pharmacy-chains - Listar cadenas activas (público)
    if (path === '/api/pharmacy-chains' && method === 'GET') {
      return await getActivePharmacyChains(event);
    }

    console.log(`❌ [PHARMACY-CHAINS HANDLER] Ruta no encontrada: ${method} ${path}`);
    return errorResponse(`Route not found: ${method} ${path}`, 404);

  } catch (error: any) {
    console.error(`❌ [PHARMACY-CHAINS] ${method} ${path} - Error:`, error.message);
    logger.error('Error in pharmacy chains handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
