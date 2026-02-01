import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse, unauthorizedResponse } from '../shared/response';
import { requireRole } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';
import { logger } from '../shared/logger';

// GET /api/laboratories/:userId/dashboard
export async function getLaboratoryDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [LABORATORIES] GET /api/laboratories/:userId/dashboard - Obteniendo dashboard');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  const path = event.requestContext.http.path;
  // Extraer userId del path: /api/laboratories/{userId}/dashboard
  const pathParts = path.split('/');
  const userIdIndex = pathParts.indexOf('laboratories') + 1;
  const userId = pathParts[userIdIndex];

  // Verificar que el userId coincida con el usuario autenticado
  if (userId !== authResult.user.id) {
    return unauthorizedResponse('Unauthorized');
  }

  try {
    // Buscar provider del usuario con categoría "laboratory"
    const laboratoryCategory = await prisma.service_categories.findFirst({
      where: {
        OR: [
          { slug: 'laboratory' },
          { slug: 'laboratorio' },
          { name: { contains: 'laboratorio', mode: 'insensitive' } },
        ],
      },
    });

    if (!laboratoryCategory) {
      console.warn('⚠️ [LABORATORIES] No se encontró categoría de laboratorio');
      return notFoundResponse('Laboratory category not found');
    }

    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authResult.user.id,
        category_id: laboratoryCategory.id,
      },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1,
        },
        service_categories: {
          select: { name: true, slug: true },
        },
      },
    });

    if (!provider) {
      return notFoundResponse('Laboratory not found');
    }

    const branch = provider.provider_branches[0];

    // Obtener citas del laboratorio
    const appointments = await prisma.appointments.findMany({
      where: {
        provider_id: provider.id,
      },
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
            phone: true,
          },
        },
      },
      orderBy: { scheduled_for: 'desc' },
      take: 10,
    });

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
        description: provider.description || null,
        address: branch?.address_text || null,
        phone: branch?.phone_contact || null,
        whatsapp: branch?.phone_contact || null,
      },
      stats: {
        totalAppointments,
        pendingAppointments,
        completedAppointments,
      },
      recentAppointments: appointments.map(apt => ({
        id: apt.id,
        patientName: apt.patients?.full_name || 'Paciente',
        patientPhone: apt.patients?.phone || null,
        scheduledFor: apt.scheduled_for?.toISOString() || null,
        status: apt.status || null,
        reason: apt.reason || null,
      })),
      availableExams: [], // TODO: Implementar cuando haya tabla de exámenes
    });
  } catch (error: any) {
    console.error(`❌ [LABORATORIES] Error al obtener dashboard:`, error.message);
    logger.error('Error getting laboratory dashboard', error);
    return internalErrorResponse('Failed to get dashboard');
  }
}
