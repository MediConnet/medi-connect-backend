import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import {
  createSupplyStoreReview,
  getSupplyStoreById,
  getSupplyStoreDashboard,
  getSupplyStoreReviews,
  getSupplyStores,
} from "./supplies.controller";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`🔍 [SUPPLIES HANDLER] Método: ${method}, Path: ${path}`);
  logger.info("Supplies handler invoked", { method, path });

  if (method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    // 1. GET /api/supplies/search
    if (path === "/api/supplies/search" && method === "GET") {
      return await getSupplyStores(event);
    }

    // 2. GET /api/supplies - Listar todas
    if (path === "/api/supplies" && method === "GET") {
      return await getSupplyStores(event);
    }

    // 3. GET /api/supplies/:userId/dashboard
    if (path.match(/^\/api\/supplies\/[^/]+\/dashboard$/) && method === "GET") {
      return await getSupplyStoreDashboard(event);
    }

    // 4. GET /api/supplies/:id/reviews
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === "GET") {
      return await getSupplyStoreReviews(event);
    }

    // 5. POST /api/supplies/:id/reviews
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === "POST") {
      return await createSupplyStoreReview(event);
    }

    // 6. GET /api/supplies/:id
    if (path.match(/^\/api\/supplies\/[^/]+$/) && method === "GET") {
      return await getSupplyStoreById(event);
    }

    console.log(`❌ [SUPPLIES HANDLER] Ruta no encontrada: ${method} ${path}`);
    return errorResponse(`Route not found: ${method} ${path}`, 404);
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] ${method} ${path} - Error:`, error.message);
    logger.error("Error in supplies handler", error, { method, path });
    return internalErrorResponse(error.message || "Internal server error");
  }
}
