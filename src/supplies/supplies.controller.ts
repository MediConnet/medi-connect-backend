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

    // Obtener la categoría de insumos
    const suppliesCategory = await prisma.service_categories.findFirst({
      where: { slug: 'supplies' },
    });

    if (!suppliesCategory) {
      return errorResponse('Categoría de insumos no encontrada', 404);
    }

    // Obtener proveedores de tipo insumos con sus sucursales principales
    const providers = await prisma.providers.findMany({
      where: {
        category_id: suppliesCategory.id,
        verification_status: 'APPROVED',
      },
      include: {
        provider_branches: {
          where: {
            is_active: true,
            is_main: true,
          },
          take: 1,
        },
      },
    });

    const formattedStores = providers.map((provider) => {
      const mainBranch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || 'Tienda de Insumos',
        description: provider.description,
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
        imageUrl: provider.logo_url,
      };
    });

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

    const provider = await prisma.providers.findUnique({
      where: { id: storeId },
      include: {
        provider_branches: {
          where: { is_active: true },
        },
      },
    });

    if (!provider) {
      return errorResponse('Tienda no encontrada', 404);
    }

    const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || 'Tienda de Insumos',
      description: provider.description,
      address: mainBranch?.address_text || '',
      phone: mainBranch?.phone_contact || '',
      whatsapp: mainBranch?.phone_contact || '',
      email: mainBranch?.email_contact || '',
      rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
      imageUrl: provider.logo_url,
      latitude: mainBranch?.latitude ? parseFloat(mainBranch.latitude.toString()) : null,
      longitude: mainBranch?.longitude ? parseFloat(mainBranch.longitude.toString()) : null,
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

    // Obtener las sucursales del proveedor
    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: storeId },
      select: { id: true },
    });

    const branchIds = branches.map((b) => b.id);

    // Obtener reseñas de todas las sucursales
    const reviews = await prisma.reviews.findMany({
      where: { branch_id: { in: branchIds } },
      include: {
        patients: {
          select: {
            full_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      supplyStoreId: storeId,
      userId: review.patient_id,
      userName: review.patients?.full_name || 'Usuario',
      rating: review.rating || 0,
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

    // Verificar que el proveedor existe
    const provider = await prisma.providers.findUnique({
      where: { id: storeId },
      include: {
        provider_branches: {
          where: { is_main: true },
          take: 1,
        },
      },
    });

    if (!provider || provider.provider_branches.length === 0) {
      return errorResponse('Tienda no encontrada', 404);
    }

    const mainBranch = provider.provider_branches[0];

    // Obtener el paciente del usuario
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse('Paciente no encontrado', 404);
    }

    // Crear reseña
    const review = await prisma.reviews.create({
      data: {
        id: randomUUID(),
        branch_id: mainBranch.id,
        patient_id: patient.id,
        rating,
        comment: comment || null,
        created_at: new Date(),
      },
      include: {
        patients: {
          select: {
            full_name: true,
          },
        },
      },
    });

    // Actualizar rating promedio de la sucursal
    const avgRating = await prisma.reviews.aggregate({
      where: { branch_id: mainBranch.id },
      _avg: { rating: true },
    });

    await prisma.provider_branches.update({
      where: { id: mainBranch.id },
      data: { rating_cache: avgRating._avg.rating || 0 },
    });

    return successResponse({
      id: review.id,
      supplyStoreId: storeId,
      userId: patient.id,
      userName: review.patients?.full_name || 'Usuario',
      rating: review.rating || 0,
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

    if (authContext.user.role !== 'supplies' && authContext.user.role !== 'provider') {
      return errorResponse('No autorizado. Debe ser proveedor de insumos', 403);
    }

    const prisma = getPrismaClient();

    // Buscar proveedor del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        provider_branches: {
          where: { is_active: true },
        },
        provider_catalog: {
          where: { is_available: true },
          take: 10,
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!provider) {
      return errorResponse('Tienda no encontrada', 404);
    }

    const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];

    // Calcular estadísticas
    const totalProducts = await prisma.provider_catalog.count({
      where: { provider_id: provider.id },
    });

    // Por ahora, las órdenes no están implementadas en el sistema
    // Se pueden agregar más adelante cuando se implemente el módulo de pedidos
    const totalOrders = 0;
    const pendingOrders = 0;
    const completedOrders = 0;

    return successResponse({
      store: {
        id: provider.id,
        name: provider.commercial_name || 'Tienda de Insumos',
        description: provider.description,
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        whatsapp: mainBranch?.phone_contact || '',
      },
      stats: {
        totalProducts,
        totalOrders,
        pendingOrders,
        completedOrders,
      },
      recentOrders: [],
      products: provider.provider_catalog.map((product) => ({
        id: product.id,
        name: product.name || '',
        price: product.price ? parseFloat(product.price.toString()) : 0,
        stock: 0, // El campo stock no existe en provider_catalog
        imageUrl: product.image_url,
      })),
    });
  } catch (error: any) {
    console.error('Error getting supply store dashboard:', error);
    return errorResponse(error.message || 'Error al obtener dashboard', 500);
  }
}
