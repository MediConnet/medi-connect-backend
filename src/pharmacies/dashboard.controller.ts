import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';

export async function getDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] GET /api/pharmacies/dashboard - Obteniendo dashboard de farmacia');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] GET /api/pharmacies/dashboard - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  console.log(`🔍 [PHARMACIES] Obteniendo dashboard para userId: ${userId}`);

  // ⭐ Buscar provider con información completa (solo aprobados o pendientes, más reciente primero)
  const provider = await prisma.providers.findFirst({
    where: { 
      user_id: userId,
      verification_status: { in: ['APPROVED', 'PENDING'] }, // Solo aprobados o pendientes
    },
    include: {
      provider_branches: {
        select: {
          id: true,
          name: true,
          address_text: true,
          phone_contact: true,
          email_contact: true,
        },
      },
      service_categories: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!provider) {
    console.log(`⚠️ [PHARMACIES] Provider no encontrado para userId: ${userId}, retornando valores en 0`);
    return successResponse({
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalRevenue: 0,
      averageRating: 0,
      totalReviews: 0,
      totalProducts: 0,
      upcomingOrders: [],
      provider: {
        id: null,
        commercial_name: null,
        description: null,
        logoUrl: null,
        category: null,
        branches: [],
      },
    });
  }

  // Obtener appointment_ids del provider (los pedidos se manejan como appointments)
  const providerAppointments = await prisma.appointments.findMany({
    where: { provider_id: provider.id },
    select: { id: true },
  });
  const appointmentIds = providerAppointments.map(a => a.id);

  // Obtener productos del catálogo
  const totalProducts = await prisma.provider_catalog.count({
    where: { 
      provider_id: provider.id,
      type: 'product', // Solo productos, no servicios
    },
  });

  // Obtener estadísticas
  const [
    totalOrders,
    pendingOrders,
    completedOrders,
    totalRevenue,
    averageRating,
    totalReviews,
  ] = await Promise.all([
    prisma.appointments.count({
      where: { provider_id: provider.id },
    }),
    prisma.appointments.count({
      where: {
        provider_id: provider.id,
        status: 'CONFIRMED',
      },
    }),
    prisma.appointments.count({
      where: {
        provider_id: provider.id,
        status: 'COMPLETED',
      },
    }),
    // Agregar los pagos usando appointment_ids
    appointmentIds.length > 0
      ? prisma.payments.aggregate({
          where: {
            appointment_id: { in: appointmentIds },
            status: 'completed',
          },
          _sum: {
            provider_amount: true,
          },
        })
      : Promise.resolve({ _sum: { provider_amount: null } } as { _sum: { provider_amount: number | null } }),
    prisma.reviews.aggregate({
      where: {
        provider_branches: {
          provider_id: provider.id,
        },
      },
      _avg: {
        rating: true,
      },
    }),
    prisma.reviews.count({
      where: {
        provider_branches: {
          provider_id: provider.id,
        },
      },
    }),
  ]);

  // Obtener próximos pedidos
  const upcomingOrders = await prisma.appointments.findMany({
    where: {
      provider_id: provider.id,
      status: 'CONFIRMED',
      scheduled_for: {
        gte: new Date(),
      },
    },
    include: {
      patients: {
        select: {
          id: true,
          full_name: true,
          phone: true,
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
      scheduled_for: 'asc',
    },
    take: 5,
  });

  console.log('✅ [PHARMACIES] GET /api/pharmacies/dashboard - Dashboard obtenido exitosamente');
  return successResponse({
    totalOrders,
    pendingOrders,
    completedOrders,
    totalRevenue: Number(totalRevenue._sum?.provider_amount || 0),
    averageRating: Number(averageRating._avg?.rating || 0),
    totalReviews,
    totalProducts,
    upcomingOrders: upcomingOrders.map(order => ({
      id: order.id,
      scheduledFor: order.scheduled_for,
      status: order.status,
      reason: order.reason,
      patient: order.patients ? {
        id: order.patients.id,
        fullName: order.patients.full_name,
        phone: order.patients.phone,
      } : null,
      branch: order.provider_branches ? {
        id: order.provider_branches.id,
        name: order.provider_branches.name,
      } : null,
    })),
    provider: {
      id: provider.id,
      commercial_name: provider.commercial_name,
      description: provider.description || null,
      logoUrl: provider.logo_url || null,
      category: provider.service_categories ? {
        id: provider.service_categories.id,
        name: provider.service_categories.name,
        slug: provider.service_categories.slug,
      } : null,
      branches: (provider.provider_branches || []).map((branch: any) => ({
        id: branch.id,
        name: branch.name,
        address: branch.address_text || null,
        phone: branch.phone_contact || null,
        email: branch.email_contact || null,
      })),
    },
  });
}
