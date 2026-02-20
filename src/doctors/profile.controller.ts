import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updateDoctorProfileSchema } from '../shared/validators';

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

  //  Buscamos el Provider con todas las relaciones
  const profile = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
    include: {
      users: { select: { email: true, profile_picture_url: true } },
      provider_specialties: {
        include: {
          specialties: {
            select: {
              id: true,
              name: true,
              color_hex: true,
              description: true
            }
          }
        }
      },
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

  if (!profile) return notFoundResponse('Doctor profile not found');

  const mainBranch = profile.provider_branches[0] || null;
  const user = profile.users;
  
  // Mapear especialidades con sus tarifas
  const specialtiesWithFees = profile.provider_specialties.map(ps => ({
    id: ps.specialties.id,
    name: ps.specialties.name,
    color_hex: ps.specialties.color_hex,
    description: ps.specialties.description,
    fee: parseFloat(ps.fee.toString())
  }));
  
  const specialtyName = specialtiesWithFees.length > 0 
    ? specialtiesWithFees.map(s => s.name).join(', ') 
    : 'General';

  const formattedResponse = {
    id: profile.id,
    full_name: profile.commercial_name || user?.email,
    email: user?.email,
    profile_picture_url: user?.profile_picture_url || profile.logo_url,
    
    specialty: specialtyName,
    specialties_list: specialtiesWithFees.map(s => s.name),
    specialties: specialtiesWithFees, // Ahora incluye fee
    
    category: profile.service_categories?.name || 'Salud',
    years_of_experience: profile.years_of_experience ?? 0,
    consultation_fee: specialtiesWithFees.length > 0 ? specialtiesWithFees[0].fee : 0.00, // Usar tarifa de primera especialidad
    payment_methods: mainBranch?.payment_methods || [],
    description: profile.description || '',
    address: mainBranch?.address_text || '',
    phone: mainBranch?.phone_contact || '',
    whatsapp: mainBranch?.phone_contact || '',
    latitude: mainBranch?.latitude || null,
    longitude: mainBranch?.longitude || null,
    status: profile.verification_status,
    is_published: mainBranch?.is_active ?? false, 
    commission_percentage: profile.commission_percentage,
    
    // Mapeo de horarios para el frontend - Estructura completa con todos los días
    schedules: (() => {
      const daysMap: Record<number, any> = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      // Inicializar todos los días como deshabilitados
      for (let i = 0; i < 7; i++) {
        daysMap[i] = {
          day: dayNames[i],
          enabled: false,
          startTime: null,
          endTime: null,
          breakStart: null,
          breakEnd: null,
        };
      }
      
      // Llenar con los horarios existentes
      if (mainBranch?.provider_schedules) {
        for (const sch of mainBranch.provider_schedules) {
          const dayNum = sch.day_of_week ?? 0;
          if (dayNum >= 0 && dayNum <= 6) {
            const startTime = sch.start_time ? new Date(sch.start_time).toISOString().substring(11, 16) : null;
            const endTime = sch.end_time ? new Date(sch.end_time).toISOString().substring(11, 16) : null;
            const breakStart = (sch as any).break_start
              ? new Date((sch as any).break_start).toISOString().substring(11, 16)
              : null;
            const breakEnd = (sch as any).break_end
              ? new Date((sch as any).break_end).toISOString().substring(11, 16)
              : null;
            
            daysMap[dayNum] = {
              day: dayNames[dayNum],
              enabled: true,
              startTime: startTime,
              endTime: endTime,
              breakStart,
              breakEnd,
            };
          }
        }
      }
      
      // Convertir a array en orden: lunes a domingo
      return [
        daysMap[1], // monday
        daysMap[2], // tuesday
        daysMap[3], // wednesday
        daysMap[4], // thursday
        daysMap[5], // friday
        daysMap[6], // saturday
        daysMap[0], // sunday
      ];
    })()
  };

  return successResponse(formattedResponse);
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

    if (!profile) return notFoundResponse('Doctor profile not found for updates');

    // --- TRANSACCIÓN UNIFICADA ---
    await prisma.$transaction(async (tx) => {
      
      // A. Actualizar Provider
      const providerUpdateData: any = {
        commercial_name: body.full_name,
        description: body.bio,
        years_of_experience: body.years_of_experience,
      };
      
      // Limpieza de undefined
      Object.keys(providerUpdateData).forEach(key => providerUpdateData[key] === undefined && delete providerUpdateData[key]);

      if (Object.keys(providerUpdateData).length > 0) {
        await tx.providers.update({
          where: { id: profile.id },
          data: providerUpdateData,
        });
      }

      // A2. Actualizar especialidades con tarifas
      if (body.specialties && Array.isArray(body.specialties)) {
        // Eliminar especialidades existentes
        await tx.provider_specialties.deleteMany({
          where: { provider_id: profile.id }
        });

        // Agregar nuevas especialidades con tarifas
        for (const spec of body.specialties) {
          // Si viene como string (nombre), buscar la especialidad
          if (typeof spec === 'string') {
            const specialty = await tx.specialties.findFirst({
              where: { name: spec }
            });
            if (specialty) {
              await tx.provider_specialties.create({
                data: {
                  provider_id: profile.id,
                  specialty_id: specialty.id,
                  fee: body.consultation_fee || 0
                }
              });
            }
          } 
          // Si viene como objeto con specialtyId y fee
          else if (typeof spec === 'object' && spec !== null) {
            const specObj = spec as any;
            if (specObj.specialtyId && specObj.fee !== undefined) {
              await tx.provider_specialties.create({
                data: {
                  provider_id: profile.id,
                  specialty_id: specObj.specialtyId,
                  fee: specObj.fee
                }
              });
            }
          }
        }
      }

      // B. Actualizar Sucursal Principal
      const mainBranch = profile?.provider_branches[0];
      if (mainBranch) {
        const branchData: any = {
            address_text: body.address,
            phone_contact: body.whatsapp || body.phone, 
            payment_methods: body.payment_methods,
            is_active: body.is_published
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
                    const breakStart = item.breakStart
                      ? new Date(`${baseDate}T${item.breakStart}:00Z`)
                      : null;
                    const breakEnd = item.breakEnd
                      ? new Date(`${baseDate}T${item.breakEnd}:00Z`)
                      : null;

                    await tx.provider_schedules.create({
                        data: {
                            id: randomUUID(),
                            branch_id: mainBranch.id,
                            day_of_week: getDayIdFromString(item.day), 
                            start_time: startTime,
                            end_time: endTime,
                            break_start: breakStart,
                            break_end: breakEnd,
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
        provider_specialties: {
          include: {
            specialties: {
              select: {
                id: true,
                name: true,
                color_hex: true,
                description: true
              }
            }
          }
        },
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
    
    // Mapear especialidades con sus tarifas
    const updatedSpecialtiesWithFees = updatedProfile?.provider_specialties.map(ps => ({
      id: ps.specialties.id,
      name: ps.specialties.name,
      color_hex: ps.specialties.color_hex,
      description: ps.specialties.description,
      fee: parseFloat(ps.fee.toString())
    })) || [];
    
    const specialtyName = updatedSpecialtiesWithFees.length 
      ? updatedSpecialtiesWithFees.map(s => s.name).join(', ') 
      : 'General';

    const formattedResponse = {
      id: updatedProfile?.id,
      full_name: updatedProfile?.commercial_name || updatedUser?.email,
      email: updatedUser?.email, 
      profile_picture_url: updatedUser?.profile_picture_url || updatedProfile?.logo_url,
      
      specialty: specialtyName,
      specialties_list: updatedSpecialtiesWithFees.map(s => s.name),
      specialties: updatedSpecialtiesWithFees, // Ahora incluye fee
      
      category: updatedProfile?.service_categories?.name || 'Salud',
      years_of_experience: updatedProfile?.years_of_experience ?? 0,
      consultation_fee: updatedSpecialtiesWithFees.length > 0 
          ? updatedSpecialtiesWithFees[0].fee 
          : 0.00,
      payment_methods: updatedMainBranch?.payment_methods || [],
      description: updatedProfile?.description || '',
      address: updatedMainBranch?.address_text || '',
      phone: updatedMainBranch?.phone_contact || '',
      whatsapp: updatedMainBranch?.phone_contact || '',
      latitude: updatedMainBranch?.latitude || null,
      longitude: updatedMainBranch?.longitude || null,
      status: updatedProfile?.verification_status,
      is_published: updatedMainBranch?.is_active ?? false,
      commission_percentage: updatedProfile?.commission_percentage,
      
      schedules: (() => {
        const daysMap: Record<number, any> = {};
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        // Inicializar todos los días como deshabilitados
        for (let i = 0; i < 7; i++) {
          daysMap[i] = {
            day: dayNames[i],
            enabled: false,
            startTime: null,
            endTime: null,
            breakStart: null,
            breakEnd: null,
          };
        }
        
        // Llenar con los horarios existentes
        if (updatedMainBranch?.provider_schedules) {
          for (const sch of updatedMainBranch.provider_schedules) {
            const dayNum = sch.day_of_week ?? 0;
            if (dayNum >= 0 && dayNum <= 6) {
              const startTime = sch.start_time ? new Date(sch.start_time).toISOString().substring(11, 16) : null;
              const endTime = sch.end_time ? new Date(sch.end_time).toISOString().substring(11, 16) : null;
              const breakStart = (sch as any).break_start
                ? new Date((sch as any).break_start).toISOString().substring(11, 16)
                : null;
              const breakEnd = (sch as any).break_end
                ? new Date((sch as any).break_end).toISOString().substring(11, 16)
                : null;
              
              daysMap[dayNum] = {
                day: dayNames[dayNum],
                enabled: true,
                startTime: startTime,
                endTime: endTime,
                breakStart,
                breakEnd,
              };
            }
          }
        }
        
        // Convertir a array en orden: lunes a domingo
        return [
          daysMap[1], // monday
          daysMap[2], // tuesday
          daysMap[3], // wednesday
          daysMap[4], // thursday
          daysMap[5], // friday
          daysMap[6], // saturday
          daysMap[0], // sunday
        ];
      })()
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