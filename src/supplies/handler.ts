import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';

// Nota: Este módulo es público, no requiere autenticación
// En producción, aquí se conectaría a una base de datos de tiendas y productos
// Por ahora, retornamos datos mock como ejemplo

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Supplies handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    const { optionsResponse } = await import('../shared/response');
    return optionsResponse(event);
  }

  try {
    // GET /api/supplies/stores
    if (method === 'GET' && path === '/api/supplies/stores') {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores - Obteniendo tiendas');
      const result = await getStores(event);
      console.log(`✅ [SUPPLIES] GET /api/supplies/stores - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/supplies/stores/{id}
    if (method === 'GET' && path.startsWith('/api/supplies/stores/')) {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores/{id} - Obteniendo tienda');
      const result = await getStore(event);
      console.log(`✅ [SUPPLIES] GET /api/supplies/stores/{id} - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/supplies/products
    if (method === 'GET' && path === '/api/supplies/products') {
      console.log('✅ [SUPPLIES] GET /api/supplies/products - Obteniendo productos');
      const result = await getProducts(event);
      console.log(`✅ [SUPPLIES] GET /api/supplies/products - Completado con status ${result.statusCode}`);
      return result;
    }

    console.log(`❌ [SUPPLIES] ${method} ${path} - Ruta no encontrada (404)`);
    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] ${method} ${path} - Error:`, error.message);
    logger.error('Error in supplies handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function getStores(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🏪 [GET_STORES] Obteniendo lista de tiendas');
  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  // Mock data - En producción, esto vendría de la base de datos
  const stores = [
    {
      id: '1',
      name: 'Farmacia Central',
      address: 'Av. Principal 123',
      phone: '+1234567890',
      latitude: 40.7128,
      longitude: -74.0060,
      isOpen: true,
    },
    {
      id: '2',
      name: 'Farmacia del Sur',
      address: 'Calle Sur 456',
      phone: '+1234567891',
      latitude: 40.7130,
      longitude: -74.0062,
      isOpen: true,
    },
  ].slice(offset, offset + limit);

  console.log(`✅ [GET_STORES] Se obtuvieron ${stores.length} tiendas`);
  return successResponse({
    stores,
    pagination: {
      limit,
      offset,
      total: stores.length,
    },
  });
}

async function getStore(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🏪 [GET_STORE] Obteniendo tienda por ID');
  const pathParts = event.requestContext.http.path.split('/');
  const storeId = pathParts[pathParts.length - 1];

  if (!storeId) {
    console.error('❌ [GET_STORE] ID de tienda no proporcionado');
    return errorResponse('Store ID is required', 400);
  }

  // Mock data - En producción, esto vendría de la base de datos
  const store = {
    id: storeId,
    name: 'Farmacia Central',
    address: 'Av. Principal 123',
    phone: '+1234567890',
    email: 'contact@farmaciacentral.com',
    latitude: 40.7128,
    longitude: -74.0060,
    isOpen: true,
    hours: {
      monday: '9:00 - 20:00',
      tuesday: '9:00 - 20:00',
      wednesday: '9:00 - 20:00',
      thursday: '9:00 - 20:00',
      friday: '9:00 - 20:00',
      saturday: '9:00 - 18:00',
      sunday: 'Closed',
    },
  };

  console.log(`✅ [GET_STORE] Tienda obtenida: ${store.name}`);
  return successResponse(store);
}

async function getProducts(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📦 [GET_PRODUCTS] Obteniendo productos');
  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);
  const search = queryParams.search;

  // Mock data - En producción, esto vendría de la base de datos
  let products = [
    {
      id: '1',
      name: 'Paracetamol 500mg',
      category: 'Analgésicos',
      price: 5.99,
      available: true,
      storeId: '1',
    },
    {
      id: '2',
      name: 'Ibuprofeno 400mg',
      category: 'Antiinflamatorios',
      price: 7.50,
      available: true,
      storeId: '1',
    },
    {
      id: '3',
      name: 'Amoxicilina 500mg',
      category: 'Antibióticos',
      price: 12.99,
      available: true,
      storeId: '2',
    },
  ];

  // Filtrar por búsqueda si existe
  if (search) {
    products = products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
    );
  }

  const paginatedProducts = products.slice(offset, offset + limit);

  console.log(`✅ [GET_PRODUCTS] Se obtuvieron ${paginatedProducts.length} productos${search ? ` (búsqueda: "${search}")` : ''}`);
  return successResponse({
    products: paginatedProducts,
    pagination: {
      limit,
      offset,
      total: products.length,
    },
  });
}
