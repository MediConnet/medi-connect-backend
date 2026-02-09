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
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "./products.controller";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
} from "./orders.controller";

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

    // === PRODUCTOS ===
    
    // 4. GET /api/supplies/products - Listar productos (si se necesita en el futuro)
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

    // === ÓRDENES ===

    // 8. GET /api/supplies/orders - Listar órdenes
    if (path === "/api/supplies/orders" && method === "GET") {
      return await getOrders(event);
    }

    // 9. POST /api/supplies/orders - Crear orden
    if (path === "/api/supplies/orders" && method === "POST") {
      return await createOrder(event);
    }

    // 10. GET /api/supplies/orders/:id - Detalle de orden
    if (path.match(/^\/api\/supplies\/orders\/[^/]+$/) && !path.includes('/status') && method === "GET") {
      return await getOrderById(event);
    }

    // 11. PUT /api/supplies/orders/:id/status - Actualizar estado
    if (path.match(/^\/api\/supplies\/orders\/[^/]+\/status$/) && method === "PUT") {
      return await updateOrderStatus(event);
    }

    // === REVIEWS ===

    // 12. GET /api/supplies/:id/reviews
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === "GET") {
      return await getSupplyStoreReviews(event);
    }

    // 13. POST /api/supplies/:id/reviews
    if (path.match(/^\/api\/supplies\/[^/]+\/reviews$/) && method === "POST") {
      return await createSupplyStoreReview(event);
    }

    // 14. GET /api/supplies/:id - Detalle de tienda
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
