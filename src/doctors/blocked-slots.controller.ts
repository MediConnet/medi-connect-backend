import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { AuthContext, requireAuth } from "../shared/auth";
import { getPrismaClient } from "../shared/prisma";
import { errorResponse, successResponse } from "../shared/response";

/**
 * GET /api/doctors/blocked-slots
 * Obtener slots bloqueados del médico independiente
 */
export async function getBlockedSlots(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      select: { id: true },
    });

    if (!provider) {
      return successResponse({ data: [] });
    }

    const slots = await prisma.date_block_requests.findMany({
      where: {
        doctor_id: null,
        clinic_id: null,
        reason: { contains: "[INDEPENDENT]" },
      },
      orderBy: { date: "desc" },
    });

    return successResponse({
      data: slots.map((s) => ({
        id: s.id,
        date: s.date?.toISOString(),
        reason: s.reason?.replace("[INDEPENDENT]", "").trim(),
        status: s.status,
      })),
    });
  } catch (error: any) {
    console.error("Error getting blocked slots:", error);
    return errorResponse(error.message || "Error al obtener slots bloqueados");
  }
}

/**
 * POST /api/doctors/blocked-slots
 * Crear slot bloqueado para médico independiente
 */
export async function createBlockedSlot(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();
    const body = JSON.parse(event.body || "{}");

    const block = await prisma.date_block_requests.create({
      data: {
        id: randomUUID(),
        date: new Date(body.date),
        reason: `[INDEPENDENT] ${body.reason || ""}`,
        status: "blocked",
      },
    });

    return successResponse({
      data: {
        id: block.id,
        date: block.date?.toISOString(),
        reason: body.reason || "",
        status: block.status,
      },
    });
  } catch (error: any) {
    console.error("Error creating blocked slot:", error);
    return errorResponse(error.message || "Error al crear slot bloqueado");
  }
}

/**
 * DELETE /api/doctors/blocked-slots/:id
 * Eliminar slot bloqueado
 */
export async function deleteBlockedSlot(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const pathParts = event.requestContext.http.path.split("/");
    const slotId = pathParts[pathParts.length - 1];

    if (!slotId) {
      return errorResponse("ID de slot no proporcionado", 400);
    }

    const slot = await prisma.date_block_requests.findFirst({
      where: {
        id: slotId,
        doctor_id: null,
        clinic_id: null,
      },
    });

    if (!slot) {
      return errorResponse("Slot no encontrado", 404);
    }

    await prisma.date_block_requests.delete({ where: { id: slotId } });

    return successResponse({ data: { id: slotId, deleted: true } });
  } catch (error: any) {
    console.error("Error deleting blocked slot:", error);
    return errorResponse(error.message || "Error al eliminar slot bloqueado");
  }
}
