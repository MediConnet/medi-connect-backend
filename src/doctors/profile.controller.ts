import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updateDoctorProfileSchema } from '../shared/validators';

export async function getProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  console.log('✅ [DOCTORS] GET /api/doctors/profile - Obteniendo perfil');
  
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
      service_categories: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      provider_branches: {
        select: {
          id: true,
          name: true,
          address_text: true,
          phone_contact: true,
          email_contact: true,
        },
      },
    },
  });

  if (!profile) {
    console.log('⚠️ [DOCTORS] Provider no encontrado, retornando estructura vacía');
    // Retornar estructura completa con valores vacíos para usuarios nuevos
    const user = await prisma.users.findUnique({
      where: { id: authContext.user.id },
      select: {
        id: true,
        email: true,
        profile_picture_url: true,
      },
    });
    
    return successResponse({
      id: null,
      user_id: authContext.user.id,
      category_id: null,
      commercial_name: null,
      logo_url: null,
      description: null,
      verification_status: null,
      commission_percentage: null,
      users: user || {
        id: authContext.user.id,
        email: authContext.user.email || '',
        profile_picture_url: null,
      },
      service_categories: null,
      provider_branches: [],
    });
  }

  console.log('✅ [DOCTORS] GET /api/doctors/profile - Perfil obtenido exitosamente');
  return successResponse(profile);
}

export async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
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