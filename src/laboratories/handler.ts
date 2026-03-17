import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import {
  getAllLaboratories,
  getLaboratoryById,
  getLaboratoryDashboard,
} from "./laboratories.controller";
import { getProfile, updateProfile } from "./profile.controller";
import { getExams, createExam, updateExam, deleteExam } from "./exams.controller";
import { getLaboratoryReviews } from "./reviews.controller";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  const normalizedPath = path.replace(/\/$/, "");

  logger.info("Laboratories handler invoked", { method, path: normalizedPath });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    // GET/PUT /api/laboratories/profile
    if (normalizedPath === "/api/laboratories/profile") {
      if (method === "GET") return await getProfile(event);
      if (method === "PUT") return await updateProfile(event);
    }

    // GET/POST /api/laboratories/exams
    if (normalizedPath === "/api/laboratories/exams") {
      if (method === "GET") return await getExams(event);
      if (method === "POST") return await createExam(event);
    }

    // PUT/DELETE /api/laboratories/exams/:id
    if (normalizedPath.match(/^\/api\/laboratories\/exams\/[^/]+$/)) {
      if (method === "PUT") return await updateExam(event);
      if (method === "DELETE") return await deleteExam(event);
    }

    // GET /api/laboratories/reviews - Obtener reseñas del laboratorio
    if (normalizedPath === "/api/laboratories/reviews" && method === "GET") {
      return await getLaboratoryReviews(event);
    }

    // GET /api/laboratories - Listar laboratorios (y buscar con ?q=...)
    if (normalizedPath === "/api/laboratories" && method === "GET") {
      return await getAllLaboratories(event);
    }

    // GET /api/laboratories/search
    if (normalizedPath === "/api/laboratories/search" && method === "GET") {
      return await getAllLaboratories(event);
    }

    // GET /api/laboratories/:userId/dashboard
    if (
      normalizedPath.match(/^\/api\/laboratories\/[^/]+\/dashboard$/) &&
      method === "GET"
    ) {
      return await getLaboratoryDashboard(event);
    }

    // GET /api/laboratories/{id} - Obtener laboratorio por ID (excluir reserved segments)
    if (normalizedPath.startsWith("/api/laboratories/") && method === "GET") {
      const pathParts = normalizedPath.split("/");
      const lastPart = pathParts[pathParts.length - 1];
      const reserved = ["search", "dashboard", "reviews", "profile", "exams"];
      if (!reserved.includes(lastPart) && !normalizedPath.startsWith("/api/laboratories/exams/")) {
        return await getLaboratoryById(event);
      }
    }

    return errorResponse("Not found", 404, undefined, event);
  } catch (error: any) {
    console.error(
      `❌ [LABORATORIES] ${method} ${path} - Error:`,
      error.message,
    );
    logger.error("Error in laboratories handler", error, { method, path });
    return internalErrorResponse(
      error.message || "Internal server error",
      event,
    );
  }
}
