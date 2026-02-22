import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";
import { createProviderReviewSchema, parseBody } from "../shared/validators";

/**
 * Obtener reseñas de una sucursal (público)
 * GET /api/public/branches/{branchId}/reviews
 */
export async function getProviderReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PUBLIC REVIEWS] GET /api/public/branches/{id}/reviews - Obteniendo reseñas",
  );

  const prisma = getPrismaClient();
  const path = event.rawPath || event.requestContext.http.path;

  try {
    const pathParts = path.split("/");
    const reviewsIndex = pathParts.indexOf("reviews");
    const branchId = reviewsIndex > 0 ? pathParts[reviewsIndex - 1] : null;

    if (!branchId || branchId === "public" || branchId === "api") {
      console.error("❌ [PUBLIC REVIEWS] Branch ID no proporcionado");
      return errorResponse("Branch ID is required", 400, undefined, event);
    }

    console.log("🔍 [PUBLIC REVIEWS] Buscando sucursal:", branchId);

    const branch = await prisma.provider_branches.findFirst({
      where: {
        id: branchId,
        is_active: true,
      },
    });

    if (!branch) {
      console.error("❌ [PUBLIC REVIEWS] Sucursal no encontrada:", branchId);
      return errorResponse("Branch not found", 404, undefined, event);
    }

    console.log(
      "🔍 [PUBLIC REVIEWS] Buscando reseñas para branch_id:",
      branch.id,
    );

    // Obtener reseñas de la sucursal
    const reviews = await prisma.reviews.findMany({
      where: {
        branch_id: branch.id,
      },
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
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

    console.log(
      `✅ [PUBLIC REVIEWS] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`,
    );

    return successResponse(
      {
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || null,
          createdAt: r.created_at,
          patient: r.patients
            ? {
                id: r.patients.id,
                fullName: r.patients.full_name,
                profilePictureUrl:
                  r.patients.users?.profile_picture_url || null,
              }
            : null,
          branch: r.provider_branches
            ? {
                id: r.provider_branches.id,
                name: r.provider_branches.name,
              }
            : null,
        })),
        averageRating: Number(averageRating.toFixed(2)),
        totalReviews: reviews.length,
      },
      200,
      event,
    );
  } catch (error: any) {
    console.error(
      `❌ [PUBLIC REVIEWS] Error al obtener reseñas:`,
      error.message,
    );
    logger.error("Error getting branch reviews", error);
    return internalErrorResponse("Failed to get reviews", event);
  }
}

/**
 * Crear reseña de una sucursal (requiere autenticación)
 * POST /api/public/branches/{branchId}/reviews
 */
export async function createProviderReview(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PUBLIC REVIEWS] POST /api/public/branches/{id}/reviews - Creando reseña",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    console.error(
      "❌ [PUBLIC REVIEWS] POST /api/public/branches/{id}/reviews - Error de autenticación",
    );
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const path = event.rawPath || event.requestContext.http.path;

  try {
    const pathParts = path.split("/");
    const reviewsIndex = pathParts.indexOf("reviews");
    const branchId = reviewsIndex > 0 ? pathParts[reviewsIndex - 1] : null;

    if (!branchId || branchId === "public" || branchId === "api") {
      console.error("❌ [PUBLIC REVIEWS] Branch ID no proporcionado");
      return errorResponse("Branch ID is required", 400, undefined, event);
    }

    // Validar body
    console.log("📝 [PUBLIC REVIEWS] Body recibido:", event.body);
    const body = parseBody(event.body, createProviderReviewSchema);
    console.log("✅ [PUBLIC REVIEWS] Body validado:", body);

    console.log(
      "🔍 [PUBLIC REVIEWS] Buscando paciente para user_id:",
      authContext.user.id,
    );
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      console.error(
        "❌ [PUBLIC REVIEWS] Paciente no encontrado para user_id:",
        authContext.user.id,
      );
      return errorResponse(
        "Patient not found. Please complete your profile first.",
        404,
        undefined,
        event,
      );
    }
    console.log("✅ [PUBLIC REVIEWS] Paciente encontrado:", patient.id);

    // Buscar la sucursal
    console.log("🔍 [PUBLIC REVIEWS] Verificando sucursal:", branchId);
    const branch = await prisma.provider_branches.findFirst({
      where: {
        id: branchId,
        is_active: true,
      },
    });

    if (!branch) {
      console.error("❌ [PUBLIC REVIEWS] Sucursal no encontrada:", branchId);
      return errorResponse("Branch not found", 404, undefined, event);
    }

    console.log("✅ [PUBLIC REVIEWS] Sucursal encontrada:", branch.id);

    // Crear reseña
    const review = await prisma.reviews.create({
      data: {
        id: randomUUID(),
        patient_id: patient.id,
        branch_id: branch.id,
        rating: body.rating,
        comment: body.comment || null,
        appointment_id: body.appointment_id || null,
      },
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
    });

    const allReviews = await prisma.reviews.findMany({
      where: { branch_id: branch.id },
      select: { rating: true },
    });

    let newAverage = body.rating;

    if (allReviews.length > 0) {
      newAverage =
        allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
        allReviews.length;
      await prisma.provider_branches.update({
        where: { id: branch.id },
        data: { rating_cache: newAverage },
      });
      console.log(
        `✅ [PUBLIC REVIEWS] Rating cache actualizado: ${newAverage.toFixed(2)}`,
      );
    }

    console.log(`✅ [PUBLIC REVIEWS] Reseña creada exitosamente: ${review.id}`);

    return successResponse(
      {
        id: review.id,
        rating: review.rating,
        comment: review.comment || null,
        createdAt: review.created_at,
        patient: review.patients
          ? {
              id: review.patients.id,
              fullName: review.patients.full_name,
              profilePictureUrl:
                review.patients.users?.profile_picture_url || null,
            }
          : null,
        branch: review.provider_branches
          ? {
              id: review.provider_branches.id,
              name: review.provider_branches.name,
            }
          : null,
        newAverage: Number(newAverage.toFixed(2)),
        newTotal: allReviews.length > 0 ? allReviews.length : 1,
      },
      201,
      event,
    );
  } catch (error: any) {
    console.error(`❌ [PUBLIC REVIEWS] Error al crear reseña:`, error.message);
    logger.error("Error creating branch review", error);
    if (error.message.includes("Validation error")) {
      return errorResponse(error.message, 400, undefined, event);
    }
    return internalErrorResponse("Failed to create review", event);
  }
}
