import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { enum_roles } from "../generated/prisma/client";
import { AuthContext, requireRole } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import { internalErrorResponse, paginatedResponse, successResponse } from "../shared/response";

// GET /api/pharmacies/reviews - Listar reseñas (solo para providers / Panel de Farmacia)
export async function getReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PHARMACIES] GET /api/pharmacies/reviews - Obteniendo reseñas",
  );

  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) {
    console.error(
      "❌ [PHARMACIES] GET /api/pharmacies/reviews - Error de autenticación/autorización",
    );
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    // Buscar provider
    const provider = await prisma.providers.findFirst({
      where: { user_id: userId },
    });

    if (!provider) {
      console.log(
        "⚠️ [PHARMACIES] Provider no encontrado, retornando array vacío de reseñas",
      );
      return successResponse({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
      });
    }

    const where = {
      provider_branches: {
        provider_id: provider.id,
      },
    };
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
          created_at: "desc",
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

    console.log(
      `✅ [PHARMACIES] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`,
    );
    return successResponse({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment || null,
        createdAt: r.created_at,
        patient: r.patients
          ? {
              id: r.patients.id,
              fullName: r.patients.full_name,
              profilePictureUrl: r.patients.users?.profile_picture_url || null,
            }
          : null,
        branch: r.provider_branches
          ? {
              id: r.provider_branches.id,
              name: r.provider_branches.name,
            }
          : null,
      })),
      averageRating: Number(Number(averageRating).toFixed(2)),
      totalReviews: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al obtener reseñas:`, error.message);
    logger.error("Error getting reviews", error);
    return internalErrorResponse("Failed to get reviews");
  }
}
