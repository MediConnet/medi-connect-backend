import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse } from '../shared/response';
import { requireAuth, AuthContext } from '../shared/auth';

/**
 * GET /api/ambulances/profile
 * Obtener perfil de ambulancia (requiere autenticación)
 */
export async function getAmbulanceProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (authContext.user.role !== 'ambulance' && authContext.user.role !== 'provider') {
      return errorResponse('No autorizado. Debe ser proveedor de ambulancia', 403);
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
      return errorResponse('Ambulancia no encontrada', 404);
    }

    const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];

    // Calcular total de viajes (usando appointments como viajes)
    const totalTrips = await prisma.appointments.count({
      where: { provider_id: provider.id },
    });

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || 'Servicio de Ambulancia',
      description: provider.description,
      phone: mainBranch?.phone_contact || '',
      whatsapp: mainBranch?.phone_contact || '',
      address: mainBranch?.address_text || '',
      rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
      totalTrips,
    });
  } catch (error: any) {
    console.error('Error getting ambulance profile:', error);
    return errorResponse(error.message || 'Error al obtener perfil', 500);
  }
}

/**
 * PUT /api/ambulances/profile
 * Actualizar perfil de ambulancia (requiere autenticación)
 */
export async function updateAmbulanceProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (authContext.user.role !== 'ambulance' && authContext.user.role !== 'provider') {
      return errorResponse('No autorizado. Debe ser proveedor de ambulancia', 403);
    }

    const body = JSON.parse(event.body || '{}');
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
      return errorResponse('Ambulancia no encontrada', 404);
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
    const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];
    if (mainBranch) {
      await prisma.provider_branches.update({
        where: { id: mainBranch.id },
        data: {
          phone_contact: phone,
          address_text: address,
        },
      });
    }

    // Calcular total de viajes
    const totalTrips = await prisma.appointments.count({
      where: { provider_id: updatedProvider.id },
    });

    // Obtener sucursal actualizada
    const updatedBranch = await prisma.provider_branches.findUnique({
      where: { id: mainBranch?.id },
    });

    return successResponse({
      id: updatedProvider.id,
      name: updatedProvider.commercial_name || 'Servicio de Ambulancia',
      description: updatedProvider.description,
      phone: updatedBranch?.phone_contact || '',
      whatsapp: updatedBranch?.phone_contact || '',
      address: updatedBranch?.address_text || '',
      rating: updatedBranch?.rating_cache ? parseFloat(updatedBranch.rating_cache.toString()) : 0,
      totalTrips,
    });
  } catch (error: any) {
    console.error('Error updating ambulance profile:', error);
    return errorResponse(error.message || 'Error al actualizar perfil', 500);
  }
}

/**
 * GET /api/ambulances/reviews
 * Obtener reseñas de ambulancia (requiere autenticación)
 */
export async function getAmbulanceReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (authContext.user.role !== 'ambulance' && authContext.user.role !== 'provider') {
      return errorResponse('No autorizado. Debe ser proveedor de ambulancia', 403);
    }

    const prisma = getPrismaClient();

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Ambulancia no encontrada', 404);
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
        created_at: 'desc',
      },
    });

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating || 0,
      comment: review.comment,
      patientName: review.patients?.full_name || 'Paciente',
      date: review.created_at,
    }));

    return successResponse(formattedReviews);
  } catch (error: any) {
    console.error('Error getting ambulance reviews:', error);
    return errorResponse(error.message || 'Error al obtener reseñas', 500);
  }
}

/**
 * GET /api/ambulances/settings
 * Obtener configuración de ambulancia (requiere autenticación)
 */
export async function getAmbulanceSettings(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (authContext.user.role !== 'ambulance' && authContext.user.role !== 'provider') {
      return errorResponse('No autorizado. Debe ser proveedor de ambulancia', 403);
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
    console.error('Error getting ambulance settings:', error);
    return errorResponse(error.message || 'Error al obtener configuración', 500);
  }
}

/**
 * GET /api/ambulances
 * Listar todas las ambulancias (público)
 */
export async function getAllAmbulances(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const prisma = getPrismaClient();

    // Obtener la categoría de ambulancias
    const ambulanceCategory = await prisma.service_categories.findFirst({
      where: { slug: 'ambulance' },
    });

    if (!ambulanceCategory) {
      return errorResponse('Categoría de ambulancias no encontrada', 404);
    }

    // Obtener proveedores de tipo ambulancia con sus sucursales principales
    const providers = await prisma.providers.findMany({
      where: {
        category_id: ambulanceCategory.id,
        verification_status: 'APPROVED',
      },
      include: {
        provider_branches: {
          where: {
            is_active: true,
            is_main: true,
          },
          take: 1,
        },
      },
    });

    const formattedAmbulances = providers.map((provider) => {
      const mainBranch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || 'Servicio de Ambulancia',
        description: provider.description,
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
        imageUrl: provider.logo_url,
      };
    });

    return successResponse(formattedAmbulances);
  } catch (error: any) {
    console.error('Error getting ambulances:', error);
    return errorResponse(error.message || 'Error al obtener ambulancias', 500);
  }
}

/**
 * GET /api/ambulances/:id
 * Obtener detalle de una ambulancia (público)
 */
export async function getAmbulanceById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const ambulanceId = event.pathParameters?.id;
    if (!ambulanceId) {
      return errorResponse('ID de ambulancia requerido', 400);
    }

    const prisma = getPrismaClient();

    const provider = await prisma.providers.findUnique({
      where: { id: ambulanceId },
      include: {
        provider_branches: {
          where: { is_active: true },
        },
      },
    });

    if (!provider) {
      return errorResponse('Ambulancia no encontrada', 404);
    }

    const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || 'Servicio de Ambulancia',
      description: provider.description,
      address: mainBranch?.address_text || '',
      phone: mainBranch?.phone_contact || '',
      whatsapp: mainBranch?.phone_contact || '',
      email: mainBranch?.email_contact || '',
      rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
      imageUrl: provider.logo_url,
    });
  } catch (error: any) {
    console.error('Error getting ambulance:', error);
    return errorResponse(error.message || 'Error al obtener ambulancia', 500);
  }
}

/**
 * GET /api/ambulances/search
 * Buscar ambulancias (público)
 */
export async function searchAmbulances(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const query = event.queryStringParameters?.q || '';

    const prisma = getPrismaClient();

    // Obtener la categoría de ambulancias
    const ambulanceCategory = await prisma.service_categories.findFirst({
      where: { slug: 'ambulance' },
    });

    if (!ambulanceCategory) {
      return errorResponse('Categoría de ambulancias no encontrada', 404);
    }

    // Buscar proveedores de tipo ambulancia
    const providers = await prisma.providers.findMany({
      where: {
        category_id: ambulanceCategory.id,
        verification_status: 'APPROVED',
        OR: [
          { commercial_name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        provider_branches: {
          where: {
            is_active: true,
            is_main: true,
          },
          take: 1,
        },
      },
      take: 20,
    });

    const formattedAmbulances = providers.map((provider) => {
      const mainBranch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || 'Servicio de Ambulancia',
        description: provider.description,
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
        imageUrl: provider.logo_url,
      };
    });

    return successResponse(formattedAmbulances);
  } catch (error: any) {
    console.error('Error searching ambulances:', error);
    return errorResponse(error.message || 'Error al buscar ambulancias', 500);
  }
}
