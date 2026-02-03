import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse } from '../shared/response';
import { requireAuth, AuthContext } from '../shared/auth';
import { randomUUID } from 'crypto';

/**
 * GET /api/supplies
 * Listar tiendas de insumos médicos (público)
 */
export async function getSupplyStores(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const prisma = getPrismaClient();

    const stores = await prisma.supply_stores.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        image_url: true,
        rating_cache: true,
      },
      orderBy: {
        rating_cache: 'desc',
      },
    });

    const formattedStores = stores.map((store) => ({
      id: store.id,
      name: store.name,
      description: store.description,
      address: store.address,
      phone: store.phone,
      rating: store.rating_cache || 0,
      imageUrl: store.image_url,
    }));

    return successResponse(formattedStores);
  } catch (error: any) {
    console.error('Error getting supply stores:', error);
    return errorResponse(error.message || 'Error al obtener tiendas de insumos', 500);
  }
}

/**
 * GET /api/supplies/:id
 * Obtener detalle de una tienda de insumos (público)
 */
export async function getSupplyStoreById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const storeId = event.pathParameters?.id;
    if (!storeId) {
      return errorResponse('ID de tienda requerido', 400);
    }

    const prisma = getPrismaClient();

    const store = await prisma.supply_stores.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        whatsapp: true,
        email: true,
        image_url: true,
        rating_cache: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!store) {
      return errorResponse('Tienda no encontrada', 404);
    }

    return successResponse({
      id: store.id,
      name: store.name,
      description: store.description,
      address: store.address,
      phone: store.phone,
      whatsapp: store.whatsapp,
      email: store.email,
      rating: store.rating_cache || 0,
      imageUrl: store.image_url,
      latitude: store.latitude ? parseFloat(store.latitude.toString()) : null,
      longitude: store.longitude ? parseFloat(store.longitude.toString()) : null,
    });
  } catch (error: any) {
    console.error('Error getting supply store:', error);
    return errorResponse(error.message || 'Error al obtener tienda', 500);
  }
}

/**
 * GET /api/supplies/:id/reviews
 * Obtener reseñas de una tienda de insumos (público)
 */
export async function getSupplyStoreReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const storeId = event.pathParameters?.id;
    if (!storeId) {
      return errorResponse('ID de tienda requerido', 400);
    }

    const prisma = getPrismaClient();

    const reviews = await prisma.supply_reviews.findMany({
      where: { store_id: storeId },
      include: {
        users: {
          select: {
            email: true,
            patients: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      supplyStoreId: review.store_id,
      userId: review.user_id,
      userName: review.users?.patients?.[0]?.full_name || review.users?.email || 'Usuario',
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
    }));

    return successResponse(formattedReviews);
  } catch (error: any) {
    console.error('Error getting supply store reviews:', error);
    return errorResponse(error.message || 'Error al obtener reseñas', 500);
  }
}

/**
 * POST /api/supplies/:id/reviews
 * Crear una reseña para una tienda de insumos (requiere autenticación)
 */
export async function createSupplyStoreReview(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const storeId = event.pathParameters?.id;
    if (!storeId) {
      return errorResponse('ID de tienda requerido', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return errorResponse('Rating debe estar entre 1 y 5', 400);
    }

    const prisma = getPrismaClient();

    // Verificar que la tienda existe
    const store = await prisma.supply_stores.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return errorResponse('Tienda no encontrada', 404);
    }

    // Crear reseña
    const review = await prisma.supply_reviews.create({
      data: {
        id: randomUUID(),
        store_id: storeId,
        user_id: authContext.user.id,
        rating,
        comment: comment || null,
        created_at: new Date(),
      },
      include: {
        users: {
          select: {
            email: true,
            patients: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
    });

    // Actualizar rating promedio de la tienda
    const avgRating = await prisma.supply_reviews.aggregate({
      where: { store_id: storeId },
      _avg: { rating: true },
    });

    await prisma.supply_stores.update({
      where: { id: storeId },
      data: { rating_cache: avgRating._avg.rating || 0 },
    });

    return successResponse({
      id: review.id,
      supplyStoreId: review.store_id,
      userId: review.user_id,
      userName: review.users?.patients?.[0]?.full_name || review.users?.email || 'Usuario',
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
    }, 201);
  } catch (error: any) {
    console.error('Error creating supply store review:', error);
    return errorResponse(error.message || 'Error al crear reseña', 500);
  }
}

/**
 * GET /api/supplies/:userId/dashboard
 * Obtener dashboard de una tienda de insumos (requiere autenticación)
 */
export async function getSupplyStoreDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (authContext.user.role !== 'supplies') {
      return errorResponse('No autorizado. Debe ser proveedor de insumos', 403);
    }

    const prisma = getPrismaClient();

    // Buscar tienda del usuario
    const store = await prisma.supply_stores.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        supply_products: {
          where: { is_available: true },
          take: 10,
          orderBy: { created_at: 'desc' },
        },
        supply_orders: {
          take: 10,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!store) {
      return errorResponse('Tienda no encontrada', 404);
    }

    // Calcular estadísticas
    const totalProducts = await prisma.supply_products.count({
      where: { store_id: store.id },
    });

    const totalOrders = await prisma.supply_orders.count({
      where: { store_id: store.id },
    });

    const pendingOrders = await prisma.supply_orders.count({
      where: {
        store_id: store.id,
        status: 'pending',
      },
    });

    const completedOrders = await prisma.supply_orders.count({
      where: {
        store_id: store.id,
        status: 'completed',
      },
    });

    return successResponse({
      store: {
        id: store.id,
        name: store.name,
        description: store.description,
        address: store.address,
        phone: store.phone,
        whatsapp: store.whatsapp,
      },
      stats: {
        totalProducts,
        totalOrders,
        pendingOrders,
        completedOrders,
      },
      recentOrders: store.supply_orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: parseFloat(order.total_amount.toString()),
        createdAt: order.created_at,
      })),
      products: store.supply_products.map((product) => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price.toString()),
        stock: product.stock,
        imageUrl: product.image_url,
      })),
    });
  } catch (error: any) {
    console.error('Error getting supply store dashboard:', error);
    return errorResponse(error.message || 'Error al obtener dashboard', 500);
  }
}
