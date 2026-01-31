import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getAllDoctors, getDoctorById, searchDoctors } from './doctors.controller';
import { getAllPharmacies, getPharmacyBrands, getPharmacyBranches, getPharmacyBranchById } from './pharmacies.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Public handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // --- RUTAS PÚBLICAS DE MÉDICOS ---
    
    // GET /api/public/doctors - Listar médicos
    if (path === '/api/public/doctors' && method === 'GET') {
      return await getAllDoctors(event);
    }

    // GET /api/public/doctors/search - Buscar médicos
    if (path === '/api/public/doctors/search' && method === 'GET') {
      return await searchDoctors(event);
    }

    // GET /api/public/doctors/{id} - Obtener médico por ID
    if (path.startsWith('/api/public/doctors/') && method === 'GET') {
      const pathParts = path.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      // Si no es "search", es un ID
      if (lastPart !== 'search') {
        return await getDoctorById(event);
      }
    }

    // --- RUTAS PÚBLICAS DE FARMACIAS ---
    
    // GET /api/public/pharmacies/brands - Listar marcas
    if (path === '/api/public/pharmacies/brands' && method === 'GET') {
      return await getPharmacyBrands(event);
    }

    // GET /api/public/pharmacies/brands/{brandId}/branches - Sucursales por marca
    if (path.startsWith('/api/public/pharmacies/brands/') && path.endsWith('/branches') && method === 'GET') {
      return await getPharmacyBranches(event);
    }

    // GET /api/public/pharmacies/branches/{id} - Obtener sucursal por ID
    if (path.startsWith('/api/public/pharmacies/branches/') && method === 'GET') {
      return await getPharmacyBranchById(event);
    }

    // GET /api/public/pharmacies - Listar todas las farmacias (alternativa)
    if (path === '/api/public/pharmacies' && method === 'GET') {
      return await getAllPharmacies(event);
    }

    // Si no coincide ninguna ruta
    console.log(`❌ [PUBLIC] ${method} ${path} - Ruta no encontrada`);
    return errorResponse('Not found', 404, undefined, event);

  } catch (error: any) {
    console.error(`❌ [PUBLIC] ${method} ${path} - Error:`, error.message);
    logger.error('Error in public handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error', event);
  }
}


