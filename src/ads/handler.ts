import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse } from '../shared/response';
import { createAdRequest, getMyAd } from './ads.controller';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.requestContext.http.method;
    
    
    // POST /api/ads -> Crear Solicitud
    if (method === 'POST') {
      return await createAdRequest(event);
    }

    // GET /api/ads (o /api/ads/my-latest) -> Obtener mi anuncio
    if (method === 'GET') {
      return await getMyAd(event);
    }

    return errorResponse('Ruta no encontrada en el módulo de Anuncios', 404);
  } catch (error) {
    console.error('Error en Ads Handler:', error);
    return errorResponse('Server Error', 500);
  }
};