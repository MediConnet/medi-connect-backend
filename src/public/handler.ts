import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import {
  errorResponse,
  internalErrorResponse,
  optionsResponse,
} from "../shared/response";
import { getAllAmbulances, getAmbulanceById } from "./ambulances.controller";
import { getPublicAds, getActiveAds } from "../ads/ads.controller";

import { getAllDoctors, getDoctorById, getDoctorConsultationPrices } from "./doctors.controller";
import { debugConsultationPrices } from "./debug.controller";
import {
  getAllPharmacies,
  getPharmacyBranchById,
  getPharmacyBranches,
  getPharmacyBrands,
} from "./pharmacies.controller";
import {
  createProviderReview,
  getProviderReviews,
} from "./provider-reviews.controller";
import { getCities, getPublicSettings } from "./public.controller";
import { getPublicSpecialties } from "./specialties.controller";
import { getClinics, getClinicById, getClinicSpecialties, getClinicDoctors } from "./clinics.controller";

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

    // GET /api/public/ads o /api/ads/active - Anuncios activos públicos
    if ((path === '/api/public/ads' || path === '/api/ads/active') && method === 'GET') {
      return await getPublicAds(event);
    }

    // DEBUG ENDPOINT - TEMPORAL
    if (
      path.startsWith("/api/public/debug/consultation-prices/") &&
      method === "GET"
    ) {
      return await debugConsultationPrices(event);
    }

    // Listar ciudades
    if (path === "/api/public/cities" && method === "GET") {
      return await getCities(event);
    }

    // Listar especialidades (para registro / filtros públicos)
    if (path === "/api/public/specialties" && method === "GET") {
      return await getPublicSpecialties(event);
    }

    // Configuración pública (para registro)
    if (path === "/api/public/settings" && method === "GET") {
      return await getPublicSettings(event);
    }

    // --- RUTAS GENÉRICAS DE RESEÑAS (Proveedores) ---

    /// GET /api/public/branches/{id}/reviews - Obtener reseñas de CUALQUIER sucursal
    if (
      path.startsWith("/api/public/branches/") &&
      path.endsWith("/reviews") &&
      method === "GET"
    ) {
      return await getProviderReviews(event);
    }

    // POST /api/public/branches/{id}/reviews - Crear reseña para CUALQUIER sucursal
    if (
      path.startsWith("/api/public/branches/") &&
      path.endsWith("/reviews") &&
      method === "POST"
    ) {
      return await createProviderReview(event);
    }

    // --- RUTAS PÚBLICAS DE MÉDICOS ---

    // GET /api/public/doctors
    if (path === "/api/public/doctors" && method === "GET") {
      return await getAllDoctors(event);
    }

    // GET /api/public/doctors/{id}/consultation-prices - Obtener tipos de consulta del médico
    if (
      path.startsWith("/api/public/doctors/") &&
      path.endsWith("/consultation-prices") &&
      method === "GET"
    ) {
      return await getDoctorConsultationPrices(event);
    }

    // GET /api/public/doctors/{id} - Obtener médico por ID
    if (path.startsWith("/api/public/doctors/") && method === "GET") {
      const pathParts = path.split("/");
      const lastPart = pathParts[pathParts.length - 1];

      // Verificamos que no sea la ruta de reviews, consultation-prices ni la raíz
      if (lastPart !== "reviews" && lastPart !== "doctors" && lastPart !== "consultation-prices") {
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

    // --- RUTAS PÚBLICAS DE CLÍNICAS ---

    // GET /api/public/clinics
    if (path === "/api/public/clinics" && method === "GET") {
      return await getClinics(event);
    }

    // GET /api/public/clinics/{id}/specialties
    if (path.startsWith("/api/public/clinics/") && path.endsWith("/specialties") && method === "GET") {
      return await getClinicSpecialties(event);
    }

    // GET /api/public/clinics/{id}/doctors
    if (path.startsWith("/api/public/clinics/") && path.endsWith("/doctors") && method === "GET") {
      return await getClinicDoctors(event);
    }

    // GET /api/public/clinics/{id}
    if (path.startsWith("/api/public/clinics/") && method === "GET") {
      const pathParts = path.split("/");
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart !== "clinics" && lastPart !== "specialties" && lastPart !== "doctors") {
        return await getClinicById(event);
      }
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
