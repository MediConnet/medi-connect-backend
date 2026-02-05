import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { AuthContext, requireAuth } from "../shared/auth";
import { formatSmartSchedule } from "../shared/helpers/scheduleFormatter";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";

const extractStoreId = (path: string): string | null => {
  const match = path.match(/\/api\/supplies\/([^\/]+)/);
  return match ? match[1] : null;
};

/**
 * HELPER: Normalizar texto para búsquedas
 */
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

/**
 * GET /api/supplies
 * Listar tiendas de insumos médicos (público)
 */
export async function getSupplyStores(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const searchQuery = queryParams.q || "";

  console.log(`✅ [SUPPLIES] Listando tiendas. Búsqueda: "${searchQuery}"`);

  try {
    const prisma = getPrismaClient();

    const suppliesCategory = await prisma.service_categories.findFirst({
      where: { slug: "supplies" },
    });

    if (!suppliesCategory) {
      return errorResponse("Categoría de insumos no encontrada", 404);
    }

    const allProviders = await prisma.providers.findMany({
      where: {
        category_id: suppliesCategory.id,
        verification_status: "APPROVED",
      },
      include: {
        provider_branches: {
          where: { is_active: true, is_main: true },
          take: 1,
          include: {
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: "asc" },
            },
          },
        },
      },
    });

    let filteredProviders = allProviders;

    if (searchQuery.trim().length > 0) {
      const term = normalizeText(searchQuery);

      filteredProviders = allProviders.filter((provider) => {
        const name = normalizeText(provider.commercial_name);
        const desc = normalizeText(provider.description);

        return name.includes(term) || desc.includes(term);
      });
    }

    const formattedStores = filteredProviders.map((provider) => {
      const mainBranch = provider.provider_branches[0];
      const schedules = mainBranch?.provider_schedules || [];
      const openingHours = formatSmartSchedule(schedules);

      return {
        id: provider.id,
        name: provider.commercial_name || "Tienda de Insumos",
        description: provider.description,
        address: mainBranch?.address_text || "Ubicación no disponible",
        phone: mainBranch?.phone_contact || "",
        rating: mainBranch?.rating_cache ? Number(mainBranch.rating_cache) : 0,
        imageUrl: provider.logo_url,
        openingHours: openingHours,
      };
    });

    return successResponse(formattedStores);
  } catch (error: any) {
    console.error("❌ [SUPPLIES] Error getting supply stores:", error);
    return internalErrorResponse("Error al obtener tiendas de insumos");
  }
}

export async function getSupplyStoreById(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const path = event.requestContext.http.path;
    const storeId = extractStoreId(path);
    if (!storeId) return errorResponse("ID de tienda requerido", 400);

    const prisma = getPrismaClient();
    const provider = await prisma.providers.findUnique({
      where: { id: storeId },
      include: {
        provider_branches: {
          where: { is_active: true },
          include: {
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: "asc" },
            },
          },
        },
        provider_catalog: {
          where: { is_available: true },
          orderBy: { name: "asc" },
          take: 50,
        },
      },
    });

    if (!provider) return errorResponse("Tienda no encontrada", 404);

    const mainBranch =
      provider.provider_branches.find((b) => b.is_main) ||
      provider.provider_branches[0];
    const schedules = mainBranch?.provider_schedules || [];
    const openingHours = formatSmartSchedule(schedules);
    const products = provider.provider_catalog.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price ? Number(p.price) : 0,
      imageUrl: p.image_url,
      type: p.type,
    }));

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || "Tienda de Insumos",
      description: provider.description,
      address: mainBranch?.address_text || "",
      phone: mainBranch?.phone_contact || "",
      whatsapp: mainBranch?.phone_contact || "",
      email: mainBranch?.email_contact || "",
      rating: mainBranch?.rating_cache ? Number(mainBranch.rating_cache) : 0,
      imageUrl: provider.logo_url,
      latitude: mainBranch?.latitude ? Number(mainBranch.latitude) : null,
      longitude: mainBranch?.longitude ? Number(mainBranch.longitude) : null,
      openingHours: openingHours,
      products: products,
    });
  } catch (error: any) {
    console.error("❌ [SUPPLIES] Error getting supply store detail:", error);
    return internalErrorResponse("Error al obtener el detalle de la tienda");
  }
}

export async function getSupplyStoreReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const storeId = extractStoreId(event.requestContext.http.path);
    if (!storeId) return errorResponse("ID requerido", 400);

    const prisma = getPrismaClient();
    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: storeId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    const reviews = await prisma.reviews.findMany({
      where: { branch_id: { in: branchIds } },
      include: { patients: { select: { full_name: true } } },
      orderBy: { created_at: "desc" },
    });

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      supplyStoreId: storeId,
      userId: review.patient_id,
      userName: review.patients?.full_name || "Usuario",
      rating: review.rating || 0,
      comment: review.comment,
      createdAt: review.created_at,
    }));

    return successResponse(formattedReviews);
  } catch (error: any) {
    return internalErrorResponse("Error al obtener reseñas");
  }
}

export async function createSupplyStoreReview(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const storeId = extractStoreId(event.requestContext.http.path);
    if (!storeId) return errorResponse("ID requerido", 400);

    const body = JSON.parse(event.body || "{}");
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5)
      return errorResponse("Rating inválido", 400);

    const prisma = getPrismaClient();
    const provider = await prisma.providers.findUnique({
      where: { id: storeId },
      include: { provider_branches: { where: { is_main: true }, take: 1 } },
    });

    if (!provider || provider.provider_branches.length === 0)
      return errorResponse("Tienda no encontrada", 404);

    const mainBranch = provider.provider_branches[0];
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) return errorResponse("Paciente no encontrado", 404);

    const review = await prisma.reviews.create({
      data: {
        id: randomUUID(),
        branch_id: mainBranch.id,
        patient_id: patient.id,
        rating,
        comment: comment || null,
        created_at: new Date(),
      },
      include: { patients: { select: { full_name: true } } },
    });

    const avgRating = await prisma.reviews.aggregate({
      where: { branch_id: mainBranch.id },
      _avg: { rating: true },
    });

    await prisma.provider_branches.update({
      where: { id: mainBranch.id },
      data: { rating_cache: avgRating._avg.rating || 0 },
    });

    return successResponse(
      {
        id: review.id,
        supplyStoreId: storeId,
        userId: patient.id,
        userName: review.patients?.full_name || "Usuario",
        rating: review.rating || 0,
        comment: review.comment,
        createdAt: review.created_at,
      },
      201,
    );
  } catch (error: any) {
    return internalErrorResponse("Error al crear reseña");
  }
}

export async function getSupplyStoreDashboard(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;

    if (
      authContext.user.role !== "supplies" &&
      authContext.user.role !== "provider"
    ) {
      return errorResponse("No autorizado", 403);
    }

    const prisma = getPrismaClient();
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        provider_branches: { where: { is_active: true } },
        provider_catalog: {
          where: { is_available: true },
          take: 10,
          orderBy: { name: "asc" },
        },
      },
    });

    if (!provider) return errorResponse("Tienda no encontrada", 404);

    const mainBranch =
      provider.provider_branches.find((b) => b.is_main) ||
      provider.provider_branches[0];
    const totalProducts = await prisma.provider_catalog.count({
      where: { provider_id: provider.id },
    });

    return successResponse({
      store: {
        id: provider.id,
        name: provider.commercial_name,
        description: provider.description,
        address: mainBranch?.address_text,
      },
      stats: {
        totalProducts,
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
      },
      recentOrders: [],
      products: provider.provider_catalog.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        imageUrl: p.image_url,
      })),
    });
  } catch (error: any) {
    console.error("Error dashboard:", error);
    return internalErrorResponse("Error al obtener dashboard");
  }
}
