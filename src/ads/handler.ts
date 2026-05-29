import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse } from '../shared/response';
import { createAdRequest, getMyAd, getMyAds, getPublicAds, updateMyAd } from './ads.controller';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.requestContext.http.method;
    // Obtenemos el path para saber si es una petición pública o privada
    const path = event.rawPath || event.requestContext.http.path;
    
    console.log(`📡 [ADS HANDLER] ${method} ${path}`);

    // ==========================================
    // 🌍 RUTAS PÚBLICAS (APP MÓVIL)
    // ==========================================
    
    // GET /api/public/ads -> Obtener carrusel de anuncios
    if (method === 'GET' && path.includes('/public/ads')) {
      return await getPublicAds(event);
    }

    // ==========================================
    // 🔐 RUTAS PRIVADAS (PANEL PROVEEDOR)
    // ==========================================

    // POST /api/ads -> Crear Solicitud
    if (method === 'POST') {
      return await createAdRequest(event);
    }

    // GET /api/ads -> Obtener mi anuncio (estado y detalles)
    // GET /api/ads?mode=all&status=PENDING&dateFrom=...&dateTo=... -> Listado completo con filtros
    if (method === 'GET') {
      const queryParams = event.queryStringParameters || {};
      if (queryParams.mode === 'all') {
        return await getMyAds(event);
      }
      return await getMyAd(event);
    }

    // PUT /api/ads/:id -> Editar mi anuncio (solo si está PENDING)
    if (method === 'PUT' && path.match(/^\/api\/ads\/[^/]+$/)) {
      return await updateMyAd(event);
    }

    return errorResponse('Ruta no encontrada en el módulo de Anuncios', 404);

  } catch (error) {
    console.error('❌ Error en Ads Handler:', error);
    return errorResponse('Server Error', 500);
  }
};