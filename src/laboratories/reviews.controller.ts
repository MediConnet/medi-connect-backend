import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { internalErrorResponse, paginatedResponse, successResponse } from '../shared/response';

/**
 * GET /api/laboratories/reviews
 * Obtener reseñas del laboratorio (requiere autenticación)
 */
export async function getLaboratoryReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log('✅ [LABORATORIES] GET /api/laboratories/reviews - Obteniendo reseñas');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [LABORATORIES] Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    // Buscar el provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [LABORATORIES] Provider no encontrado, retornando array vacío');
      return successResponse({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
      }, 200, event);
    }

    console.log('🔍 [LABORATORIES] Provider encontrado:', provider.id);

    // Obtener todas las sucursales del provider
    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: provider.id },
      select: { id: true },
    });

    const branchIds = branches.map((b) => b.id);
    console.log('🔍 [LABORATORIES] Branch IDs:', branchIds);

    const where = { branch_id: { in: branchIds } };

    // Obtener reseñas de todas las sucursales del provider
    const [reviews, total, ratingAgg] = await Promise.all([
      prisma.reviews.findMany({
        where,
        include: {
          patients: {
            select: {
              id: true,
              full_name: true,
              users: {
                select: {
                  profile_picture_url: true,
                },
              },
            },
          },
          provider_branches: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.reviews.count({ where }),
      prisma.reviews.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    const averageRating = ratingAgg._avg.rating || 0;

    console.log(`✅ [LABORATORIES] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`);

    return successResponse({
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.comment,
        patientName: review.patients?.full_name || 'Paciente',
        profilePictureUrl: review.patients?.users?.profile_picture_url || null,
        date: review.created_at,
        branchName: review.provider_branches?.name || null,
      })),
      averageRating: Number(Number(averageRating).toFixed(2)),
      totalReviews: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [LABORATORIES] Error al obtener reseñas:', error.message);
    return internalErrorResponse(error.message || 'Error al obtener reseñas', event);
  }
}
