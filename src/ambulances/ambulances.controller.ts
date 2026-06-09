import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { AuthContext, requireAuth } from "../shared/auth";
import { enum_verification } from "../generated/prisma/client";
import { getPrismaClient } from "../shared/prisma";
import { errorResponse, paginatedResponse, successResponse } from "../shared/response";
import { uploadImageToCloudinary, isBase64Image } from "../shared/cloudinary";

/**
 * GET /api/ambulances/profile
 * Obtener perfil de ambulancia (requiere autenticación)
 */
export async function getAmbulanceProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [AMBULANCES] GET /api/ambulances/profile - Obteniendo perfil",
  );

  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (
      authContext.user.role !== "ambulance" &&
      authContext.user.role !== "provider"
    ) {
      return errorResponse(
        "No autorizado. Debe ser proveedor de ambulancia",
        403,
      );
    }

    const prisma = getPrismaClient();

    // Buscar provider de tipo "ambulance" del usuario autenticado (aprobado o pendiente)
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        service_categories: {
          slug: "ambulance",
        },
        verification_status: { in: ['APPROVED', 'PENDING'] },
      },
      include: {
        service_categories: { select: { slug: true, name: true } },
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
        provider_branches: {
          where: { is_active: true },
          include: {
            cities: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    if (!provider) {
      console.log(
        "⚠️ [AMBULANCES] Provider de tipo 'ambulance' no encontrado (ni APPROVED ni PENDING) para user_id:",
        authContext.user.id,
      );
      // Si no encuentra provider aprobado ni pendiente, buscar cualquier provider de tipo ambulance para obtener el status real
      const anyProvider = await prisma.providers.findFirst({
        where: {
          user_id: authContext.user.id,
          service_categories: {
            slug: "ambulance",
          },
        },
        select: {
          verification_status: true,
        },
        orderBy: {
          id: "desc",
        },
      });
      
      const actualStatus = anyProvider?.verification_status || enum_verification.PENDING;
      
      return successResponse({
        id: null,
        name: "Servicio de Ambulancia",
        description: "Perfil en configuración",
        phone: "",
        whatsapp: "",
        address: "",
        email: authContext.user.email || "",
        rating: 0,
        totalTrips: 0,
        logoUrl: null,
        isActive: false,
        city: null,
        latitude: null,
        longitude: null,
        status: actualStatus,
      });
    }

    console.log("🔍 [AMBULANCES] Provider encontrado:", {
      id: provider.id,
      name: provider.commercial_name,
      branches: provider.provider_branches.length,
    });

    // Obtener branch principal (puede no existir)
    const mainBranch =
      provider.provider_branches.find((b) => b.is_main) ||
      provider.provider_branches[0] ||
      null;

    // Calcular total de viajes (usando appointments como viajes)
    const totalTrips = await prisma.appointments.count({
      where: { provider_id: provider.id },
    });

    console.log(
      `✅ [AMBULANCES] Perfil obtenido exitosamente (${totalTrips} viajes, ${provider.provider_branches.length} branches)`,
    );

    const profileData = {
      id: provider.id,
      name: provider.commercial_name || "Servicio de Ambulancia",
      description: provider.description || "",
      phone: mainBranch?.phone_contact || "",
      whatsapp: mainBranch?.phone_contact || "",
      address: mainBranch?.address_text || "",
      email: provider.users?.email || authContext.user.email || "",
      rating: mainBranch?.rating_cache
        ? parseFloat(mainBranch.rating_cache.toString())
        : 0,
      totalTrips: totalTrips || 0,
      logoUrl: provider.logo_url || mainBranch?.image_url || null,
      profile_picture_url: provider.users?.profile_picture_url || provider.logo_url || null,
      imageUrl: mainBranch?.image_url || provider.logo_url || null,
      preview_images: mainBranch?.preview_images || [],
      isActive: mainBranch?.is_active ?? false,
      city: mainBranch?.cities?.name || null,
      latitude: mainBranch?.latitude ? Number(mainBranch.latitude) : null,
      longitude: mainBranch?.longitude ? Number(mainBranch.longitude) : null,
      google_maps_url: mainBranch?.google_maps_url || null,
      status: provider.verification_status || enum_verification.APPROVED,
      is24h: mainBranch?.is_24h ?? false,
      ambulanceTypes: mainBranch?.ambulance_types || [],
      coverageArea: mainBranch?.coverage_area || null,
    };

    console.log(
      `📦 [AMBULANCES] Estructura de respuesta:`,
      JSON.stringify(profileData, null, 2),
    );

    return successResponse(profileData);
  } catch (error: any) {
    console.error("❌ [AMBULANCES] Error al obtener perfil:", error.message);
    return errorResponse(error.message || "Error al obtener perfil", 500);
  }
}

/**
 * PUT /api/ambulances/profile
 * Actualizar perfil de ambulancia (requiere autenticación)
 */
export async function updateAmbulanceProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (
      authContext.user.role !== "ambulance" &&
      authContext.user.role !== "provider"
    ) {
      return errorResponse(
        "No autorizado. Debe ser proveedor de ambulancia",
        403,
      );
    }

    console.log('📤 [AMBULANCES] PUT /api/ambulances/profile - Body recibido:', event.body?.substring(0, 500));
    const body = JSON.parse(event.body || "{}");
    console.log('✅ [AMBULANCES] Body parseado:', JSON.stringify(body, null, 2));
    const {
      name,
      description,
      phone,
      whatsapp,
      address,
      latitude,
      longitude,
      google_maps_url,
      is24h,
      ambulanceTypes,
      coverageArea,
      imageUrl,
      profile_picture_url,
      preview_images,
    } = body;

    // --- SUBIR IMAGEN A CLOUDINARY ---
    let uploadedImageUrl: string | undefined;
    if (imageUrl && isBase64Image(imageUrl)) {
      try {
        uploadedImageUrl = await uploadImageToCloudinary(imageUrl, 'providers/ambulances');
        console.log('✅ [AMBULANCES] Imagen subida a Cloudinary:', uploadedImageUrl);
      } catch (imgErr: any) {
        console.error('❌ [AMBULANCES] Error subiendo imagen:', imgErr.message);
        return errorResponse('Error al subir la imagen. Intenta de nuevo.', 500);
      }
    } else if (imageUrl) {
      uploadedImageUrl = imageUrl;
    }

    // B. Avatar de la ambulancia (profile_picture_url)
    let uploadedProfilePictureUrl: string | null | undefined;
    if (profile_picture_url !== undefined) {
      if (profile_picture_url && isBase64Image(profile_picture_url)) {
        try {
          uploadedProfilePictureUrl = await uploadImageToCloudinary(profile_picture_url, 'providers/ambulances/avatars');
          console.log('✅ [AMBULANCES] Avatar subido a Cloudinary:', uploadedProfilePictureUrl);
        } catch (imgErr: any) {
          console.error('❌ [AMBULANCES] Error subiendo avatar:', imgErr.message);
          return errorResponse('Error al subir la imagen de perfil. Intenta de nuevo.', 500);
        }
      } else if (profile_picture_url && !isBase64Image(profile_picture_url) && !profile_picture_url.startsWith('blob:')) {
        uploadedProfilePictureUrl = profile_picture_url;
      } else if (profile_picture_url === null || profile_picture_url === "") {
        uploadedProfilePictureUrl = null;
      }
    }

    // C. Imágenes de vista previa (preview_images)
    let uploadedPreviewImages: string[] | undefined;
    if (preview_images && preview_images.length > 0) {
      uploadedPreviewImages = [];
      for (const img of preview_images) {
        if (isBase64Image(img)) {
          try {
            const url = await uploadImageToCloudinary(img, 'providers/ambulances/previews');
            uploadedPreviewImages.push(url);
          } catch (imgErr: any) {
            console.error('❌ [AMBULANCES] Error subiendo imagen de galería:', imgErr.message);
            return errorResponse('Error al subir imagen de galería. Intenta de nuevo.', 500);
          }
        } else if (!img.startsWith('blob:')) {
          uploadedPreviewImages.push(img);
        }
      }
    } else if (preview_images && preview_images.length === 0) {
      uploadedPreviewImages = [];
    }

    const prisma = getPrismaClient();

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        provider_branches: {
          where: { is_active: true },
        },
      },
    });

    if (!provider) {
      return errorResponse("Ambulancia no encontrada", 404);
    }

    const mainBranch =
      provider.provider_branches.find((b) => b.is_main) ||
      provider.provider_branches[0];

    // Actualizar proveedor y sucursal principal en transacción
    await prisma.$transaction(async (tx) => {
      // Actualizar profile_picture_url en users
      if (uploadedProfilePictureUrl !== undefined) {
        await tx.users.update({
          where: { id: authContext.user.id },
          data: { profile_picture_url: uploadedProfilePictureUrl },
        });
        console.log('✅ [AMBULANCES] profile_picture_url guardado en users:', uploadedProfilePictureUrl);
      }

      // Actualizar proveedor
      await tx.providers.update({
        where: { id: provider.id },
        data: {
          commercial_name: name,
          description,
        },
      });

      // Actualizar sucursal principal
      if (mainBranch) {
        const branchUpdateData: any = {
          phone_contact: phone,
          address_text: address,
          is_24h: is24h !== undefined ? is24h : mainBranch.is_24h,
          ambulance_types:
            ambulanceTypes !== undefined
              ? ambulanceTypes
              : mainBranch.ambulance_types,
          coverage_area:
            coverageArea !== undefined
              ? coverageArea
              : mainBranch.coverage_area,
        };
        
        // Agregar campos de ubicación si están presentes
        if (latitude !== undefined) branchUpdateData.latitude = latitude !== null ? latitude : null;
        if (longitude !== undefined) branchUpdateData.longitude = longitude !== null ? longitude : null;
        if (google_maps_url !== undefined) branchUpdateData.google_maps_url = google_maps_url !== null && google_maps_url !== "" ? google_maps_url : null;
        if (uploadedImageUrl !== undefined) branchUpdateData.image_url = uploadedImageUrl;
        if (uploadedPreviewImages !== undefined) branchUpdateData.preview_images = uploadedPreviewImages;
        
        console.log('💾 [AMBULANCES] Actualizando branch con datos:', JSON.stringify(branchUpdateData, null, 2));
        await tx.provider_branches.update({
          where: { id: mainBranch.id },
          data: branchUpdateData,
        });
        console.log('✅ [AMBULANCES] Branch actualizado exitosamente');
      } else {
        console.log('⚠️ [AMBULANCES] No hay branch principal para actualizar');
      }
    });

    const updatedProvider = await prisma.providers.findFirst({
      where: { id: provider.id },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
      },
    });

    if (!updatedProvider) {
      return errorResponse("Ambulancia no encontrada al recuperar actualización", 404);
    }

    const totalTrips = await prisma.appointments.count({
      where: { provider_id: updatedProvider.id },
    });

    const updatedBranch = await prisma.provider_branches.findUnique({
      where: { id: mainBranch?.id },
    });

    return successResponse({
      id: updatedProvider.id,
      name: updatedProvider.commercial_name || "Servicio de Ambulancia",
      description: updatedProvider.description,
      phone: updatedBranch?.phone_contact || "",
      whatsapp: updatedBranch?.phone_contact || "",
      address: updatedBranch?.address_text || "",
      latitude: updatedBranch?.latitude ? Number(updatedBranch.latitude) : null,
      longitude: updatedBranch?.longitude ? Number(updatedBranch.longitude) : null,
      google_maps_url: updatedBranch?.google_maps_url || null,
      rating: updatedBranch?.rating_cache
        ? parseFloat(updatedBranch.rating_cache.toString())
        : 0,
      totalTrips,
      is24h: updatedBranch?.is_24h ?? false,
      ambulanceTypes: updatedBranch?.ambulance_types || [],
      coverageArea: updatedBranch?.coverage_area || null,
      profile_picture_url: updatedProvider.users?.profile_picture_url || updatedProvider.logo_url || null,
      logoUrl: updatedProvider.logo_url || updatedBranch?.image_url || null,
      imageUrl: updatedBranch?.image_url || updatedProvider.logo_url || null,
      preview_images: updatedBranch?.preview_images || [],
    });
  } catch (error: any) {
    console.error("❌ [AMBULANCES] Error updating ambulance profile:", error);
    console.error('❌ [AMBULANCES] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return errorResponse(error.message || "Error al actualizar perfil", 500);
  }
}

/**
 * GET /api/ambulances/reviews
 * Obtener reseñas de ambulancia (requiere autenticación)
 */
export async function getAmbulanceReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (
      authContext.user.role !== "ambulance" &&
      authContext.user.role !== "provider"
    ) {
      return errorResponse(
        "No autorizado. Debe ser proveedor de ambulancia",
        403,
      );
    }

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;

    const prisma = getPrismaClient();

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse("Ambulancia no encontrada", 404);
    }

    // Obtener las sucursales del proveedor
    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: provider.id },
      select: { id: true },
    });

    const branchIds = branches.map((b) => b.id);

    const where = { branch_id: { in: branchIds } };

    // Obtener reseñas de todas las sucursales
    const [reviews, total] = await Promise.all([
      prisma.reviews.findMany({
        where,
        include: {
          patients: {
            select: {
              full_name: true,
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
    ]);

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating || 0,
      comment: review.comment,
      patientName: review.patients?.full_name || "Paciente",
      date: review.created_at,
    }));

    return paginatedResponse(formattedReviews, total, page, limit);
  } catch (error: any) {
    console.error("Error getting ambulance reviews:", error);
    return errorResponse(error.message || "Error al obtener reseñas", 500);
  }
}

/**
 * GET /api/ambulances/settings
 * Obtener configuración de ambulancia (requiere autenticación)
 */
export async function getAmbulanceSettings(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (
      authContext.user.role !== "ambulance" &&
      authContext.user.role !== "provider"
    ) {
      return errorResponse(
        "No autorizado. Debe ser proveedor de ambulancia",
        403,
      );
    }

    const defaultSettings = {
      notifications: {
        email: true,
        sms: false,
        push: true,
      },
      privacy: {
        showPhone: true,
        showAddress: false,
      },
    };

    return successResponse(defaultSettings);
  } catch (error: any) {
    console.error("Error getting ambulance settings:", error);
    return errorResponse(
      error.message || "Error al obtener configuración",
      500,
    );
  }
}
