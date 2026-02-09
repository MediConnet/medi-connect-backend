import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import {
  getAmbulanceProfile,
  getAmbulanceReviews,
  getAmbulanceSettings,
  updateAmbulanceProfile,
} from "./ambulances.controller";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info("Ambulances (Panel) handler invoked", { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    // --- RUTAS DEL PANEL DE AMBULANCIA (PRIVADAS) ---

    // GET /api/ambulances/profile - Obtener perfil propio
    if (path === "/api/ambulances/profile" && method === "GET") {
      return await getAmbulanceProfile(event);
    }

    // PUT /api/ambulances/profile - Actualizar perfil propio
    if (path === "/api/ambulances/profile" && method === "PUT") {
      return await updateAmbulanceProfile(event);
    }

    // GET /api/ambulances/reviews - Obtener mis reseñas
    if (path === "/api/ambulances/reviews" && method === "GET") {
      return await getAmbulanceReviews(event);
    }

    // GET /api/ambulances/settings - Obtener mi configuración
    if (path === "/api/ambulances/settings" && method === "GET") {
      return await getAmbulanceSettings(event);
    }

    // Nota: Las rutas públicas (Listar, Buscar, Detalle por ID) se manejan
    // en el handler público, por lo que se eliminaron de aquí.

    return errorResponse("Not found", 404, undefined, event);
  } catch (error: any) {
    logger.error("Error in ambulances private handler", error, {
      method,
      path,
    });
    return internalErrorResponse(
      error.message || "Internal server error",
      event,
    );
  }
}
