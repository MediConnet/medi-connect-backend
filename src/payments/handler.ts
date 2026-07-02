import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import {
  processNuveiPayment,
  handleNuveiWebhook,
  getClientAuthToken,
  initNuveiCheckout,
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
    // --- RUTAS DE NUVEI ---

    // GET /api/payments/client-auth
    // Genera el Auth-Token cliente para la tokenización directa desde la App
    if (path === "/api/payments/client-auth" && method === "GET") {
      return await getClientAuthToken(event);
    }

    // POST /api/payments/init-checkout
    // Inicializa la referencia para el modal de Checkout
    if (path === "/api/payments/init-checkout" && method === "POST") {
      return await initNuveiCheckout(event);
    }

    // POST /api/payments/charge
    // Procesa el pago directo con tarjeta tokenizada
    if (path === "/api/payments/charge" && method === "POST") {
      return await processNuveiPayment(event);
    }

    // POST /api/payments/nuvei/webhook
    // Callback para recibir notificaciones asíncronas de Nuvei
    if (path === "/api/payments/nuvei/webhook" && method === "POST") {
      return await handleNuveiWebhook(event);
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
