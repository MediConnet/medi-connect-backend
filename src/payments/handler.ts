import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import {
  generatePaymentLink,
  handlePayphoneWebhook,
} from "./payments.controller";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`\n💰 [PAYMENTS HANDLER] ${method} ${path} - Handler invocado`);

  // 1. Manejo de CORS (Preflight requests)
  if (method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    // --- RUTAS DE PAYPHONE ---

    // POST /api/payments/payphone/link
    // Genera el link de pago para una cita
    if (path === "/api/payments/payphone/link" && method === "POST") {
      return await generatePaymentLink(event);
    }

    // POST /api/payments/NotificacionPago
    if (path === "/api/payments/NotificacionPago" && method === "POST") {
      return await handlePayphoneWebhook(event);
    }

    console.warn(`⚠️ [PAYMENTS] Ruta no encontrada: ${method} ${path}`);
    return errorResponse("Route not found in payments module", 404);
  } catch (error: any) {
    console.error(`❌ [PAYMENTS] Error no controlado:`, error.message);
    logger.error("Unhandled error in payments handler", error, {
      method,
      path,
    });
    return internalErrorResponse(
      "Internal server error in payments module",
      event,
    );
  }
}
