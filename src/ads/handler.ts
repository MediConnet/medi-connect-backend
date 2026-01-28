import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse } from '../shared/response';
import { createAdRequest } from './ads.controller';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.requestContext.http.method;
    
    // Ruta: POST /api/ads
    if (method === 'POST') {
      return await createAdRequest(event);
    }

    // Futuro: GET /api/ads (Listar mis anuncios)
    // if (method === 'GET') { ... }

    return errorResponse('Ruta no encontrada en el módulo de Anuncios', 404);
  } catch (error) {
    console.error('Error en Ads Handler:', error);
    return errorResponse('Server Error', 500);
  }
};