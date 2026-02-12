import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import { getAllAmbulances, getAmbulanceById } from "./ambulances.controller";
import {
  createDoctorReview,
  getDoctorReviews,
} from "./doctors-reviews.controller";
import { getAllDoctors, getDoctorById } from "./doctors.controller";
import {
  getAllPharmacies,
  getPharmacyBranchById,
  getPharmacyBranches,
  getPharmacyBrands,
} from "./pharmacies.controller";
import { getCities } from "./public.controller";
import { getPublicSpecialties } from "./specialties.controller";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info("Public handler invoked", { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    // --- RUTAS GENERALES / UTILITARIAS ---

    // Listar ciudades
    if (path === "/api/public/cities" && method === "GET") {
      return await getCities(event);
    }

    // Listar especialidades (para registro / filtros públicos)
    if (path === "/api/public/specialties" && method === "GET") {
      return await getPublicSpecialties(event);
    }

    // --- RUTAS PÚBLICAS DE MÉDICOS ---

    // GET /api/public/doctors
    if (path === "/api/public/doctors" && method === "GET") {
      return await getAllDoctors(event);
    }

    // GET /api/public/doctors/{id}/reviews - Obtener reseñas de un doctor
    if (
      path.startsWith("/api/public/doctors/") &&
      path.endsWith("/reviews") &&
      method === "GET"
    ) {
      return await getDoctorReviews(event);
    }

    // POST /api/public/doctors/{id}/reviews - Crear reseña de un doctor
    if (
      path.startsWith("/api/public/doctors/") &&
      path.endsWith("/reviews") &&
      method === "POST"
    ) {
      return await createDoctorReview(event);
    }

    // GET /api/public/doctors/{id} - Obtener médico por ID
    if (path.startsWith("/api/public/doctors/") && method === "GET") {
      const pathParts = path.split("/");
      const lastPart = pathParts[pathParts.length - 1];

      if (lastPart !== "reviews" && lastPart !== "doctors") {
        return await getDoctorById(event);
      }
    }

    // --- RUTAS PÚBLICAS DE FARMACIAS ---

    // GET /api/public/pharmacies/brands - Listar marcas
    if (path === "/api/public/pharmacies/brands" && method === "GET") {
      return await getPharmacyBrands(event);
    }

    // GET /api/public/pharmacies/brands/{brandId}/branches - Sucursales por marca
    if (
      path.startsWith("/api/public/pharmacies/brands/") &&
      path.endsWith("/branches") &&
      method === "GET"
    ) {
      return await getPharmacyBranches(event);
    }

    // GET /api/public/pharmacies/branches/{id} - Obtener sucursal por ID
    if (
      path.startsWith("/api/public/pharmacies/branches/") &&
      method === "GET"
    ) {
      return await getPharmacyBranchById(event);
    }

    // GET /api/public/pharmacies - Listar todas las farmacias (alternativa)
    if (path === "/api/public/pharmacies" && method === "GET") {
      return await getAllPharmacies(event);
    }

    // --- RUTAS PÚBLICAS DE AMBULANCIAS ---

    // GET /api/public/ambulances
    if (path === "/api/public/ambulances" && method === "GET") {
      return await getAllAmbulances(event);
    }

    // GET /api/public/ambulances/{id}
    if (path.startsWith("/api/public/ambulances/") && method === "GET") {
      return await getAmbulanceById(event);
    }

    // Si no coincide ninguna ruta
    console.log(`❌ [PUBLIC] ${method} ${path} - Ruta no encontrada`);
    return errorResponse("Not found", 404, undefined, event);
  } catch (error: any) {
    console.error(`❌ [PUBLIC] ${method} ${path} - Error:`, error.message);
    logger.error("Error in public handler", error, { method, path });
    return internalErrorResponse(
      error.message || "Internal server error",
      event,
    );
  }
}
