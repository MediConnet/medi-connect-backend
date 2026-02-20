import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import { internalErrorResponse, successResponse } from "../shared/response";

export async function getPublicSpecialties(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("✅ [PUBLIC] GET /api/public/specialties - Obteniendo especialidades");

  try {
    const prisma = getPrismaClient();
    const specialties = await prisma.specialties.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color_hex: true,
        _count: { select: { provider_specialties: true } },
      },
    });

    const formatted = specialties.map((s) => ({
      id: s.id,
      name: s.name,
      color_hex: s.color_hex,
      colorHex: s.color_hex, // compat frontend
      doctorsCount: s._count.provider_specialties,
    }));

    return successResponse(formatted, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC] Error al obtener especialidades:", error.message);
    logger.error("Error fetching public specialties", error);
    return internalErrorResponse("Failed to fetch specialties", event);
  }
}

