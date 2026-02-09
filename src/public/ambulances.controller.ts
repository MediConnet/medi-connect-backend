import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";
import { extractIdFromPath } from "../shared/validators";

// --- HELPERS ---

/**
 * Normaliza el texto: elimina tildes, pasa a minúsculas y elimina espacios extra.
 */
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

/**
 * Función Helper para mapear el objeto de base de datos al formato del frontend.
 */
function mapAmbulanceData(ambulance: any) {
  const mainBranch =
    ambulance.provider_branches.find((b: any) => b.is_main) ||
    ambulance.provider_branches[0];

  const horarioAtencion =
    mainBranch?.opening_hours_text || "Horario no disponible";

  let disponible24h = false;
  if (mainBranch?.is_24h !== null && mainBranch?.is_24h !== undefined) {
    disponible24h = mainBranch.is_24h;
  } else {
    disponible24h = horarioAtencion.toLowerCase().includes("24 horas");
  }

  const tiposArray: string[] = mainBranch?.ambulance_types || [];
  const tipoDisplay =
    tiposArray.length > 0 ? tiposArray.join(" • ") : "General";

  const zonaCobertura =
    mainBranch?.coverage_area || "Cobertura no especificada";

  return {
    id: ambulance.id,
    nombre: mainBranch?.name || ambulance.commercial_name || "",
    descripcion: ambulance.description || "",
    direccion: mainBranch?.address_text || "",
    ciudad: mainBranch?.cities?.name || "",
    codigoPostal: "",
    telefono: mainBranch?.phone_contact || "",
    email: ambulance.users?.email || mainBranch?.email_contact || "",

    horarioAtencion: horarioAtencion,

    latitud: mainBranch?.latitude ? Number(mainBranch.latitude) : null,
    longitud: mainBranch?.longitude ? Number(mainBranch.longitude) : null,
    imagen:
      ambulance.logo_url ||
      mainBranch?.image_url ||
      ambulance.users?.profile_picture_url ||
      "",

    calificacion: 0,

    disponible24h: disponible24h,

    tipo: tipoDisplay,
    servicios: tiposArray,

    zonaCobertura: zonaCobertura,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// --- CONTROLLERS ---

/**
 * Listar ambulancias públicas (sin autenticación)
 * GET /api/ambulances
 * Soporta filtros: q (search), city, page, limit
 */
export async function getAllAmbulances(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const searchQuery = queryParams.q || queryParams.search || "";
  const cityParam = queryParams.city || "";

  console.log(
    `✅ [PUBLIC AMBULANCES] Listando. Búsqueda: "${searchQuery}", Ciudad: "${cityParam}"`,
  );

  try {
    const prisma = getPrismaClient();

    // Parámetros de paginación
    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "20", 10);
    const offset = (page - 1) * limit;

    // Filtros base
    const where: any = {
      category_id: 4,
      verification_status: "APPROVED",
      users: {
        is_active: true,
      },
      provider_branches: {
        some: {
          is_active: true,
        },
      },
    };

    const allAmbulances = await prisma.providers.findMany({
      where,
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
        provider_branches: {
          where: { is_active: true },
          include: {
            cities: { select: { id: true, name: true } },
          },
          orderBy: { is_main: "desc" },
        },
      },
      orderBy: {
        commercial_name: "asc",
      },
    });

    let filteredAmbulances = allAmbulances;

    // Lógica de filtrado en memoria
    if (searchQuery.trim().length > 0 || cityParam.trim().length > 0) {
      const term = normalizeText(searchQuery);
      const cityTerm = normalizeText(cityParam);

      filteredAmbulances = allAmbulances.filter((doc) => {
        const mainBranch =
          doc.provider_branches.find((b) => b.is_main) ||
          doc.provider_branches[0];

        const branchName = normalizeText(mainBranch?.name);
        const commercialName = normalizeText(doc.commercial_name);
        const description = normalizeText(doc.description);

        const coverageText = normalizeText(mainBranch?.coverage_area);

        const serviceTypes = (mainBranch?.ambulance_types || [])
          .map((t: string) => normalizeText(t))
          .join(" ");

        const branchesText = doc.provider_branches
          .map((b) => {
            return (
              normalizeText(b.name) +
              " " +
              normalizeText(b.address_text) +
              " " +
              normalizeText(b.cities?.name)
            );
          })
          .join(" ");

        const matchesSearch =
          term === "" ||
          branchName.includes(term) ||
          commercialName.includes(term) ||
          description.includes(term) ||
          serviceTypes.includes(term) ||
          coverageText.includes(term) ||
          branchesText.includes(term);

        const matchesCity = cityTerm === "" || branchesText.includes(cityTerm);

        return matchesSearch && matchesCity;
      });
    }

    const total = filteredAmbulances.length;
    const paginatedAmbulances = filteredAmbulances.slice(
      offset,
      offset + limit,
    );

    const formattedAmbulances = paginatedAmbulances.map(mapAmbulanceData);

    console.log(
      `✅ [PUBLIC AMBULANCES] Retornando ${formattedAmbulances.length} de ${total} ambulancias.`,
    );

    return successResponse(
      {
        ambulances: formattedAmbulances,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      200,
      event,
    );
  } catch (error: any) {
    console.error(
      "❌ [PUBLIC AMBULANCES] Error al listar ambulancias:",
      error.message,
    );
    logger.error("Error fetching public ambulances", error);
    return internalErrorResponse("Error al obtener ambulancias", event);
  }
}

/**
 * Obtener ambulancia pública por ID
 * GET /api/ambulances/{id}
 */
export async function getAmbulanceById(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PUBLIC AMBULANCES] GET /api/ambulances/{id} - Obteniendo ambulancia",
  );

  try {
    const ambulanceId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/ambulances/",
    );

    if (!ambulanceId) {
      return errorResponse("Ambulance ID is required", 400, undefined, event);
    }

    const prisma = getPrismaClient();

    const ambulance = await prisma.providers.findFirst({
      where: {
        id: ambulanceId,
        category_id: 4,
        verification_status: "APPROVED",
        users: { is_active: true },
        provider_branches: { some: { is_active: true } },
      },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
        provider_branches: {
          where: { is_active: true },
          include: {
            cities: { select: { id: true, name: true, state: true } },
          },
          orderBy: { is_main: "desc" },
        },
      },
    });

    if (!ambulance) {
      return errorResponse("Ambulance not found", 404, undefined, event);
    }

    const formattedAmbulance = mapAmbulanceData(ambulance);

    console.log(
      `✅ [PUBLIC AMBULANCES] Ambulancia encontrada: ${formattedAmbulance.nombre}`,
    );

    return successResponse(formattedAmbulance, 200, event);
  } catch (error: any) {
    console.error(
      "❌ [PUBLIC AMBULANCES] Error al obtener ambulancia:",
      error.message,
    );
    logger.error("Error fetching ambulance by id", error);
    return internalErrorResponse("Error al obtener ambulancia", event);
  }
}
