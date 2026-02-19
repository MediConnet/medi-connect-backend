import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";
import { parseBody } from "../shared/validators";

// Validación del body
const updateTokenSchema = z.object({
  push_token: z.string().min(1, "Token is required"),
});

/**
 * Actualizar el Push Token del usuario logueado
 * PUT /api/patients/device/token
 */
export async function updateDeviceToken(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("📲 [DEVICE] Actualizando token de notificación");

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, updateTokenSchema);

    await prisma.users.update({
      where: { id: authContext.user.id },
      data: {
        push_token: body.push_token,
      },
    });

    console.log(
      `✅ [DEVICE] Token actualizado para: ${authContext.user.email}`,
    );

    return successResponse(
      { message: "Device token updated successfully" },
      200,
      event,
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse("Validation error", 400, error.errors, event);
    }
    console.error("❌ [DEVICE] Error updating token:", error.message);
    logger.error("Error updating device token", error);
    return internalErrorResponse("Failed to update device token", event);
  }
}
