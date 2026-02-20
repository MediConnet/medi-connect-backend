import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { AuthContext, requireAuth } from "../shared/auth";
import { getPrismaClient } from "../shared/prisma";
import { errorResponse, successResponse } from "../shared/response";

/**
 * GET /api/ambulances/profile
 * Obtener perfil de ambulancia (requiere autenticación)
 */
export async function getAmbulanceProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("✅ [AMBULANCES] GET /api/ambulances/profile - Obteniendo perfil");

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

    // Buscar provider de tipo "ambulance" del usuario autenticado (más reciente aprobado)
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        service_categories: {
          slug: "ambulance", // ⭐ Filtrar específicamente por tipo ambulance
        },
        verification_status: "APPROVED", // Solo providers aprobados
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
        id: "desc", // Más reciente primero
      },
    });

    if (!provider) {
      console.log(
        "⚠️ [AMBULANCES] Provider de tipo 'ambulance' no encontrado para user_id:",
        authContext.user.id,
      );
      // Retornar estructura completa para evitar errores en el frontend
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
        status: "PENDING",
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

    // Estructura completa del perfil para el frontend
    // Asegurar que todos los campos estén presentes (incluso si son null/empty) para evitar errores en el frontend
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
      isActive: mainBranch?.is_active ?? false,
      city: mainBranch?.cities?.name || null,
      latitude: mainBranch?.latitude ? Number(mainBranch.latitude) : null,
      longitude: mainBranch?.longitude ? Number(mainBranch.longitude) : null,
      // Campos adicionales que el frontend podría necesitar
      status: provider.verification_status || "APPROVED",
      // Nuevos campos de ambulancia
      is24h: mainBranch?.is_24h ?? false,
      ambulanceTypes: mainBranch?.ambulance_types || [],
      coverageArea: mainBranch?.coverage_area || null,
    };

    console.log(`📦 [AMBULANCES] Estructura de respuesta:`, JSON.stringify(profileData, null, 2));

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

    const body = JSON.parse(event.body || "{}");
    const { name, description, phone, whatsapp, address, is24h, ambulanceTypes, coverageArea } = body;

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

    // Actualizar proveedor
    const updatedProvider = await prisma.providers.update({
      where: { id: provider.id },
      data: {
        commercial_name: name,
        description,
      },
    });

    // Actualizar sucursal principal
    const mainBranch =
      provider.provider_branches.find((b) => b.is_main) ||
      provider.provider_branches[0];
    if (mainBranch) {
      await prisma.provider_branches.update({
        where: { id: mainBranch.id },
        data: {
          phone_contact: phone,
          address_text: address,
          is_24h: is24h !== undefined ? is24h : mainBranch.is_24h,
          ambulance_types: ambulanceTypes !== undefined ? ambulanceTypes : mainBranch.ambulance_types,
          coverage_area: coverageArea !== undefined ? coverageArea : mainBranch.coverage_area,
        },
      });
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
      rating: updatedBranch?.rating_cache
        ? parseFloat(updatedBranch.rating_cache.toString())
        : 0,
      totalTrips,
      is24h: updatedBranch?.is_24h ?? false,
      ambulanceTypes: updatedBranch?.ambulance_types || [],
      coverageArea: updatedBranch?.coverage_area || null,
    });
  } catch (error: any) {
    console.error("Error updating ambulance profile:", error);
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

    // Obtener reseñas de todas las sucursales
    const reviews = await prisma.reviews.findMany({
      where: { branch_id: { in: branchIds } },
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
    });

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating || 0,
      comment: review.comment,
      patientName: review.patients?.full_name || "Paciente",
      date: review.created_at,
    }));

    return successResponse(formattedReviews);
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

    // Por ahora retornamos configuración por defecto
    // Se puede implementar una tabla específica para configuraciones
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
