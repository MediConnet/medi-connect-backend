import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse, unauthorizedResponse } from '../shared/response';
import { requireRole } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';
import { extractIdFromPath } from '../shared/validators';
import { logger } from '../shared/logger';
import { z } from 'zod';

// Schema para crear reseña
const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000).optional(),
});

// GET /api/supplies
export async function getSupplies(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies - Obteniendo lista de tiendas');
  
  const prisma = getPrismaClient();
  
  try {
    // Buscar providers con categoría "supplies" o "insumos"
    const suppliesCategory = await prisma.service_categories.findFirst({
      where: {
        OR: [
          { slug: 'supplies' },
          { slug: 'insumos' },
          { name: { contains: 'insumo', mode: 'insensitive' } },
        ],
      },
    });

    if (!suppliesCategory) {
      console.warn('⚠️ [SUPPLIES] No se encontró categoría de insumos, retornando array vacío');
      return successResponse([]);
    }

    const providers = await prisma.providers.findMany({
      where: {
        category_id: suppliesCategory.id,
        verification_status: 'APPROVED',
      },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1,
        },
        service_categories: {
          select: { name: true, slug: true },
        },
      },
      take: 50,
    });

    const supplies = providers.map(provider => {
      const branch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || 'Tienda de Insumos',
        description: provider.description || null,
        address: branch?.address_text || null,
        phone: branch?.phone_contact || null,
        rating: Number(branch?.rating_cache || 0),
        imageUrl: branch?.image_url || provider.logo_url || null,
      };
    });

    return successResponse(supplies);
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] Error al obtener tiendas:`, error.message);
    logger.error('Error getting supplies', error);
    return internalErrorResponse('Failed to get supplies');
  }
}

// GET /api/supplies/:id
export async function getSupplyById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies/:id - Obteniendo detalle de tienda');
  
  const prisma = getPrismaClient();
  const supplyId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/');
  
  if (!supplyId) {
    return errorResponse('Supply ID is required', 400);
  }

  try {
    const provider = await prisma.providers.findFirst({
      where: { id: supplyId },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1,
        },
        service_categories: {
          select: { name: true, slug: true },
        },
      },
    });

    if (!provider) {
      return notFoundResponse('Supply store not found');
    }

    const branch = provider.provider_branches[0];
    return successResponse({
      id: provider.id,
      name: provider.commercial_name || 'Tienda de Insumos',
      description: provider.description || null,
      address: branch?.address_text || null,
      phone: branch?.phone_contact || null,
      rating: Number(branch?.rating_cache || 0),
      imageUrl: branch?.image_url || provider.logo_url || null,
    });
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] Error al obtener tienda:`, error.message);
    logger.error('Error getting supply by id', error);
    return internalErrorResponse('Failed to get supply');
  }
}

// GET /api/supplies/:id/reviews
export async function getSupplyReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies/:id/reviews - Obteniendo reseñas');
  
  const prisma = getPrismaClient();
  const supplyId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/');
  
  if (!supplyId) {
    return errorResponse('Supply ID is required', 400);
  }

  try {
    // Buscar reviews de las branches del provider
    const provider = await prisma.providers.findFirst({
      where: { id: supplyId },
      include: {
        provider_branches: {
          select: { id: true },
        },
      },
    });

    if (!provider) {
      return notFoundResponse('Supply store not found');
    }

    const branchIds = provider.provider_branches.map(b => b.id);

    const reviews = await prisma.reviews.findMany({
      where: {
        branch_id: { in: branchIds },
      },
      include: {
        patients: {
          include: {
            users: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const reviewsData = reviews.map(review => ({
      id: review.id,
      supplyStoreId: supplyId,
      userId: review.patient_id || null,
      userName: review.patients?.full_name || 'Usuario',
      rating: review.rating || 0,
      comment: review.comment || null,
      createdAt: review.created_at?.toISOString() || new Date().toISOString(),
    }));

    return successResponse(reviewsData);
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] Error al obtener reseñas:`, error.message);
    logger.error('Error getting supply reviews', error);
    return internalErrorResponse('Failed to get reviews');
  }
}

// POST /api/supplies/:id/reviews
export async function createSupplyReview(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] POST /api/supplies/:id/reviews - Creando reseña');
  
  const authResult = await requireRole(event, [enum_roles.patient]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  const { randomUUID } = await import('crypto');
  const supplyId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/');
  
  if (!supplyId) {
    return errorResponse('Supply ID is required', 400);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const validated = createReviewSchema.parse(body);

    // Buscar provider y su branch principal
    const provider = await prisma.providers.findFirst({
      where: { id: supplyId },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    if (!provider || provider.provider_branches.length === 0) {
      return notFoundResponse('Supply store not found');
    }

    const branch = provider.provider_branches[0];

    // Buscar paciente del usuario autenticado
    const patient = await prisma.patients.findFirst({
      where: { user_id: authResult.user.id },
    });

    if (!patient) {
      return notFoundResponse('Patient profile not found');
    }

    const review = await prisma.reviews.create({
      data: {
        id: randomUUID(),
        patient_id: patient.id,
        branch_id: branch.id,
        rating: validated.rating,
        comment: validated.comment || null,
      },
      include: {
        patients: {
          include: {
            users: {
              select: { email: true },
            },
          },
        },
      },
    });

    return successResponse({
      id: review.id,
      supplyStoreId: supplyId,
      userId: review.patient_id || null,
      userName: review.patients?.full_name || 'Usuario',
      rating: review.rating || 0,
      comment: review.comment || null,
      createdAt: review.created_at?.toISOString() || new Date().toISOString(),
    }, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400);
    }
    console.error(`❌ [SUPPLIES] Error al crear reseña:`, error.message);
    logger.error('Error creating supply review', error);
    return internalErrorResponse('Failed to create review');
  }
}

// GET /api/supplies/:userId/dashboard
export async function getSupplyDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies/:userId/dashboard - Obteniendo dashboard');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  const path = event.requestContext.http.path;
  // Extraer userId del path: /api/supplies/{userId}/dashboard
  const pathParts = path.split('/');
  const userIdIndex = pathParts.indexOf('supplies') + 1;
  const userId = pathParts[userIdIndex];

  // Verificar que el userId coincida con el usuario autenticado
  if (userId !== authResult.user.id) {
    return unauthorizedResponse('Unauthorized');
  }

  try {
    // Buscar provider del usuario
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authResult.user.id,
      },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1,
        },
        service_categories: {
          select: { name: true, slug: true },
        },
      },
    });

    if (!provider) {
      return notFoundResponse('Supply store not found');
    }

    const branch = provider.provider_branches[0];

    // Obtener estadísticas (mock por ahora, ya que no hay tabla de productos/órdenes)
    const stats = {
      totalProducts: 0, // TODO: Implementar cuando haya tabla de productos
      totalOrders: 0, // TODO: Implementar cuando haya tabla de órdenes
      pendingOrders: 0,
      completedOrders: 0,
    };

    return successResponse({
      store: {
        id: provider.id,
        name: provider.commercial_name || 'Tienda de Insumos',
        description: provider.description || null,
        address: branch?.address_text || null,
        phone: branch?.phone_contact || null,
        whatsapp: branch?.phone_contact || null,
      },
      stats,
      recentOrders: [], // TODO: Implementar cuando haya tabla de órdenes
      products: [], // TODO: Implementar cuando haya tabla de productos
    });
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] Error al obtener dashboard:`, error.message);
    logger.error('Error getting supply dashboard', error);
    return internalErrorResponse('Failed to get dashboard');
  }
}
