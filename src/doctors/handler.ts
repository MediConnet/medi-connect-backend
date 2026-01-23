import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole, AuthContext } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';
import { randomUUID } from 'crypto';
import { updateDoctorProfileSchema, parseBody } from '../shared/validators';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Doctors handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    const { optionsResponse } = await import('../shared/response');
    return optionsResponse(event);
  }

  try {
    // GET /api/doctors/profile
    if (method === 'GET' && path === '/api/doctors/profile') {
      console.log('✅ [DOCTORS] GET /api/doctors/profile - Obteniendo perfil');
      const result = await getProfile(event);
      console.log(`✅ [DOCTORS] GET /api/doctors/profile - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/doctors/profile
    if (method === 'PUT' && path === '/api/doctors/profile') {
      console.log('✅ [DOCTORS] PUT /api/doctors/profile - Actualizando perfil');
      const result = await updateProfile(event);
      console.log(`✅ [DOCTORS] PUT /api/doctors/profile - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/doctors/appointments
    if (method === 'GET' && path === '/api/doctors/appointments') {
      console.log('✅ [DOCTORS] GET /api/doctors/appointments - Obteniendo citas');
      const result = await getAppointments(event);
      console.log(`✅ [DOCTORS] GET /api/doctors/appointments - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/doctors/dashboard
    if (method === 'GET' && path === '/api/doctors/dashboard') {
      console.log('✅ [DOCTORS] GET /api/doctors/dashboard - Obteniendo dashboard');
      const result = await getDashboard(event);
      console.log(`✅ [DOCTORS] GET /api/doctors/dashboard - Completado con status ${result.statusCode}`);
      return result;
    }

    console.log(`❌ [DOCTORS] ${method} ${path} - Ruta no encontrada (404)`);
    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] ${method} ${path} - Error:`, error.message);
    logger.error('Error in doctors handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function getProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📋 [GET_PROFILE] Obteniendo perfil del doctor');
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_PROFILE] Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  const profile = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          profile_picture_url: true,
        },
      },
    },
  });

  if (!profile) {
    console.error('❌ [GET_PROFILE] Perfil no encontrado');
    return notFoundResponse('Doctor profile not found');
  }

  console.log('✅ [GET_PROFILE] Perfil obtenido exitosamente');
  return successResponse(profile);
}

async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📝 [UPDATE_PROFILE] Actualizando perfil del doctor');
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [UPDATE_PROFILE] Error de autenticación');
    return authResult;
  }

  try {
    const authContext = authResult as AuthContext;
    const body = parseBody(event.body || null, updateDoctorProfileSchema);
    const prisma = getPrismaClient();

    // Buscar o crear provider
    let profile = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (profile) {
      profile = await prisma.providers.update({
        where: { id: profile.id },
        data: {
          description: body.bio || profile.description,
        },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              profile_picture_url: true,
            },
          },
        },
      });
    } else {
      profile = await prisma.providers.create({
        data: {
          id: randomUUID(),
          user_id: authContext.user.id,
          description: body.bio,
        },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              profile_picture_url: true,
            },
          },
        },
      });
    }

    console.log('✅ [UPDATE_PROFILE] Perfil actualizado exitosamente');
    return successResponse(profile);
  } catch (error: any) {
    console.error('❌ [UPDATE_PROFILE] Error al actualizar perfil:', error.message);
    logger.error('Error in updateProfile', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update profile');
  }
}

async function getAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📅 [GET_APPOINTMENTS] Obteniendo citas del doctor');
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_APPOINTMENTS] Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  // Buscar provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
  });

  if (!provider) {
    return notFoundResponse('Doctor profile not found');
  }

  // Query params
  const queryParams = event.queryStringParameters || {};
  const status = queryParams.status;
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  const appointments = await prisma.appointments.findMany({
    where: {
      provider_id: provider.id,
      ...(status && { status: status as any }),
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
    orderBy: { scheduled_for: 'asc' },
    take: limit,
    skip: offset,
  });

  console.log(`✅ [GET_APPOINTMENTS] Se obtuvieron ${appointments.length} citas`);
  return successResponse({
    appointments,
    pagination: {
      limit,
      offset,
      total: appointments.length,
    },
  });
}

async function getDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📊 [GET_DASHBOARD] Obteniendo dashboard del doctor');
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_DASHBOARD] Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  // Buscar provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
    include: {
      provider_branches: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!provider) {
    console.error('❌ [GET_DASHBOARD] Perfil de doctor no encontrado');
    return notFoundResponse('Doctor profile not found');
  }

  console.log('📊 [GET_DASHBOARD] Calculando estadísticas...');
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
    prisma.payments.aggregate({
      where: {
        appointments: {
          provider_id: provider.id,
        },
        status: 'completed',
      },
      _sum: {
        provider_amount: true,
      },
    }),
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

  console.log(`✅ [GET_DASHBOARD] Dashboard generado: ${totalAppointments} citas, ${totalReviews} reseñas`);
  return successResponse({
    totalAppointments,
    pendingAppointments,
    completedAppointments,
    totalRevenue: totalRevenue._sum.provider_amount || 0,
    averageRating: averageRating._avg.rating || 0,
    totalReviews,
    upcomingAppointments,
    provider: {
      id: provider.id,
      commercial_name: provider.commercial_name,
      branches: provider.provider_branches,
    },
  });
}
