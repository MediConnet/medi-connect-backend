import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';

// Placeholder para módulo de farmacias
// Similar estructura a otros módulos

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Pharmacies handler invoked', { method, path });

  try {
    // Endpoints futuros aquí
    return errorResponse('Not found', 404);
  } catch (error: any) {
    logger.error('Error in pharmacies handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
