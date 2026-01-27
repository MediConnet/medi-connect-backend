import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updatePharmacyProfileSchema } from '../shared/validators';
import { randomUUID } from 'crypto';

// --- HELPER FUNCTIONS ---
function dayNumberToString(day: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[day] || 'Desconocido';
}

function getDayIdFromString(day: string): number {
  const map: Record<string, number> = { 
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6
  };
  return map[day.toLowerCase()] ?? 1;
}

// --- GET PROFILE ---
export async function getProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  // Buscar provider con todas las relaciones
  const profile = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
    include: {
      users: { select: { email: true, profile_picture_url: true } },
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

  if (!profile) return notFoundResponse('Pharmacy profile not found');

  const mainBranch = profile.provider_branches[0] || null;
  const user = profile.users;

  const formattedResponse = {
    id: profile.id,
    full_name: profile.commercial_name || user?.email,
    email: user?.email,
    profile_picture_url: user?.profile_picture_url || profile.logo_url,
    
    category: profile.service_categories?.name || 'Farmacia',
    description: profile.description || '',
    address: mainBranch?.address_text || '',
    phone: mainBranch?.phone_contact || '',
    whatsapp: mainBranch?.phone_contact || '',
    latitude: mainBranch?.latitude || null,
    longitude: mainBranch?.longitude || null,
    status: profile.verification_status,
    is_published: mainBranch?.is_active ?? false,
    commission_percentage: profile.commission_percentage,
    
    // Información específica de farmacia
    has_delivery: mainBranch?.has_delivery ?? false,
    is_24h: mainBranch?.is_24h ?? false,
    
    // Mapeo de horarios para el frontend
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

// --- UPDATE PROFILE ---
export async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  try {
    const authContext = authResult as AuthContext;
    const body = parseBody(event.body || null, updatePharmacyProfileSchema);
    const prisma = getPrismaClient();

    let profile = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: { provider_branches: { where: { is_main: true } } }
    });

    if (!profile) return notFoundResponse('Pharmacy profile not found for updates');

    // --- TRANSACCIÓN UNIFICADA ---
    await prisma.$transaction(async (tx) => {
      
      // A. Actualizar Provider
      const providerUpdateData: any = {
        commercial_name: body.full_name,
        description: body.bio || body.description,
      };
      
      // Limpieza de undefined
      Object.keys(providerUpdateData).forEach(key => providerUpdateData[key] === undefined && delete providerUpdateData[key]);

      if (Object.keys(providerUpdateData).length > 0) {
        await tx.providers.update({
          where: { id: profile.id },
          data: providerUpdateData,
        });
      }

      // B. Actualizar Sucursal Principal
      const mainBranch = profile?.provider_branches[0];
      if (mainBranch) {
        const branchData: any = {
            address_text: body.address,
            phone_contact: body.whatsapp || body.phone, 
            is_active: body.is_published,
            has_delivery: body.has_delivery,
            is_24h: body.is_24h,
        };
        
        Object.keys(branchData).forEach(key => branchData[key] === undefined && delete branchData[key]);

        if (Object.keys(branchData).length > 0) {
          await tx.provider_branches.update({
            where: { id: mainBranch.id },
            data: branchData
          });
        }

        // C. ACTUALIZAR HORARIOS (WORK SCHEDULE) 
        if (body.workSchedule && Array.isArray(body.workSchedule)) {
            await tx.provider_schedules.deleteMany({
                where: { branch_id: mainBranch.id }
            });

            for (const item of body.workSchedule) {
                if (item.enabled) {
                    const baseDate = '1970-01-01';
                    const startTime = new Date(`${baseDate}T${item.startTime}:00Z`);
                    const endTime = new Date(`${baseDate}T${item.endTime}:00Z`);

                    await tx.provider_schedules.create({
                        data: {
                            id: randomUUID(),
                            branch_id: mainBranch.id,
                            day_of_week: getDayIdFromString(item.day), 
                            start_time: startTime,
                            end_time: endTime,
                        }
                    });
                }
            }
        }
      }
    });

    // --- RECUPERAR PERFIL ACTUALIZADO COMPLETO ---
    const updatedProfile = await prisma.providers.findFirst({
      where: { id: profile.id },
      include: {
        users: { select: { email: true, profile_picture_url: true } },
        service_categories: true,
        provider_branches: {
          where: { is_main: true },
          take: 1,
          include: { provider_schedules: { orderBy: { day_of_week: 'asc' } } }
        },
      },
    });

    const updatedMainBranch = updatedProfile?.provider_branches[0] || null;
    const updatedUser = updatedProfile?.users;

    const formattedResponse = {
      id: updatedProfile?.id,
      full_name: updatedProfile?.commercial_name || updatedUser?.email,
      email: updatedUser?.email, 
      profile_picture_url: updatedUser?.profile_picture_url || updatedProfile?.logo_url,
      
      category: updatedProfile?.service_categories?.name || 'Farmacia',
      description: updatedProfile?.description || '',
      address: updatedMainBranch?.address_text || '',
      phone: updatedMainBranch?.phone_contact || '',
      whatsapp: updatedMainBranch?.phone_contact || '',
      latitude: updatedMainBranch?.latitude || null,
      longitude: updatedMainBranch?.longitude || null,
      status: updatedProfile?.verification_status,
      is_published: updatedMainBranch?.is_active ?? false,
      commission_percentage: updatedProfile?.commission_percentage,
      
      has_delivery: updatedMainBranch?.has_delivery ?? false,
      is_24h: updatedMainBranch?.is_24h ?? false,
      
      schedules: updatedMainBranch?.provider_schedules.map(sch => ({
        day_id: sch.day_of_week,
        day: dayNumberToString(sch.day_of_week ?? 0),
        start: sch.start_time,
        end: sch.end_time,
        is_active: true
      })) || []
    };

    return successResponse(formattedResponse);

  } catch (error: any) {
    logger.error('Error in updateProfile', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update profile');
  }
}
