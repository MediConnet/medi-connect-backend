import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import { internalErrorResponse, paginatedResponse, successResponse } from "../shared/response";

export async function getPublicSpecialties(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("✅ [PUBLIC] GET /api/public/specialties - Obteniendo especialidades");

  try {
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '50', 10);
    const offset = (page - 1) * limit;

    const [specialties, total] = await Promise.all([
      prisma.specialties.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          color_hex: true,
          _count: { select: { provider_specialties: true } },
        },
        skip: offset,
        take: limit,
      }),
      prisma.specialties.count(),
    ]);

    const formatted = specialties.map((s) => ({
      id: s.id,
      name: s.name,
      color_hex: s.color_hex,
      colorHex: s.color_hex, // compat frontend
      doctorsCount: s._count.provider_specialties,
    }));

    return paginatedResponse(formatted, total, page, limit, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC] Error al obtener especialidades:", error.message);
    logger.error("Error fetching public specialties", error);
    return internalErrorResponse("Failed to fetch specialties", event);
  }
}

