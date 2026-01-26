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
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  console.log('✅ [DOCTORS] GET /api/doctors/profile - Obteniendo perfil');
  
  const profile = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
    include: {
      users: {
        select: {
          email: true,
          profile_picture_url: true,
          // full_name: true, // Descomenta si tu tabla users tiene full_name
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

// --- UPDATE PROFILE ---
export async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  try {
    const authContext = authResult as AuthContext;
    const body = parseBody(event.body || null, updateDoctorProfileSchema);
    const prisma = getPrismaClient();

    let profile = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: { provider_branches: { where: { is_main: true } } }
    });

    if (profile) {
      await prisma.$transaction(async (tx) => {
        // A. Actualizar Provider (Datos personales y experiencia)
        await tx.providers.update({
          where: { id: profile.id },
          data: {
            commercial_name: body.full_name || profile.commercial_name,
            description: body.bio || profile.description,
            years_of_experience: body.years_of_experience !== undefined 
                ? body.years_of_experience 
                : profile.years_of_experience,
          },
        });

        // B. Actualizar Sucursal Principal (Dirección, Tarifas, Estado)
        const mainBranch = profile.provider_branches[0];
        if (mainBranch) {
            // Preparamos el objeto de actualización solo con lo que venga en el body
            const branchData: any = {};
            
            if (body.address) branchData.address_text = body.address;
            if (body.phone || body.whatsapp) branchData.phone_contact = body.phone || body.whatsapp;
            if (body.consultation_fee !== undefined) branchData.consultation_fee = body.consultation_fee;
            if (body.payment_methods) branchData.payment_methods = body.payment_methods;
            if (body.is_published !== undefined) branchData.is_active = body.is_published; // Botón Publicar/Borrador

            if (Object.keys(branchData).length > 0) {
                await tx.provider_branches.update({
                    where: { id: mainBranch.id },
                    data: branchData
                });
            }
        }
      });

      return successResponse({ message: "Profile updated successfully" });

    } else {
      // 3. Crear Provider Nuevo (Primera vez)
      const newProviderId = randomUUID();
      
      const newProfile = await prisma.providers.create({
        data: {
          id: newProviderId,
          user_id: authContext.user.id,
          description: body.bio,
          commercial_name: body.full_name,
          years_of_experience: body.years_of_experience ?? 0,
          provider_branches: {
            create: {
                id: randomUUID(),
                name: 'Consultorio Principal',
                is_main: true,
                address_text: body.address,
                phone_contact: body.phone,
                consultation_fee: body.consultation_fee ?? 0,
                payment_methods: body.payment_methods ?? [],
                is_active: body.is_published ?? false, // Por defecto borrador si no especifica
            }
          }
        },
      });
      return successResponse(newProfile);
    }

  } catch (error: any) {
    logger.error('Error in updateProfile', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update profile');
  }
}