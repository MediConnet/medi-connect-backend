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

    if (authContext.user.role !== 'lab' && authContext.user.role !== 'provider') {
      return errorResponse('No autorizado. Debe ser proveedor de laboratorio', 403);
    }

    const prisma = getPrismaClient();

    // Buscar proveedor del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        provider_branches: {
          where: { is_active: true },
        },
        provider_catalog: {
          where: { is_available: true },
          take: 10,
        },
        appointments: {
          take: 10,
          orderBy: { scheduled_for: 'desc' },
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

    if (!provider) {
      return errorResponse('Laboratorio no encontrado', 404);
    }

    const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];

    // Calcular estadísticas
    const totalAppointments = await prisma.appointments.count({
      where: { provider_id: provider.id },
    });

    const pendingAppointments = await prisma.appointments.count({
      where: {
        provider_id: provider.id,
        status: 'CONFIRMED',
      },
    });

    const completedAppointments = await prisma.appointments.count({
      where: {
        provider_id: provider.id,
        status: 'COMPLETED',
      },
    });

    return successResponse({
      laboratory: {
        id: provider.id,
        name: provider.commercial_name || 'Laboratorio',
        description: provider.description,
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        whatsapp: mainBranch?.phone_contact || '',
      },
      stats: {
        totalAppointments,
        pendingAppointments,
        completedAppointments,
      },
      recentAppointments: provider.appointments.map((apt) => ({
        id: apt.id,
        patientName: apt.patients?.full_name || 'Paciente',
        patientPhone: apt.patients?.phone || '',
        examName: apt.reason || 'Examen',
        scheduledFor: apt.scheduled_for,
        status: apt.status,
        createdAt: apt.scheduled_for,
      })),
      availableExams: provider.provider_catalog.map((exam) => ({
        id: exam.id,
        name: exam.name || '',
        description: exam.description,
        price: exam.price ? parseFloat(exam.price.toString()) : 0,
        preparation: exam.description, // Usar description como preparation
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

    // Obtener la categoría de laboratorios
    const laboratoryCategory = await prisma.service_categories.findFirst({
      where: { slug: 'laboratory' },
    });

    if (!laboratoryCategory) {
      return errorResponse('Categoría de laboratorios no encontrada', 404);
    }

    // Obtener proveedores de tipo laboratorio con sus sucursales principales
    const providers = await prisma.providers.findMany({
      where: {
        category_id: laboratoryCategory.id,
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

    const formattedLaboratories = providers.map((provider) => {
      const mainBranch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || 'Laboratorio',
        description: provider.description,
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
        imageUrl: provider.logo_url,
      };
    });

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

    const provider = await prisma.providers.findUnique({
      where: { id: laboratoryId },
      include: {
        provider_branches: {
          where: { is_active: true },
        },
        provider_catalog: {
          where: { is_available: true },
        },
      },
    });

    if (!provider) {
      return errorResponse('Laboratorio no encontrado', 404);
    }

    const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || 'Laboratorio',
      description: provider.description,
      address: mainBranch?.address_text || '',
      phone: mainBranch?.phone_contact || '',
      whatsapp: mainBranch?.phone_contact || '',
      email: mainBranch?.email_contact || '',
      rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
      imageUrl: provider.logo_url,
      exams: provider.provider_catalog.map((exam) => ({
        id: exam.id,
        name: exam.name || '',
        description: exam.description,
        price: exam.price ? parseFloat(exam.price.toString()) : 0,
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

    // Obtener la categoría de laboratorios
    const laboratoryCategory = await prisma.service_categories.findFirst({
      where: { slug: 'laboratory' },
    });

    if (!laboratoryCategory) {
      return errorResponse('Categoría de laboratorios no encontrada', 404);
    }

    // Buscar proveedores de tipo laboratorio
    const providers = await prisma.providers.findMany({
      where: {
        category_id: laboratoryCategory.id,
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

    const formattedLaboratories = providers.map((provider) => {
      const mainBranch = provider.provider_branches[0];
      return {
        id: provider.id,
        name: provider.commercial_name || 'Laboratorio',
        description: provider.description,
        address: mainBranch?.address_text || '',
        phone: mainBranch?.phone_contact || '',
        rating: mainBranch?.rating_cache ? parseFloat(mainBranch.rating_cache.toString()) : 0,
        imageUrl: provider.logo_url,
      };
    });

    return successResponse(formattedLaboratories);
  } catch (error: any) {
    console.error('Error searching laboratories:', error);
    return errorResponse(error.message || 'Error al buscar laboratorios', 500);
  }
}
