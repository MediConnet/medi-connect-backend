import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { formatSmartSchedule } from "../shared/helpers/scheduleFormatter";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";
import { extractIdFromPath } from "../shared/validators";

// Helper para obtener la hora actual de Ecuador (UTC-5) para los filtros
const getEcuadorTime = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ecuadorTime = new Date(utc + 3600000 * -5);
  return ecuadorTime;
};

/**
 * Listar marcas de farmacias
 * GET /api/public/pharmacies/brands
 */
export async function getPharmacyBrands(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PUBLIC PHARMACIES] GET /api/public/pharmacies/brands - Listando marcas",
  );

  try {
    const prisma = getPrismaClient();

    try {
      const chains = await prisma.pharmacy_chains.findMany({
        where: { is_active: true },
        select: { id: true, name: true, logo_url: true },
        orderBy: { name: "asc" },
      });

      if (chains.length > 0) {
        const brands = chains.map((chain) => ({
          id: chain.id,
          nombre: chain.name,
          logo: chain.logo_url || "",
          color: "#002F87",
        }));
        return successResponse(brands, 200, event);
      }
    } catch (prismaError: any) {
      console.log("⚠️ Error consultando pharmacy_chains:", prismaError.message);
    }

    // 2. Fallback: Usar Providers individuales
    return await getPharmacyBrandsFallback(prisma, event);
  } catch (error: any) {
    console.error("❌ Error brands:", error.message);
    logger.error("Error fetching pharmacy brands", error);
    return internalErrorResponse("Failed to fetch pharmacy brands", event);
  }
}

async function getPharmacyBrandsFallback(
  prisma: any,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("⚠️ Ejecutando fallback con providers...");

  try {
    const pharmacies = await prisma.providers.findMany({
      where: {
        service_categories: { slug: "pharmacy" },
        verification_status: "APPROVED",
        users: { is_active: true },
        provider_branches: { some: { is_active: true } },
      },
      select: { id: true, commercial_name: true, logo_url: true },
      orderBy: { commercial_name: "asc" },
    });

    const uniqueBrandsMap = new Map();
    pharmacies.forEach((pharmacy: any) => {
      const name = pharmacy.commercial_name || "";
      if (name && !uniqueBrandsMap.has(name)) {
        uniqueBrandsMap.set(name, {
          id: pharmacy.id,
          nombre: name,
          logo: pharmacy.logo_url || "",
          color: "#002F87",
        });
      }
    });

    const brands = Array.from(uniqueBrandsMap.values());
    return successResponse(brands, 200, event);
  } catch (error: any) {
    console.error("❌ Fallback error:", error.message);
    throw error;
  }
}

/**
 * Listar sucursales por marca con FILTROS
 * GET /api/public/pharmacies/brands/{brandId}/branches
 */
export async function getPharmacyBranches(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("✅ [PUBLIC PHARMACIES] GET .../branches - Listando sucursales");

  try {
    const brandId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/public/pharmacies/brands/",
      "/branches",
    );

    if (!brandId) {
      return errorResponse("Brand ID is required", 400, undefined, event);
    }

    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};

    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "20", 10);
    const offset = (page - 1) * limit;

    // --- FILTROS ---
    const city = queryParams.city;
    const hasDelivery = queryParams.hasDelivery === "true";
    const is24h = queryParams.is24h === "true";
    const isOpen = queryParams.isOpen === "true";

    const where: any = {
      is_active: true,
      providers: {
        OR: [{ chain_id: brandId }, { id: brandId }],
        service_categories: { slug: "pharmacy" },
        verification_status: "APPROVED",
        users: { is_active: true },
      },
    };

    if (city) {
      where.cities = { name: { contains: city, mode: "insensitive" } };
    }

    if (hasDelivery) {
      where.has_delivery = true;
    }

    if (is24h) {
      where.is_24h = true;
    }

    if (isOpen) {
      const ecuadorTime = getEcuadorTime();
      const currentDay = ecuadorTime.getDay();
      const hours = ecuadorTime.getUTCHours().toString().padStart(2, "0");
      const mins = ecuadorTime.getUTCMinutes().toString().padStart(2, "0");
      const secs = ecuadorTime.getUTCSeconds().toString().padStart(2, "0");
      const timeString = `${hours}:${mins}:${secs}`;

      const openSchedules = await prisma.$queryRaw<{ branch_id: string }[]>`
        SELECT branch_id 
        FROM provider_schedules 
        WHERE day_of_week = ${currentDay}
        AND (is_active IS TRUE OR is_active IS NULL)
        AND (
          (start_time <= end_time AND ${timeString}::time >= start_time AND ${timeString}::time < end_time)
          OR
          (start_time > end_time AND (${timeString}::time >= start_time OR ${timeString}::time < end_time))
        )
      `;

      const openBranchIds = openSchedules.map((s) => s.branch_id);

      where.AND = [
        ...(where.AND || []),
        {
          OR: [{ is_24h: true }, { id: { in: openBranchIds } }],
        },
      ];
    }

    const [branches, total] = await Promise.all([
      prisma.provider_branches.findMany({
        where,
        include: {
          cities: { select: { id: true, name: true } },
          providers: {
            select: { id: true, commercial_name: true, logo_url: true },
          },
          provider_schedules: true,
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.provider_branches.count({ where }),
    ]);

    const formattedBranches = branches.map((branch) => {
      const smartSchedule = formatSmartSchedule(
        branch.provider_schedules || [],
      );

      return {
        id: branch.id,
        brandId: branch.provider_id,
        nombre: branch.name || branch.providers?.commercial_name || "Farmacia",
        descripcion: branch.description || "",
        categorias: [],
        direccion: branch.address_text || "",
        ciudad: branch.cities?.name || "",
        codigoPostal: "",
        telefono: branch.phone_contact || "",
        horarioAtencion: smartSchedule,
        calificacion: branch.rating_cache ? Number(branch.rating_cache) : 0,
        disponible24h: branch.is_24h || false,
        hasDelivery: branch.has_delivery || false,
        email: branch.email_contact || "",
        imagen: branch.image_url || branch.providers?.logo_url || "",
        latitud: branch.latitude ? Number(branch.latitude) : null,
        longitud: branch.longitude ? Number(branch.longitude) : null,
        horarios: branch.provider_schedules,
      };
    });

    console.log(
      `✅ [PUBLIC PHARMACIES] Se encontraron ${formattedBranches.length} sucursales (total: ${total})`,
    );

    return successResponse(
      {
        branches: formattedBranches,
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
    console.error("❌ Error branches:", error.message);
    return internalErrorResponse("Failed to fetch pharmacy branches", event);
  }
}

/**
 * Obtener sucursal por ID
 * GET /api/public/pharmacies/branches/{id}
 */
export async function getPharmacyBranchById(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("✅ [PUBLIC PHARMACIES] GET .../branches/{id}");

  try {
    const branchId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/public/pharmacies/branches/",
    );

    if (!branchId)
      return errorResponse("Branch ID is required", 400, undefined, event);

    const prisma = getPrismaClient();

    const branch = await prisma.provider_branches.findFirst({
      where: { id: branchId, is_active: true },
      include: {
        cities: { select: { id: true, name: true, state: true } },
        providers: {
          select: {
            id: true,
            commercial_name: true,
            logo_url: true,
            service_categories: { select: { slug: true } },
          },
        },
        provider_schedules: {
          where: { is_active: true },
          orderBy: { day_of_week: "asc" },
        },
      },
    });

    if (!branch || branch.providers?.service_categories?.slug !== "pharmacy") {
      return errorResponse("Pharmacy branch not found", 404, undefined, event);
    }

    const smartSchedule = formatSmartSchedule(branch.provider_schedules || []);

    const formattedBranch = {
      id: branch.id,
      brandId: branch.provider_id,
      nombre: branch.name || branch.providers?.commercial_name || "",
      descripcion: branch.description || "",
      categorias: [],
      direccion: branch.address_text || "",
      ciudad: branch.cities?.name || "",
      codigoPostal: "",
      telefono: branch.phone_contact || "",
      horarioAtencion: smartSchedule,
      calificacion: branch.rating_cache ? Number(branch.rating_cache) : 0,
      disponible24h: branch.is_24h || false,
      hasDelivery: branch.has_delivery || false,
      email: branch.email_contact || "",
      imagen: branch.image_url || branch.providers?.logo_url || "",
      latitud: branch.latitude ? Number(branch.latitude) : null,
      longitud: branch.longitude ? Number(branch.longitude) : null,
      horarios: branch.provider_schedules,
    };

    return successResponse(formattedBranch, 200, event);
  } catch (error: any) {
    console.error("❌ Error branch detail:", error.message);
    return internalErrorResponse("Failed to fetch pharmacy branch", event);
  }
}

/**
 * Listar todas las farmacias (Listado plano alternativo)
 * GET /api/public/pharmacies
 */
export async function getAllPharmacies(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PUBLIC PHARMACIES] GET /api/public/pharmacies - Listando todas",
  );

  try {
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};

    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "20", 10);
    const offset = (page - 1) * limit;

    const where: any = {
      service_categories: { slug: "pharmacy" },
      verification_status: "APPROVED",
      users: { is_active: true },
      provider_branches: { some: { is_active: true } },
    };

    const [pharmacies, total] = await Promise.all([
      prisma.providers.findMany({
        where,
        include: {
          provider_branches: {
            where: { is_main: true, is_active: true },
            take: 1,
            include: { cities: { select: { name: true } } },
          },
        },
        orderBy: { commercial_name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.providers.count({ where }),
    ]);

    const formattedPharmacies = pharmacies.map((pharmacy) => {
      const mainBranch = pharmacy.provider_branches[0];
      return {
        id: pharmacy.id,
        nombre: pharmacy.commercial_name || "",
        logo: pharmacy.logo_url || "",
        ciudad: mainBranch?.cities?.name || "",
        sucursales: 1,
      };
    });

    return successResponse(
      {
        pharmacies: formattedPharmacies,
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
      "❌ [PUBLIC PHARMACIES] Error al listar farmacias:",
      error.message,
    );
    return internalErrorResponse("Failed to fetch pharmacies", event);
  }
}
