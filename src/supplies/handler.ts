import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, optionsResponse, successResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';
import {
  createSupplyReview,
  getSupplies,
  getSupplyById,
  getSupplyDashboard,
  getSupplyReviews
} from './supplies.controller';

// Nota: Este módulo es público, no requiere autenticación

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Supplies handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    if (path === '/api/supplies' && method === 'GET') {
      return await getSupplies(event);
    }

    // GET/POST /api/supplies/:id/reviews
    if (path.startsWith('/api/supplies/') && path.endsWith('/reviews')) {
      if (method === 'GET') return await getSupplyReviews(event);
      if (method === 'POST') return await createSupplyReview(event);
    }

    // GET /api/supplies/:id/dashboard
    if (path.startsWith('/api/supplies/') && path.endsWith('/dashboard')) {
      if (method === 'GET') return await getSupplyDashboard(event);
    }

    // GET /api/supplies/stores/search
    if (method === 'GET' && path === '/api/supplies/stores/search') {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores/search - Buscando tiendas');
      return await searchStores(event);
    }

    // GET /api/supplies/products
    if (method === 'GET' && path === '/api/supplies/products') {
      console.log('✅ [SUPPLIES] GET /api/supplies/products - Obteniendo productos');
      return await getProducts(event);
    }

    // GET /api/supplies/stores/{id} (Ruta antigua)
    if (method === 'GET' && path.startsWith('/api/supplies/stores/') && !path.endsWith('/products')) {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores/{id} - Obteniendo tienda (Legacy)');
      return await getStore(event);
    }

    // GET /api/supplies/stores/{id}/products (Ruta antigua)
    if (method === 'GET' && path.startsWith('/api/supplies/stores/') && path.endsWith('/products')) {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores/{id}/products - Obteniendo productos (Legacy)');
      return await getStoreProducts(event);
    }

    // Regex para validar que la ruta es /api/supplies/ seguido de un ID (y nada más)
    // Evita confundirse con /api/supplies/products o /stores
    const isDetailRoute = /^\/api\/supplies\/[a-zA-Z0-9-]+$/.test(path);

    if (method === 'GET' && isDetailRoute) {
      console.log('✅ [HANDLER] Redirigiendo a getSupplyById (Nuevo Controller)');
      return await getSupplyById(event);
    }

    console.log(`❌ [SUPPLIES] ${method} ${path} - Ruta no encontrada (404)`);
    return errorResponse('Not found', 404, undefined, event);

  } catch (error: any) {
    console.error(`❌ [SUPPLIES] ${method} ${path} - Error:`, error.message);
    logger.error('Error in supplies handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error', event);
  }
}


async function getStores(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  return successResponse({ message: 'Legacy getStores' }, 200, event);
}

async function getStore(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🏪 [GET_STORE] Obteniendo tienda por ID (Legacy)');
  const storeId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/stores/');

  if (!storeId) {
    return errorResponse('Store ID is required', 400, undefined, event);
  }

  try {
    const prisma = getPrismaClient();
    
    const provider = await prisma.providers.findFirst({
      where: {
        id: storeId,
        category_id: 5,
        verification_status: 'APPROVED',
        users: { is_active: true },
      },
      include: {
        users: { select: { email: true } },
        provider_branches: {
          where: { is_active: true },
          orderBy: [{ is_main: 'desc' }],
          take: 1,
          include: {
            cities: { select: { name: true, state: true } },
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: 'asc' },
            },
          },
        },
      },
    });

    if (!provider) {
      return errorResponse('Store not found', 404, undefined, event);
    }

    const mainBranch = provider.provider_branches[0];
    const hours: any = {};
    if (mainBranch?.provider_schedules) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      mainBranch.provider_schedules.forEach((schedule: any) => {
        const dayName = days[schedule.day_of_week || 0];
        const startTime = schedule.start_time ? new Date(schedule.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
        const endTime = schedule.end_time ? new Date(schedule.end_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
        hours[dayName] = startTime && endTime ? `${startTime} - ${endTime}` : 'Closed';
      });
    }

    const store = {
      id: provider.id,
      name: provider.commercial_name || '',
      address: mainBranch?.address_text || '',
      phone: mainBranch?.phone_contact || '',
      email: mainBranch?.email_contact || provider.users?.email || '',
      latitude: mainBranch?.latitude || null,
      longitude: mainBranch?.longitude || null,
      isOpen: mainBranch?.is_active || false,
      hours: Object.keys(hours).length > 0 ? hours : { monday: '9:00 - 18:00' }, // Simplificado
      description: provider.description || '',
      image: provider.logo_url || mainBranch?.image_url || '',
    };

    return successResponse(store, 200, event);
  } catch (error: any) {
    return internalErrorResponse('Failed to fetch store', event);
  }
}

async function getProducts(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📦 [GET_PRODUCTS] Obteniendo productos (Legacy/Global)');
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = (page - 1) * limit;
  const search = queryParams.search;
  const category = queryParams.category;
  const available = queryParams.available === 'true';

  try {
    const prisma = getPrismaClient();
    const where: any = {
      providers: {
        category_id: 5,
        verification_status: 'APPROVED',
        users: { is_active: true },
      },
    };

    if (available !== undefined) where.is_available = available;
    if (category) where.type = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.provider_catalog.findMany({
        where,
        include: {
          providers: { select: { id: true, commercial_name: true } },
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.provider_catalog.count({ where }),
    ]);

    const formattedProducts = products.map((product: any) => ({
      id: product.id,
      name: product.name || '',
      category: product.type || '',
      price: product.price ? Number(product.price) : 0,
      available: product.is_available || false,
      storeId: product.provider_id || '',
      description: product.description || '',
      image: product.image_url || '',
    }));

    return successResponse({
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    return internalErrorResponse('Failed to fetch products', event);
  }
}

async function searchStores(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🔍 [SEARCH_STORES] Buscando tiendas (Legacy)');
  const queryParams = event.queryStringParameters || {};
  const query = queryParams.q || queryParams.query || '';

  if (!query || query.trim().length === 0) {
    return errorResponse('Search query is required', 400, undefined, event);
  }

  try {
    const prisma = getPrismaClient();
    const providers = await prisma.providers.findMany({
      where: {
        category_id: 5,
        verification_status: 'APPROVED',
        users: { is_active: true },
        OR: [
          { commercial_name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { provider_branches: { some: { address_text: { contains: query, mode: 'insensitive' } } } },
          { provider_branches: { some: { cities: { name: { contains: query, mode: 'insensitive' } } } } },
        ],
      },
      include: {
        provider_branches: {
          where: { is_active: true },
          orderBy: [{ is_main: 'desc' }],
          take: 1,
          include: { cities: { select: { name: true } } },
        },
      },
      take: 20,
    });

    const stores = providers.map((provider: any) => {
      const mainBranch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || '',
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        city: mainBranch?.cities?.name || '',
        latitude: mainBranch?.latitude || null,
        longitude: mainBranch?.longitude || null,
      };
    });

    return successResponse(stores, 200, event);
  } catch (error: any) {
    return internalErrorResponse('Failed to search stores', event);
  }
}

async function getStoreProducts(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  return getProducts(event); 
}