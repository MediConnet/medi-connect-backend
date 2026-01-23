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
      return await getProfile(event);
    }

    // PUT /api/doctors/profile
    if (method === 'PUT' && path === '/api/doctors/profile') {
      return await updateProfile(event);
    }

    // GET /api/doctors/appointments
    if (method === 'GET' && path === '/api/doctors/appointments') {
      return await getAppointments(event);
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    logger.error('Error in doctors handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function getProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
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
    return notFoundResponse('Doctor profile not found');
  }

  return successResponse(profile);
}

async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
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

    return successResponse(profile);
  } catch (error: any) {
    logger.error('Error in updateProfile', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update profile');
  }
}

async function getAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
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

  return successResponse({
    appointments,
    pagination: {
      limit,
      offset,
      total: appointments.length,
    },
  });
}
