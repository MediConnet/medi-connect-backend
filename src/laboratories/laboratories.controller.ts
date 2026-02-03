import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse } from '../shared/response';
import { requireAuth, AuthContext } from '../shared/auth';

/**
 * GET /api/laboratories/:userId/dashboard
 * Obtener dashboard de un laboratorio (requiere autenticación)
 */
export async function getLaboratoryDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    if (authContext.user.role !== 'lab') {
      return errorResponse('No autorizado. Debe ser proveedor de laboratorio', 403);
    }

    const prisma = getPrismaClient();

    // Buscar laboratorio del usuario
    const laboratory = await prisma.laboratories.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        laboratory_exams: {
          where: { is_available: true },
          take: 10,
          orderBy: { created_at: 'desc' },
        },
        laboratory_appointments: {
          take: 10,
          orderBy: { created_at: 'desc' },
          include: {
            patients: {
              select: {
                full_name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!laboratory) {
      return errorResponse('Laboratorio no encontrado', 404);
    }

    // Calcular estadísticas
    const totalAppointments = await prisma.laboratory_appointments.count({
      where: { laboratory_id: laboratory.id },
    });

    const pendingAppointments = await prisma.laboratory_appointments.count({
      where: {
        laboratory_id: laboratory.id,
        status: 'pending',
      },
    });

    const completedAppointments = await prisma.laboratory_appointments.count({
      where: {
        laboratory_id: laboratory.id,
        status: 'completed',
      },
    });

    return successResponse({
      laboratory: {
        id: laboratory.id,
        name: laboratory.name,
        description: laboratory.description,
        address: laboratory.address,
        phone: laboratory.phone,
        whatsapp: laboratory.whatsapp,
      },
      stats: {
        totalAppointments,
        pendingAppointments,
        completedAppointments,
      },
      recentAppointments: laboratory.laboratory_appointments.map((apt) => ({
        id: apt.id,
        patientName: apt.patients?.full_name || 'Paciente',
        patientPhone: apt.patients?.phone || '',
        examName: apt.exam_name,
        scheduledFor: apt.scheduled_for,
        status: apt.status,
        createdAt: apt.created_at,
      })),
      availableExams: laboratory.laboratory_exams.map((exam) => ({
        id: exam.id,
        name: exam.name,
        description: exam.description,
        price: parseFloat(exam.price.toString()),
        preparation: exam.preparation,
      })),
    });
  } catch (error: any) {
    console.error('Error getting laboratory dashboard:', error);
    return errorResponse(error.message || 'Error al obtener dashboard', 500);
  }
}


/**
 * GET /api/laboratories
 * Listar todos los laboratorios (público)
 */
export async function getAllLaboratories(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const prisma = getPrismaClient();

    const laboratories = await prisma.laboratories.findMany({
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

    const formattedLaboratories = laboratories.map((lab) => ({
      id: lab.id,
      name: lab.name,
      description: lab.description,
      address: lab.address,
      phone: lab.phone,
      rating: lab.rating_cache || 0,
      imageUrl: lab.image_url,
    }));

    return successResponse(formattedLaboratories);
  } catch (error: any) {
    console.error('Error getting laboratories:', error);
    return errorResponse(error.message || 'Error al obtener laboratorios', 500);
  }
}

/**
 * GET /api/laboratories/:id
 * Obtener detalle de un laboratorio (público)
 */
export async function getLaboratoryById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const laboratoryId = event.pathParameters?.id;
    if (!laboratoryId) {
      return errorResponse('ID de laboratorio requerido', 400);
    }

    const prisma = getPrismaClient();

    const laboratory = await prisma.laboratories.findUnique({
      where: { id: laboratoryId },
      include: {
        laboratory_exams: {
          where: { is_available: true },
        },
      },
    });

    if (!laboratory) {
      return errorResponse('Laboratorio no encontrado', 404);
    }

    return successResponse({
      id: laboratory.id,
      name: laboratory.name,
      description: laboratory.description,
      address: laboratory.address,
      phone: laboratory.phone,
      whatsapp: laboratory.whatsapp,
      email: laboratory.email,
      rating: laboratory.rating_cache || 0,
      imageUrl: laboratory.image_url,
      exams: laboratory.laboratory_exams.map((exam) => ({
        id: exam.id,
        name: exam.name,
        description: exam.description,
        price: parseFloat(exam.price.toString()),
      })),
    });
  } catch (error: any) {
    console.error('Error getting laboratory:', error);
    return errorResponse(error.message || 'Error al obtener laboratorio', 500);
  }
}

/**
 * GET /api/laboratories/search
 * Buscar laboratorios (público)
 */
export async function searchLaboratories(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const query = event.queryStringParameters?.q || '';

    const prisma = getPrismaClient();

    const laboratories = await prisma.laboratories.findMany({
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

    const formattedLaboratories = laboratories.map((lab) => ({
      id: lab.id,
      name: lab.name,
      description: lab.description,
      address: lab.address,
      phone: lab.phone,
      rating: lab.rating_cache || 0,
      imageUrl: lab.image_url,
    }));

    return successResponse(formattedLaboratories);
  } catch (error: any) {
    console.error('Error searching laboratories:', error);
    return errorResponse(error.message || 'Error al buscar laboratorios', 500);
  }
}
