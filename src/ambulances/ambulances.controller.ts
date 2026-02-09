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

    // Calcular total de viajes (usando appointments como viajes)
    const totalTrips = await prisma.appointments.count({
      where: { provider_id: provider.id },
    });

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || "Servicio de Ambulancia",
      description: provider.description,
      phone: mainBranch?.phone_contact || "",
      whatsapp: mainBranch?.phone_contact || "",
      address: mainBranch?.address_text || "",
      rating: mainBranch?.rating_cache
        ? parseFloat(mainBranch.rating_cache.toString())
        : 0,
      totalTrips,
    });
  } catch (error: any) {
    console.error("Error getting ambulance profile:", error);
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
    const { name, description, phone, whatsapp, address } = body;

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
