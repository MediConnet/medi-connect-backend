import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import { enum_verification } from "../generated/prisma/client";
import { AuthContext, requireAuth } from "../shared/auth";
import { formatSmartSchedule } from "../shared/helpers/scheduleFormatter";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  paginatedResponse,
  successResponse,
} from "../shared/response";
import { parseBody } from "../shared/validators";
import { uploadImageToCloudinary, isBase64Image } from "../shared/cloudinary";

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
  latitude: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : val),
    z.union([
      z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
      z.null(),
    ]).optional(),
  ),
  longitude: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : val),
    z.union([
      z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
      z.null(),
    ]).optional(),
  ),
  google_maps_url: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : val),
    z.union([
      z.string().url("Google Maps URL must be a valid URL"),
      z.null(),
    ]).optional(),
  ),
  schedule: z.string().optional(),
  isActive: z.boolean().optional(),
  logoUrl: z
    .union([
      z.string().url("Invalid logo URL"),
      z
        .string()
        .startsWith("data:image/", "Logo must be a valid URL or base64 image"),
      z.literal(""),
    ])
    .optional()
    .nullable(),
  profile_picture_url: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  preview_images: z.array(z.string()).optional(),
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
    include: {
      users: {
        select: {
          profile_picture_url: true,
        },
      },
    },
  });
  return provider;
}

async function getOrCreateMainBranch(
  prisma: any,
  providerId: string,
  email: string,
) {
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

    const provider = await getSuppliesProviderByUserId(
      prisma,
      authContext.user.id,
    );
    if (!provider) {
      return successResponse({
        id: null,
        name: "",
        description: "",
        phone: "",
        whatsapp: "",
        address: "",
        latitude: null,
        longitude: null,
        google_maps_url: null,
        schedule: "",
        logoUrl: null,
        isActive: false,
      });
    }

    const branch = await getOrCreateMainBranch(
      prisma,
      provider.id,
      authContext.user.email,
    );

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || "",
      description: provider.description || "",
      phone: branch.phone_contact || "",
      whatsapp: branch.phone_contact || "",
      address: branch.address_text || "",
      latitude: branch.latitude ? Number(branch.latitude) : null,
      longitude: branch.longitude ? Number(branch.longitude) : null,
      google_maps_url: branch.google_maps_url || null,
      schedule: branch.opening_hours_text || "",
      logoUrl: provider.logo_url || null,
      profile_picture_url: provider.users?.profile_picture_url || provider.logo_url || null,
      imageUrl: branch.image_url || provider.logo_url || null,
      preview_images: branch.preview_images || [],
      isActive: Boolean(branch.is_active),
    });
  } catch (error: any) {
    console.error(
      "❌ [SUPPLIES] Error getting supplies profile:",
      error.message,
    );
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
    if (!suppliesCategory)
      return errorResponse("Categoría de insumos no encontrada", 404);

    let provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id, category_id: suppliesCategory.id },
    });

    if (!provider) {
      const settings = await prisma.admin_settings.findFirst();
      const commissionPercentage = settings ? Number((settings as any).commission_supplies || 15.0) : 15.0;
      provider = await prisma.providers.create({
        data: {
          id: randomUUID(),
          user_id: authContext.user.id,
          category_id: suppliesCategory.id,
          commercial_name: body.name || "Insumos",
          description: body.description || null,
          verification_status: enum_verification.APPROVED,
          commission_percentage: commissionPercentage,
        },
      });
    }

    const branch = await getOrCreateMainBranch(
      prisma,
      provider.id,
      authContext.user.email,
    );

    // --- SUBIR IMAGEN A CLOUDINARY si es base64 ---
    // A. Avatar de la tienda (profile_picture_url)
    let uploadedProfilePictureUrl: string | null | undefined;
    const rawProfilePic = body.profile_picture_url || body.logoUrl;
    if (rawProfilePic !== undefined) {
      if (rawProfilePic && isBase64Image(rawProfilePic)) {
        try {
          uploadedProfilePictureUrl = await uploadImageToCloudinary(rawProfilePic, 'providers/supplies/avatars');
          console.log('✅ [SUPPLIES] Avatar subido a Cloudinary:', uploadedProfilePictureUrl);
        } catch (imgErr: any) {
          console.error('❌ [SUPPLIES] Error subiendo avatar:', imgErr.message);
          return errorResponse('Error al subir la imagen de perfil. Intenta de nuevo.', 500);
        }
      } else if (rawProfilePic && !isBase64Image(rawProfilePic) && !rawProfilePic.startsWith('blob:')) {
        uploadedProfilePictureUrl = rawProfilePic;
      } else if (rawProfilePic === null || rawProfilePic === "") {
        uploadedProfilePictureUrl = null;
      }
    }

    // B. Banner / Imagen de portada (imageUrl)
    let uploadedImageUrl: string | null | undefined;
    if (body.imageUrl !== undefined) {
      if (body.imageUrl && isBase64Image(body.imageUrl)) {
        try {
          uploadedImageUrl = await uploadImageToCloudinary(body.imageUrl, 'providers/supplies');
          console.log('✅ [SUPPLIES] Imagen de portada subida a Cloudinary:', uploadedImageUrl);
        } catch (imgErr: any) {
          console.error('❌ [SUPPLIES] Error subiendo imagen de portada:', imgErr.message);
          return errorResponse('Error al subir la imagen. Intenta de nuevo.', 500);
        }
      } else if (body.imageUrl && !isBase64Image(body.imageUrl) && !body.imageUrl.startsWith('blob:')) {
        uploadedImageUrl = body.imageUrl;
      } else if (body.imageUrl === null || body.imageUrl === "") {
        uploadedImageUrl = null;
      }
    }

    // C. Imágenes de vista previa (preview_images)
    let uploadedPreviewImages: string[] | undefined;
    if (body.preview_images && body.preview_images.length > 0) {
      uploadedPreviewImages = [];
      for (const img of body.preview_images) {
        if (isBase64Image(img)) {
          try {
            const url = await uploadImageToCloudinary(img, 'providers/supplies/previews');
            uploadedPreviewImages.push(url);
          } catch (imgErr: any) {
            console.error('❌ [SUPPLIES] Error subiendo imagen de galería:', imgErr.message);
            return errorResponse('Error al subir imagen de galería. Intenta de nuevo.', 500);
          }
        } else if (!img.startsWith('blob:')) {
          uploadedPreviewImages.push(img);
        }
      }
    } else if (body.preview_images && body.preview_images.length === 0) {
      uploadedPreviewImages = [];
    }

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar users (profile_picture_url)
      if (uploadedProfilePictureUrl !== undefined) {
        await tx.users.update({
          where: { id: authContext.user.id },
          data: { profile_picture_url: uploadedProfilePictureUrl },
        });
        console.log('✅ [SUPPLIES] profile_picture_url guardado en users:', uploadedProfilePictureUrl);
      }

      // 2. Actualizar providers
      await tx.providers.update({
        where: { id: provider.id },
        data: {
          commercial_name:
            body.name !== undefined ? body.name : provider.commercial_name,
          description:
            body.description !== undefined
              ? body.description
              : provider.description,
          logo_url:
            uploadedProfilePictureUrl !== undefined
              ? (uploadedProfilePictureUrl === "" ? null : uploadedProfilePictureUrl)
              : provider.logo_url,
        },
      });

      // 3. Actualizar sucursal principal
      const branchUpdateData: any = {
        phone_contact:
          body.phone !== undefined ? body.phone : branch.phone_contact,
        address_text:
          body.address !== undefined ? body.address : branch.address_text,
        opening_hours_text:
          body.schedule !== undefined
            ? body.schedule
            : branch.opening_hours_text,
        is_active:
          body.isActive !== undefined ? body.isActive : branch.is_active,
      };
      
      // Agregar campos de ubicación si están presentes
      if (body.latitude !== undefined) branchUpdateData.latitude = body.latitude !== null ? body.latitude : null;
      if (body.longitude !== undefined) branchUpdateData.longitude = body.longitude !== null ? body.longitude : null;
      if (body.google_maps_url !== undefined) branchUpdateData.google_maps_url = body.google_maps_url !== null && body.google_maps_url !== "" ? body.google_maps_url : null;
      if (uploadedImageUrl !== undefined) branchUpdateData.image_url = uploadedImageUrl;
      if (uploadedPreviewImages !== undefined) branchUpdateData.preview_images = uploadedPreviewImages;
      
      console.log('💾 [SUPPLIES] Actualizando branch con datos:', JSON.stringify(branchUpdateData, null, 2));
      await tx.provider_branches.update({
        where: { id: branch.id },
        data: branchUpdateData,
      });
      console.log('✅ [SUPPLIES] Branch actualizado exitosamente');
    });

    // --- RECUPERAR PERFIL ACTUALIZADO COMPLETO ---
    const updatedProvider = await prisma.providers.findFirst({
      where: { id: provider.id },
      include: {
        users: { select: { email: true, profile_picture_url: true } },
      },
    });

    if (!updatedProvider) {
      return errorResponse("Tienda no encontrada al recuperar actualización", 404);
    }

    const updatedBranch = await prisma.provider_branches.findUnique({
      where: { id: branch.id },
    });

    if (!updatedBranch) {
      return errorResponse("Sucursal no encontrada al recuperar actualización", 404);
    }

    return successResponse({
      id: updatedProvider.id,
      name: updatedProvider.commercial_name || "",
      description: updatedProvider.description || "",
      phone: updatedBranch.phone_contact || "",
      whatsapp: updatedBranch.phone_contact || "",
      address: updatedBranch.address_text || "",
      latitude: updatedBranch.latitude ? Number(updatedBranch.latitude) : null,
      longitude: updatedBranch.longitude ? Number(updatedBranch.longitude) : null,
      google_maps_url: updatedBranch.google_maps_url || null,
      schedule: updatedBranch.opening_hours_text || "",
      logoUrl: updatedProvider.logo_url || null,
      profile_picture_url: updatedProvider.users?.profile_picture_url || updatedProvider.logo_url || null,
      imageUrl: updatedBranch.image_url || updatedProvider.logo_url || null,
      preview_images: updatedBranch.preview_images || [],
      isActive: Boolean(updatedBranch.is_active),
    });
  } catch (error: any) {
    console.error(
      "❌ [SUPPLIES] Error updating supplies profile:",
      error.message,
    );
    console.error('❌ [SUPPLIES] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    if (error.message && error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    if (error.message) {
      return errorResponse(error.message, 500);
    }
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
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  console.log(`✅ [SUPPLIES] Listando tiendas. Búsqueda: "${searchQuery}"`);

  try {
    const prisma = getPrismaClient();

    const suppliesCategory = await prisma.service_categories.findFirst({
      where: { slug: "supplies" },
    });

    if (!suppliesCategory) {
      return errorResponse("Categoría de insumos no encontrada", 404);
    }

    const where = {
      category_id: suppliesCategory.id,
      verification_status: enum_verification.APPROVED,
    };

    const [allProviders, total] = await Promise.all([
      prisma.providers.findMany({
        where,
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
        skip: offset,
        take: limit,
      }),
      prisma.providers.count({ where }),
    ]);

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
        branchId: mainBranch?.id || "",
        name: provider.commercial_name || "Tienda de Insumos",
        description: provider.description,
        address: mainBranch?.address_text || "Ubicación no disponible",
        phone: mainBranch?.phone_contact || "",
        rating: mainBranch?.rating_cache ? Number(mainBranch.rating_cache) : 0,
        imageUrl: provider.logo_url,
        openingHours: openingHours,
      };
    });

    return paginatedResponse(formattedStores, total, page, limit);
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
        users: {
          select: {
            profile_picture_url: true,
          },
        },
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
      branchId: mainBranch?.id || "",
      name: provider.commercial_name || "Tienda de Insumos",
      description: provider.description,
      address: mainBranch?.address_text || "",
      phone: mainBranch?.phone_contact || "",
      whatsapp: mainBranch?.phone_contact || "",
      email: mainBranch?.email_contact || "",
      rating: mainBranch?.rating_cache ? Number(mainBranch.rating_cache) : 0,
      imageUrl: mainBranch?.image_url || provider.logo_url || "",
      profile_picture_url: provider.users?.profile_picture_url || provider.logo_url || null,
      preview_images: Array.isArray(mainBranch?.preview_images) ? mainBranch.preview_images : [],
      latitude: mainBranch?.latitude ? Number(mainBranch.latitude) : null,
      longitude: mainBranch?.longitude ? Number(mainBranch.longitude) : null,
      google_maps_url: mainBranch?.google_maps_url || null,
      openingHours: openingHours,
      products: products,
    });
  } catch (error: any) {
    console.error("❌ [SUPPLIES] Error getting supply store detail:", error);
    return internalErrorResponse("Error al obtener el detalle de la tienda");
  }
}

/**
 * GET /api/supplies/reviews
 * Obtener reseñas del panel de insumos (requiere autenticación)
 */
export async function getMySupplyStoreReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [SUPPLIES] GET /api/supplies/reviews - Obteniendo reseñas del panel",
  );

  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) {
      console.error("❌ [SUPPLIES] Error de autenticación");
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (
      authContext.user.role !== "provider" &&
      authContext.user.role !== "supplies"
    ) {
      console.error(
        "❌ [SUPPLIES] Usuario no autorizado:",
        authContext.user.role,
      );
      return errorResponse("No autorizado. Debe ser proveedor", 403);
    }

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;

    const prisma = getPrismaClient();

    // Buscar el provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log(
        "⚠️ [SUPPLIES] Provider no encontrado, retornando array vacío",
      );
      return successResponse({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
      });
    }

    console.log("🔍 [SUPPLIES] Provider encontrado:", provider.id);

    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: provider.id },
      select: { id: true },
    });

    const branchIds = branches.map((b) => b.id);
    console.log("🔍 [SUPPLIES] Branch IDs:", branchIds);

    const where = { branch_id: { in: branchIds } };

    const [reviews, total, ratingAgg] = await Promise.all([
      prisma.reviews.findMany({
        where,
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
          created_at: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.reviews.count({ where }),
      prisma.reviews.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    const averageRating = ratingAgg._avg.rating || 0;

    console.log(
      `✅ [SUPPLIES] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`,
    );

    return successResponse({
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.comment,
        patientName: review.patients?.full_name || "Usuario",
        profilePictureUrl: review.patients?.users?.profile_picture_url || null,
        date: review.created_at,
        branchName: review.provider_branches?.name || null,
      })),
      averageRating: Number(Number(averageRating).toFixed(2)),
      totalReviews: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("❌ [SUPPLIES] Error al obtener reseñas:", error.message);
    return internalErrorResponse(error.message || "Error al obtener reseñas");
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
