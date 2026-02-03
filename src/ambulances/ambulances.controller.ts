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

    if (authContext.user.role !== 'ambulance') {
      return errorResponse('No autorizado. Debe ser proveedor de ambulancia', 403);
    }

    const prisma = getPrismaClient();

    const ambulance = await prisma.ambulances.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!ambulance) {
      return errorResponse('Ambulancia no encontrada', 404);
    }

    // Calcular total de viajes
    const totalTrips = await prisma.ambulance_trips.count({
      where: { ambulance_id: ambulance.id },
    });

    return successResponse({
      id: ambulance.id,
      name: ambulance.name,
      description: ambulance.description,
      phone: ambulance.phone,
      whatsapp: ambulance.whatsapp,
      address: ambulance.address,
      rating: ambulance.rating_cache || 0,
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

    if (authContext.user.role !== 'ambulance') {
      return errorResponse('No autorizado. Debe ser proveedor de ambulancia', 403);
    }

    const body = JSON.parse(event.body || '{}');
    const { name, description, phone, whatsapp, address } = body;

    const prisma = getPrismaClient();

    const ambulance = await prisma.ambulances.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!ambulance) {
      return errorResponse('Ambulancia no encontrada', 404);
    }

    const updated = await prisma.ambulances.update({
      where: { id: ambulance.id },
      data: {
        name,
        description,
        phone,
        whatsapp,
        address,
        updated_at: new Date(),
      },
    });

    // Calcular total de viajes
    const totalTrips = await prisma.ambulance_trips.count({
      where: { ambulance_id: updated.id },
    });

    return successResponse({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      phone: updated.phone,
      whatsapp: updated.whatsapp,
      address: updated.address,
      rating: updated.rating_cache || 0,
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

    if (authContext.user.role !== 'ambulance') {
      return errorResponse('No autorizado. Debe ser proveedor de ambulancia', 403);
    }

    const prisma = getPrismaClient();

    const ambulance = await prisma.ambulances.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!ambulance) {
      return errorResponse('Ambulancia no encontrada', 404);
    }

    const reviews = await prisma.ambulance_reviews.findMany({
      where: { ambulance_id: ambulance.id },
      include: {
        users: {
          select: {
            email: true,
            patients: {
              select: {
                full_name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      patientName: review.users?.patients?.[0]?.full_name || review.users?.email || 'Paciente',
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

    if (authContext.user.role !== 'ambulance') {
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

    const ambulances = await prisma.ambulances.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        image_url: true,
        rating_cache: true,
      },
      orderBy: {
        rating_cache: 'desc',
      },
    });

    const formattedAmbulances = ambulances.map((ambulance) => ({
      id: ambulance.id,
      name: ambulance.name,
      description: ambulance.description,
      address: ambulance.address,
      phone: ambulance.phone,
      rating: ambulance.rating_cache || 0,
      imageUrl: ambulance.image_url,
    }));

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

    const ambulance = await prisma.ambulances.findUnique({
      where: { id: ambulanceId },
    });

    if (!ambulance) {
      return errorResponse('Ambulancia no encontrada', 404);
    }

    return successResponse({
      id: ambulance.id,
      name: ambulance.name,
      description: ambulance.description,
      address: ambulance.address,
      phone: ambulance.phone,
      whatsapp: ambulance.whatsapp,
      email: ambulance.email,
      rating: ambulance.rating_cache || 0,
      imageUrl: ambulance.image_url,
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

    const ambulances = await prisma.ambulances.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        image_url: true,
        rating_cache: true,
      },
      orderBy: {
        rating_cache: 'desc',
      },
      take: 20,
    });

    const formattedAmbulances = ambulances.map((ambulance) => ({
      id: ambulance.id,
      name: ambulance.name,
      description: ambulance.description,
      address: ambulance.address,
      phone: ambulance.phone,
      rating: ambulance.rating_cache || 0,
      imageUrl: ambulance.image_url,
    }));

    return successResponse(formattedAmbulances);
  } catch (error: any) {
    console.error('Error searching ambulances:', error);
    return errorResponse(error.message || 'Error al buscar ambulancias', 500);
  }
}
