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
  getMySupplyStoreReviews,
  getSuppliesProfile,
  getSupplyStores,
  updateSuppliesProfile,
} from "./supplies.controller";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
} from "./products.controller";

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
    // 0. GET/PUT /api/supplies/profile (panel - autenticado)
    if (path === "/api/supplies/profile") {
      if (method === "GET") return await getSuppliesProfile(event);
      if (method === "PUT") return await updateSuppliesProfile(event);
    }

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

    // === PRODUCTOS ===
    
    // 4. GET /api/supplies/products - Listar productos
    if (path === "/api/supplies/products" && method === "GET") {
      return await getProducts(event);
    }

    // 5. POST /api/supplies/products - Crear producto
    if (path === "/api/supplies/products" && method === "POST") {
      return await createProduct(event);
    }

    // 6. PUT /api/supplies/products/:id - Actualizar producto
    if (path.match(/^\/api\/supplies\/products\/[^/]+$/) && method === "PUT") {
      return await updateProduct(event);
    }

    // 7. DELETE /api/supplies/products/:id - Eliminar producto
    if (path.match(/^\/api\/supplies\/products\/[^/]+$/) && method === "DELETE") {
      return await deleteProduct(event);
    }

    // === REVIEWS ===

    // 8. GET /api/supplies/reviews - Obtener mis reseñas (panel)
    if (path === "/api/supplies/reviews" && method === "GET") {
      return await getMySupplyStoreReviews(event);
    }

    // 9. GET /api/supplies/:id/reviews - Obtener reseñas de una tienda (público)
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === "GET") {
      return await getSupplyStoreReviews(event);
    }

    // 10. POST /api/supplies/:id/reviews
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === "POST") {
      return await createSupplyStoreReview(event);
    }

    // 11. GET /api/supplies/:id - Detalle de tienda
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
