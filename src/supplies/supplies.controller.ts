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
import { z } from "zod";
import { parseBody } from "../shared/validators";

const extractStoreId = (path: string): string | null => {
  const match = path.match(/\/api\/supplies\/([^\/]+)/);
  return match ? match[1] : null;
};

const suppliesProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  schedule: z.string().optional(),
  isActive: z.boolean().optional(),
  logoUrl: z
    .union([
      z.string().url("Invalid logo URL"),
      z.string().startsWith("data:image/", "Logo must be a valid URL or base64 image"),
      z.literal(""),
    ])
    .optional()
    .nullable(),
});

async function getSuppliesProviderByUserId(prisma: any, userId: string) {
  const suppliesCategory = await prisma.service_categories.findFirst({
    where: { slug: "supplies" },
    select: { id: true },
  });
  if (!suppliesCategory) return null;

  const provider = await prisma.providers.findFirst({
    where: {
      user_id: userId,
      category_id: suppliesCategory.id,
    },
  });
  return provider;
}

async function getOrCreateMainBranch(prisma: any, providerId: string, email: string) {
  let branch = await prisma.provider_branches.findFirst({
    where: { provider_id: providerId, is_main: true },
    orderBy: { id: "desc" },
  });
  if (branch) return branch;

  branch = await prisma.provider_branches.create({
    data: {
      id: randomUUID(),
      provider_id: providerId,
      name: "Sucursal Principal",
      email_contact: email,
      is_main: true,
      is_active: true,
      payment_methods: [],
    },
  });
  return branch;
}

/**
 * GET /api/supplies/profile (panel)
 * Retorna perfil del proveedor de insumos autenticado
 */
export async function getSuppliesProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    const provider = await getSuppliesProviderByUserId(prisma, authContext.user.id);
    if (!provider) {
      // Perfil nuevo: retornar vacío con id null (pero manteniendo shape esperado)
      return successResponse({
        id: null,
        name: "",
        description: "",
        phone: "",
        whatsapp: "",
        address: "",
        schedule: "",
        logoUrl: null,
        isActive: false,
      });
    }

    const branch = await getOrCreateMainBranch(prisma, provider.id, authContext.user.email);

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || "",
      description: provider.description || "",
      phone: branch.phone_contact || "",
      whatsapp: branch.phone_contact || "",
      address: branch.address_text || "",
      schedule: branch.opening_hours_text || "",
      logoUrl: provider.logo_url || null,
      isActive: Boolean(branch.is_active),
    });
  } catch (error: any) {
    console.error("❌ [SUPPLIES] Error getting supplies profile:", error.message);
    return internalErrorResponse("Error al obtener perfil de insumos");
  }
}

/**
 * PUT /api/supplies/profile (panel)
 * Actualiza perfil del proveedor de insumos autenticado
 */
export async function updateSuppliesProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const body = parseBody(event.body, suppliesProfileSchema);
    const prisma = getPrismaClient();

    // Buscar o crear provider de insumos para este usuario
    const suppliesCategory = await prisma.service_categories.findFirst({
      where: { slug: "supplies" },
      select: { id: true },
    });
    if (!suppliesCategory) return errorResponse("Categoría de insumos no encontrada", 404);

    let provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id, category_id: suppliesCategory.id },
    });

    if (!provider) {
      provider = await prisma.providers.create({
        data: {
          id: randomUUID(),
          user_id: authContext.user.id,
          category_id: suppliesCategory.id,
          commercial_name: body.name || "Insumos",
          description: body.description || null,
          verification_status: "APPROVED",
          commission_percentage: 15.0,
        },
      });
    }

    const branch = await getOrCreateMainBranch(prisma, provider.id, authContext.user.email);

    const updatedProvider = await prisma.providers.update({
      where: { id: provider.id },
      data: {
        commercial_name: body.name !== undefined ? body.name : provider.commercial_name,
        description: body.description !== undefined ? body.description : provider.description,
        logo_url:
          body.logoUrl !== undefined ? (body.logoUrl === "" ? null : body.logoUrl) : provider.logo_url,
      },
    });

    const updatedBranch = await prisma.provider_branches.update({
      where: { id: branch.id },
      data: {
        phone_contact: body.phone !== undefined ? body.phone : branch.phone_contact,
        address_text: body.address !== undefined ? body.address : branch.address_text,
        opening_hours_text: body.schedule !== undefined ? body.schedule : branch.opening_hours_text,
        is_active: body.isActive !== undefined ? body.isActive : branch.is_active,
      },
    });

    return successResponse({
      id: updatedProvider.id,
      name: updatedProvider.commercial_name || "",
      description: updatedProvider.description || "",
      phone: updatedBranch.phone_contact || "",
      whatsapp: updatedBranch.phone_contact || "",
      address: updatedBranch.address_text || "",
      schedule: updatedBranch.opening_hours_text || "",
      logoUrl: updatedProvider.logo_url || null,
      isActive: Boolean(updatedBranch.is_active),
    });
  } catch (error: any) {
    console.error("❌ [SUPPLIES] Error updating supplies profile:", error.message);
    return internalErrorResponse("Error al actualizar perfil de insumos");
  }
}

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
            cities: true,
          },
        },
      },
    });

    let filteredProviders = allProviders;

    if (searchQuery.trim().length > 0) {
      const term = normalizeText(searchQuery);

      filteredProviders = allProviders.filter((provider) => {
        const mainBranch = provider.provider_branches[0];

        // Normalización de campos
        const name = normalizeText(provider.commercial_name);
        const desc = normalizeText(provider.description);

        const address = normalizeText(mainBranch?.address_text);
        const city = normalizeText((mainBranch as any).cities?.name);

        // Búsqueda en cualquiera de los 4 campos
        return (
          name.includes(term) ||
          desc.includes(term) ||
          address.includes(term) ||
          city.includes(term)
        );
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

/**
 * GET /api/supplies/reviews
 * Obtener reseñas del panel de insumos (requiere autenticación)
 */
export async function getMySupplyStoreReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies/reviews - Obteniendo reseñas del panel');
  
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      console.error('❌ [SUPPLIES] Error de autenticación');
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (authContext.user.role !== 'provider') {
      console.error('❌ [SUPPLIES] Usuario no autorizado:', authContext.user.role);
      return errorResponse('No autorizado. Debe ser proveedor', 403);
    }

    const prisma = getPrismaClient();

    // Buscar el provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [SUPPLIES] Provider no encontrado, retornando array vacío');
      return successResponse({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
      });
    }

    console.log('🔍 [SUPPLIES] Provider encontrado:', provider.id);

    // Obtener todas las sucursales del provider
    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: provider.id },
      select: { id: true },
    });

    const branchIds = branches.map((b) => b.id);
    console.log('🔍 [SUPPLIES] Branch IDs:', branchIds);

    // Obtener reseñas de todas las sucursales del provider
    const reviews = await prisma.reviews.findMany({
      where: { branch_id: { in: branchIds } },
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
            users: {
              select: {
                profile_picture_url: true,
              },
            },
          },
        },
        provider_branches: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Calcular promedio de calificaciones
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

    console.log(`✅ [SUPPLIES] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`);

    return successResponse({
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.comment,
        patientName: review.patients?.full_name || 'Usuario',
        profilePictureUrl: review.patients?.users?.profile_picture_url || null,
        date: review.created_at,
        branchName: review.provider_branches?.name || null,
      })),
      averageRating: Number(averageRating.toFixed(2)),
      totalReviews: reviews.length,
    });
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error al obtener reseñas:', error.message);
    return internalErrorResponse(error.message || 'Error al obtener reseñas');
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
