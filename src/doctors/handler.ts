import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse, successResponse } from '../shared/response';
import { getAppointments } from './appointments.controller';
import { getProfile, updateProfile } from './profile.controller';
import { requireRole, AuthContext } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { enum_roles } from '../generated/prisma/client';


export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Doctors handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // --- Rutas de Perfil ---
    if (path === '/api/doctors/profile') {
      if (method === 'GET') return await getProfile(event);
      if (method === 'PUT') return await updateProfile(event);
    }

    // --- Rutas de Dashboard ---
    if (path === '/api/doctors/dashboard') {
      if (method === 'GET') return await getDashboard(event);
    }

    // --- Rutas de Citas ---
    if (path === '/api/doctors/appointments') {
      if (method === 'GET') return await getAppointments(event);
    }

    // --- Rutas de Pacientes ---
    if (path === '/api/doctors/patients') {
      if (method === 'GET') return await getPatients(event);
    }

    // --- Rutas de Reseñas ---
    if (path === '/api/doctors/reviews') {
      if (method === 'GET') return await getReviews(event);
    }

    // --- Rutas de Pagos ---
    if (path === '/api/doctors/payments' || path === '/api/doctors/payments/income') {
      if (method === 'GET') return await getPayments(event);
    }

    // Si no coincide ninguna ruta
    return errorResponse('Not found', 404);

  } catch (error: any) {
    console.error(`❌ [DOCTORS] ${method} ${path} - Error:`, error.message);
    logger.error('Error in doctors handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function getDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/dashboard - Obteniendo dashboard del doctor');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/dashboard - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  console.log(`🔍 [DOCTORS] Obteniendo dashboard para userId: ${userId}`);

  // Buscar provider con información completa
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
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

  // Obtener specialty por separado (si existe la relación)
  // Por ahora retornamos null, se puede implementar después si es necesario
  const firstSpecialty = null;

  if (!provider) {
    console.log(`⚠️ [DOCTORS] Provider no encontrado para userId: ${userId}, retornando valores en 0`);
    // Retornar valores en 0 para usuarios nuevos sin provider aún
    // IMPORTANTE: Retornar estructura completa con todos los campos esperados por el frontend
    return successResponse({
      totalAppointments: 0,
      pendingAppointments: 0,
      completedAppointments: 0,
      totalRevenue: 0,
      averageRating: 0,
      totalReviews: 0,
      upcomingAppointments: [],
      provider: {
        id: null,
        commercial_name: null,
        description: null,
        specialty: null,
        logoUrl: null,
        category: null,
        branches: [],
      },
    });
  }

  // Obtener appointment_ids del provider primero para calcular revenue
  const providerAppointments = await prisma.appointments.findMany({
    where: { provider_id: provider.id },
    select: { id: true },
  });
  const appointmentIds = providerAppointments.map(a => a.id);

  // Obtener estadísticas
  const [
    totalAppointments,
    pendingAppointments,
    completedAppointments,
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

  // Obtener próximas citas
  const upcomingAppointments = await prisma.appointments.findMany({
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

  console.log('✅ [DOCTORS] GET /api/doctors/dashboard - Dashboard obtenido exitosamente');
  return successResponse({
    totalAppointments,
    pendingAppointments,
    completedAppointments,
    totalRevenue: Number(totalRevenue._sum?.provider_amount || 0),
    averageRating: Number(averageRating._avg?.rating || 0),
    totalReviews,
    upcomingAppointments: upcomingAppointments.map(apt => ({
      id: apt.id,
      scheduledFor: apt.scheduled_for,
      status: apt.status,
      reason: apt.reason,
      patient: apt.patients ? {
        id: apt.patients.id,
        fullName: apt.patients.full_name,
        phone: apt.patients.phone,
      } : null,
      branch: apt.provider_branches ? {
        id: apt.provider_branches.id,
        name: apt.provider_branches.name,
      } : null,
    })),
    provider: {
      id: provider.id,
      commercial_name: provider.commercial_name,
      description: provider.description || null,
      specialty: null, // TODO: Implementar cuando se necesite specialties
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

// Obtener pacientes del doctor
async function getPatients(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/patients - Obteniendo pacientes');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/patients - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  // Buscar provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
  });

  if (!provider) {
    console.log('⚠️ [DOCTORS] Provider no encontrado, retornando array vacío de pacientes');
    return successResponse({
      patients: [],
      total: 0,
    });
  }

  // Obtener pacientes únicos que tienen citas con este provider
  const appointments = await prisma.appointments.findMany({
    where: { provider_id: provider.id },
    include: {
      patients: {
        select: {
          id: true,
          full_name: true,
          phone: true,
          users: {
            select: {
              email: true,
              profile_picture_url: true,
            },
          },
        },
      },
    },
  });

  // Obtener pacientes únicos
  const uniquePatients = new Map();
  appointments.forEach(apt => {
    if (apt.patients && !uniquePatients.has(apt.patients.id)) {
      uniquePatients.set(apt.patients.id, {
        id: apt.patients.id,
        fullName: apt.patients.full_name,
        phone: apt.patients.phone,
        email: apt.patients.users?.email || null,
        profilePictureUrl: apt.patients.users?.profile_picture_url || null,
      });
    }
  });

  console.log('✅ [DOCTORS] GET /api/doctors/patients - Pacientes obtenidos exitosamente');
  return successResponse({
    patients: Array.from(uniquePatients.values()),
    total: uniquePatients.size,
  });
}

// Obtener reseñas del doctor
async function getReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/reviews - Obteniendo reseñas');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/reviews - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  // Buscar provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
  });

  if (!provider) {
    console.log('⚠️ [DOCTORS] Provider no encontrado, retornando array vacío de reseñas');
    return successResponse({
      reviews: [],
      averageRating: 0,
      totalReviews: 0,
    });
  }

  // Obtener reseñas de las sucursales del provider
  const reviews = await prisma.reviews.findMany({
    where: {
      provider_branches: {
        provider_id: provider.id,
      },
    },
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
      created_at: 'desc',
    },
  });

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : 0;

  console.log('✅ [DOCTORS] GET /api/doctors/reviews - Reseñas obtenidas exitosamente');
  return successResponse({
    reviews: reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment || null,
      createdAt: r.created_at,
      patient: r.patients ? {
        id: r.patients.id,
        fullName: r.patients.full_name,
        profilePictureUrl: r.patients.users?.profile_picture_url || null,
      } : null,
      branch: r.provider_branches ? {
        id: r.provider_branches.id,
        name: r.provider_branches.name,
      } : null,
    })),
    averageRating: Number(averageRating.toFixed(2)),
    totalReviews: reviews.length,
  });
}

// Obtener pagos e ingresos del doctor
async function getPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/payments - Obteniendo pagos e ingresos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/payments - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  // Buscar provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
  });

  if (!provider) {
    console.log('⚠️ [DOCTORS] Provider no encontrado, retornando valores en 0 para pagos');
    return successResponse({
      payments: [],
      totalIncome: 0,
      totalPending: 0,
      totalCompleted: 0,
      monthlyIncome: [],
    });
  }

  // Obtener appointment_ids del provider
  const providerAppointments = await prisma.appointments.findMany({
    where: { provider_id: provider.id },
    select: { id: true },
  });
  const appointmentIds = providerAppointments.map(a => a.id);

  if (appointmentIds.length === 0) {
    return successResponse({
      payments: [],
      totalIncome: 0,
      totalPending: 0,
      totalCompleted: 0,
      monthlyIncome: [],
    });
  }

  // Obtener pagos
  const payments = await prisma.payments.findMany({
    where: {
      appointment_id: { in: appointmentIds },
    },
    include: {
      appointments: {
        include: {
          patients: {
            select: {
              id: true,
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

  // Calcular totales
  const totalIncome = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
  
  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
  
  const totalCompleted = payments.filter(p => p.status === 'completed').length;

  // Agrupar por mes (últimos 6 meses)
  const monthlyIncome: Array<{ month: string; income: number }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthIncome = payments
      .filter(p => {
        if (!p.created_at || p.status !== 'completed') return false;
        const paymentDate = new Date(p.created_at);
        return paymentDate.getFullYear() === date.getFullYear() &&
               paymentDate.getMonth() === date.getMonth();
      })
      .reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
    
    monthlyIncome.push({
      month: monthKey,
      income: monthIncome,
    });
  }

  console.log('✅ [DOCTORS] GET /api/doctors/payments - Pagos obtenidos exitosamente');
  return successResponse({
    payments: payments.map(p => ({
      id: p.id,
      amount: Number(p.provider_amount || 0),
      totalAmount: Number(p.amount_total || 0),
      platformFee: Number(p.platform_fee || 0),
      status: p.status,
      createdAt: p.created_at,
      patient: p.appointments?.patients ? {
        id: p.appointments.patients.id,
        fullName: p.appointments.patients.full_name,
      } : null,
    })),
    totalIncome: Number(totalIncome.toFixed(2)),
    totalPending: Number(totalPending.toFixed(2)),
    totalCompleted,
    monthlyIncome,
  });
}
