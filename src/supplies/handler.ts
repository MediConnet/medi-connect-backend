import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { extractIdFromPath } from '../shared/validators';

// Nota: Este módulo es público, no requiere autenticación
// En producción, aquí se conectaría a una base de datos de tiendas y productos
// Por ahora, retornamos datos mock como ejemplo

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Supplies handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
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

    // GET /api/supplies/stores/search
    if (method === 'GET' && path === '/api/supplies/stores/search') {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores/search - Buscando tiendas');
      const result = await searchStores(event);
      return result;
    }

    // GET /api/supplies/stores/{id}
    if (method === 'GET' && path.startsWith('/api/supplies/stores/') && !path.endsWith('/products')) {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores/{id} - Obteniendo tienda');
      const result = await getStore(event);
      console.log(`✅ [SUPPLIES] GET /api/supplies/stores/{id} - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/supplies/stores/{storeId}/products
    if (method === 'GET' && path.startsWith('/api/supplies/stores/') && path.endsWith('/products')) {
      console.log('✅ [SUPPLIES] GET /api/supplies/stores/{id}/products - Obteniendo productos de tienda');
      const result = await getStoreProducts(event);
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
    return errorResponse('Not found', 404, undefined, event);
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] ${method} ${path} - Error:`, error.message);
    logger.error('Error in supplies handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error', event);
  }
}

async function getStores(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🏪 [GET_STORES] Obteniendo lista de tiendas');
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;
  const city = queryParams.city;

  try {
    const prisma = getPrismaClient();
    
    const where: any = {
      verification_status: 'APPROVED',
      users: {
        is_active: true,
      },
      service_categories: {
        slug: 'supplies',
      },
      provider_branches: {
        some: {
          is_active: true,
        },
      },
    };

    if (city) {
      where.provider_branches = {
        some: {
          is_active: true,
          cities: {
            name: {
              contains: city,
              mode: 'insensitive',
            },
          },
        },
      };
    }

    const [providers, total] = await Promise.all([
      prisma.providers.findMany({
        where,
        include: {
          provider_branches: {
            where: {
              is_main: true,
              is_active: true,
            },
            take: 1,
            include: {
              cities: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          commercial_name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.providers.count({ where }),
    ]);

    const stores = providers.map(provider => {
      const mainBranch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || '',
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        latitude: mainBranch?.latitude || null,
        longitude: mainBranch?.longitude || null,
        isOpen: mainBranch?.is_active || false,
        city: mainBranch?.cities?.name || '',
        image: provider.logo_url || mainBranch?.image_url || '',
      };
    });

    console.log(`✅ [GET_STORES] Se obtuvieron ${stores.length} tiendas (total: ${total})`);
    return successResponse({
      stores,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [GET_STORES] Error:', error.message);
    logger.error('Error fetching stores', error);
    return internalErrorResponse('Failed to fetch stores', event);
  }
}

async function getStore(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🏪 [GET_STORE] Obteniendo tienda por ID');
  const storeId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/stores/');

  if (!storeId) {
    console.error('❌ [GET_STORE] ID de tienda no proporcionado');
    return errorResponse('Store ID is required', 400, undefined, event);
  }

  try {
    const prisma = getPrismaClient();
    
    const provider = await prisma.providers.findFirst({
      where: {
        id: storeId,
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        service_categories: {
          slug: 'supplies',
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
      },
      include: {
        users: {
          select: {
            email: true,
          },
        },
        provider_branches: {
          where: {
            is_main: true,
            is_active: true,
          },
          take: 1,
          include: {
            cities: {
              select: {
                name: true,
                state: true,
              },
            },
            provider_schedules: {
              where: {
                is_active: true,
              },
              orderBy: {
                day_of_week: 'asc',
              },
            },
          },
        },
      },
    });

    if (!provider) {
      return errorResponse('Store not found', 404, undefined, event);
    }

    const mainBranch = provider.provider_branches[0];
    
    // Formatear horarios
    const hours: any = {};
    if (mainBranch?.provider_schedules) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      mainBranch.provider_schedules.forEach(schedule => {
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
      hours: Object.keys(hours).length > 0 ? hours : {
        monday: '9:00 - 20:00',
        tuesday: '9:00 - 20:00',
        wednesday: '9:00 - 20:00',
        thursday: '9:00 - 20:00',
        friday: '9:00 - 20:00',
        saturday: '9:00 - 18:00',
        sunday: 'Closed',
      },
      description: provider.description || '',
      image: provider.logo_url || mainBranch?.image_url || '',
    };

    console.log(`✅ [GET_STORE] Tienda obtenida: ${store.name}`);
    return successResponse(store, 200, event);
  } catch (error: any) {
    console.error('❌ [GET_STORE] Error:', error.message);
    logger.error('Error fetching store', error);
    return internalErrorResponse('Failed to fetch store', event);
  }
}

async function getProducts(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📦 [GET_PRODUCTS] Obteniendo productos');
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
        service_categories: {
          slug: 'supplies',
        },
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
      },
    };

    if (available !== undefined) {
      where.is_available = available;
    }

    if (category) {
      where.type = category;
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.provider_catalog.findMany({
        where,
        include: {
          providers: {
            select: {
              id: true,
              commercial_name: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.provider_catalog.count({ where }),
    ]);

    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name || '',
      category: product.type || '',
      price: product.price ? Number(product.price) : 0,
      available: product.is_available || false,
      storeId: product.provider_id || '',
      description: product.description || '',
      image: product.image_url || '',
    }));

    console.log(`✅ [GET_PRODUCTS] Se obtuvieron ${formattedProducts.length} productos${search ? ` (búsqueda: "${search}")` : ''} (total: ${total})`);
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
    console.error('❌ [GET_PRODUCTS] Error:', error.message);
    logger.error('Error fetching products', error);
    return internalErrorResponse('Failed to fetch products', event);
  }
}

async function searchStores(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🔍 [SEARCH_STORES] Buscando tiendas');
  const queryParams = event.queryStringParameters || {};
  const query = queryParams.q || queryParams.query || '';

  if (!query || query.trim().length === 0) {
    return errorResponse('Search query is required', 400, undefined, event);
  }

  try {
    const prisma = getPrismaClient();
    
    const providers = await prisma.providers.findMany({
      where: {
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        service_categories: {
          slug: 'supplies',
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
        OR: [
          {
            commercial_name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            provider_branches: {
              some: {
                address_text: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            provider_branches: {
              some: {
                cities: {
                  name: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        provider_branches: {
          where: {
            is_main: true,
            is_active: true,
          },
          take: 1,
          include: {
            cities: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: 20,
    });

    const stores = providers.map(provider => {
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

    console.log(`✅ [SEARCH_STORES] Se encontraron ${stores.length} tiendas para "${query}"`);
    return successResponse(stores, 200, event);
  } catch (error: any) {
    console.error('❌ [SEARCH_STORES] Error:', error.message);
    logger.error('Error searching stores', error);
    return internalErrorResponse('Failed to search stores', event);
  }
}

async function getStoreProducts(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📦 [GET_STORE_PRODUCTS] Obteniendo productos de tienda');
  const storeId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/stores/', '/products');

  if (!storeId) {
    return errorResponse('Store ID is required', 400, undefined, event);
  }

  try {
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};
    
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '50', 10);
    const offset = (page - 1) * limit;
    const category = queryParams.category;
    const available = queryParams.available === 'true';

    const where: any = {
      provider_id: storeId,
    };

    if (available !== undefined) {
      where.is_available = available;
    }

    if (category) {
      where.type = category;
    }

    const [products, total] = await Promise.all([
      prisma.provider_catalog.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.provider_catalog.count({ where }),
    ]);

    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name || '',
      category: product.type || '',
      price: product.price ? Number(product.price) : 0,
      available: product.is_available || false,
      description: product.description || '',
      image: product.image_url || '',
    }));

    console.log(`✅ [GET_STORE_PRODUCTS] Se obtuvieron ${formattedProducts.length} productos (total: ${total})`);
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
    console.error('❌ [GET_STORE_PRODUCTS] Error:', error.message);
    logger.error('Error fetching store products', error);
    return internalErrorResponse('Failed to fetch store products', event);
  }
}
