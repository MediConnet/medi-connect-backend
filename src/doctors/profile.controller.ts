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

  // 1. Buscamos el Provider con todas las relaciones
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
      specialties: true,
      service_categories: true,
      provider_branches: {
        where: { is_main: true },
        take: 1,
        include: {
          provider_schedules: {
            orderBy: { day_of_week: 'asc' }
          }
        }
      },
    },
  });

  if (!profile) {
    return notFoundResponse('Doctor profile not found');
  }

  // 2. Procesamiento de datos
  const mainBranch = profile.provider_branches[0] || null;
  const user = profile.users;

  // Formateo de especialidades
  const specialtyName = profile.specialties.length > 0 
    ? profile.specialties.map((s: any) => s.name).join(', ') 
    : 'General';

  // 3. Respuesta formateada incluyendo los NUEVOS CAMPOS
  const formattedResponse = {
    id: profile.id,
    full_name: profile.commercial_name || user?.email,
    email: user?.email,
    profile_picture_url: user?.profile_picture_url || profile.logo_url,
    
    // Información Profesional
    specialty: specialtyName,
    category: profile.service_categories?.name || 'Salud',
    years_of_experience: profile.years_of_experience ?? 0, // Nuevo campo
    
    // Tarifas y Pagos (Desde la sucursal principal)
    consultation_fee: mainBranch?.consultation_fee 
        ? parseFloat(mainBranch.consultation_fee.toString()) 
        : 0.00,
    payment_methods: mainBranch?.payment_methods || [], // Array de strings
    
    // Bio
    description: profile.description || '',
    
    // Contacto
    address: mainBranch?.address_text || '',
    phone: mainBranch?.phone_contact || '',
    whatsapp: mainBranch?.phone_contact || '',
    latitude: mainBranch?.latitude || null,
    longitude: mainBranch?.longitude || null,
    
    // Estado (Verificación y Publicación)
    status: profile.verification_status,
    is_published: mainBranch?.is_active ?? false, // Mapeamos is_active a "is_published" para el front
    commission_percentage: profile.commission_percentage,
    
    // Horarios
    schedules: mainBranch?.provider_schedules.map(sch => ({
      day_id: sch.day_of_week,
      day: dayNumberToString(sch.day_of_week ?? 0),
      start: sch.start_time,
      end: sch.end_time,
      is_active: true
    })) || []
  };

  return successResponse(formattedResponse);
}

function dayNumberToString(day: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[day] || 'Desconocido';
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