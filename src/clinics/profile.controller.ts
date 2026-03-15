import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updateClinicProfileSchema } from '../shared/validators';

// Helper para convertir número de día a nombre
function dayNumberToName(day: number): string {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days[day] || 'monday';
}

// Helper para convertir nombre de día a número (0=Lunes, 6=Domingo)
function dayNameToNumber(day: string): number {
  const map: Record<string, number> = {
    'monday': 0,
    'tuesday': 1,
    'wednesday': 2,
    'thursday': 3,
    'friday': 4,
    'saturday': 5,
    'sunday': 6,
  };
  return map[day.toLowerCase()] ?? 0;
}

// Helper para formatear Time a string HH:mm
function formatTime(time: Date | null): string {
  if (!time) return '09:00';
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// GET /api/clinics/profile
export async function getProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/profile - Obteniendo perfil de clínica');
  console.log('🔍 [CLINICS] Headers recibidos:', {
    authorization: event.headers.authorization ? 'Presente' : 'Ausente',
    Authorization: event.headers.Authorization ? 'Presente' : 'Ausente',
  });
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/profile - Error de autenticación/autorización');
    console.error('❌ [CLINICS] Status code:', authResult.statusCode);
    console.error('❌ [CLINICS] Body:', authResult.body);
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    console.log(`🔍 [CLINICS] Usuario autenticado: ${authContext.user.email} (${authContext.user.role})`);
    console.log(`🔍 [CLINICS] Buscando clínica para userId: ${authContext.user.id}`);
    
    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        clinic_specialties: {
          select: {
            specialty: true,
          },
        },
        clinic_schedules: {
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });

    if (!clinic) {
      console.log('⚠️ [CLINICS] Clínica no encontrada para el usuario');
      console.log('💡 [CLINICS] Verificando si existe provider asociado...');
      
      // Verificar si existe provider asociado (puede que la clínica no se haya creado correctamente)
      const provider = await prisma.providers.findFirst({
        where: { user_id: authContext.user.id },
        include: {
          service_categories: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      });
      
      if (provider) {
        console.log(`✅ [CLINICS] Provider encontrado: ${provider.commercial_name}, categoría: ${provider.service_categories?.slug}`);
        
        // Si el provider tiene categoría "clinic" pero no hay registro en clinics, crear uno básico
        if (provider.service_categories?.slug === 'clinic') {
          console.log('💡 [CLINICS] Provider es clínica pero no hay registro en tabla clinics. Creando registro básico...');
          
          try {
            // Crear registro básico en clinics
            const newClinic = await prisma.clinics.create({
              data: {
                id: randomUUID(),
                user_id: authContext.user.id,
                name: provider.commercial_name || 'Clínica',
                address: 'Dirección no especificada',
                phone: '0000000000',
                whatsapp: '0000000000',
                description: provider.description || '',
                is_active: true,
              },
            });
            
            console.log(`✅ [CLINICS] Registro de clínica creado: ${newClinic.id}`);
            
            // Retornar perfil básico
            return successResponse({
              id: newClinic.id,
              name: newClinic.name,
              logoUrl: provider.logo_url || null,
              specialties: [],
              address: newClinic.address,
              phone: newClinic.phone,
              whatsapp: newClinic.whatsapp,
              latitude: newClinic.latitude ? Number(newClinic.latitude) : null,
              longitude: newClinic.longitude ? Number(newClinic.longitude) : null,
              generalSchedule: {
                monday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                tuesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                wednesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                thursday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                friday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                saturday: { enabled: false, startTime: '09:00', endTime: '13:00' },
                sunday: { enabled: false, startTime: '09:00', endTime: '13:00' },
              },
              description: newClinic.description || '',
              isActive: newClinic.is_active ?? true,
              createdAt: newClinic.created_at?.toISOString() || null,
              updatedAt: newClinic.updated_at?.toISOString() || null,
            });
          } catch (createError: any) {
            console.error('❌ [CLINICS] Error al crear registro de clínica:', createError.message);
            // Si falla la creación, retornar perfil básico del provider
            return successResponse({
              id: provider.id,
              name: provider.commercial_name || 'Clínica',
              logoUrl: provider.logo_url || null,
              specialties: [],
              address: 'Dirección no especificada',
              phone: '0000000000',
              whatsapp: '0000000000',
              latitude: null,
              longitude: null,
              generalSchedule: {
                monday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                tuesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                wednesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                thursday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                friday: { enabled: false, startTime: '09:00', endTime: '18:00' },
                saturday: { enabled: false, startTime: '09:00', endTime: '13:00' },
                sunday: { enabled: false, startTime: '09:00', endTime: '13:00' },
              },
              description: provider.description || '',
              isActive: true,
              createdAt: null,
              updatedAt: null,
            });
          }
        } else {
          console.log(`⚠️ [CLINICS] Provider no es clínica, categoría: ${provider.service_categories?.slug}`);
        }
      } else {
        console.log('⚠️ [CLINICS] No se encontró provider asociado al usuario');
      }
      
      // Si no se puede crear o no es clínica, retornar error
      return notFoundResponse('Clinic profile not found');
    }

    // Construir objeto de horarios
    const schedule: Record<string, any> = {
      monday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      tuesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      wednesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      thursday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      friday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      saturday: { enabled: false, startTime: '09:00', endTime: '13:00' },
      sunday: { enabled: false, startTime: '09:00', endTime: '13:00' },
    };

    // Mapear horarios de la BD
    clinic.clinic_schedules.forEach((sched) => {
      const dayName = dayNumberToName(sched.day_of_week);
      schedule[dayName] = {
        enabled: sched.enabled ?? false,
        startTime: formatTime(sched.start_time),
        endTime: formatTime(sched.end_time),
      };
    });

    const formattedResponse = {
      id: clinic.id,
      name: clinic.name,
      logoUrl: clinic.logo_url || null,
      specialties: clinic.clinic_specialties.map((s) => s.specialty),
      address: clinic.address,
      phone: clinic.phone,
      whatsapp: clinic.whatsapp,
      latitude: clinic.latitude ? Number(clinic.latitude) : null,
      longitude: clinic.longitude ? Number(clinic.longitude) : null,
      google_maps_url: clinic.google_maps_url || null,
      generalSchedule: schedule,
      description: clinic.description || '',
      isActive: clinic.is_active ?? true,
      consultationPrices: clinic.consultation_prices || [],
      bankAccount: clinic.bank_account || null,
      createdAt: clinic.created_at?.toISOString() || null,
      updatedAt: clinic.updated_at?.toISOString() || null,
    };

    console.log('✅ [CLINICS] Perfil obtenido exitosamente');
    return successResponse(formattedResponse);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener perfil:`, error.message);
    logger.error('Error getting clinic profile', error);
    return internalErrorResponse('Failed to get clinic profile');
  }
}

// PUT /api/clinics/profile
export async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PUT /api/clinics/profile - Actualizando perfil de clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PUT /api/clinics/profile - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, updateClinicProfileSchema);

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // TRANSACCIÓN: Actualizar clínica, especialidades y horarios
    await prisma.$transaction(async (tx) => {
      // 1. Actualizar datos básicos de la clínica
      const clinicUpdateData: any = {
        updated_at: new Date(),
      };
      
      if (body.name !== undefined) clinicUpdateData.name = body.name;
      if (body.logoUrl !== undefined) clinicUpdateData.logo_url = body.logoUrl || null;
      if (body.address !== undefined) clinicUpdateData.address = body.address;
      if (body.phone !== undefined) clinicUpdateData.phone = body.phone;
      if (body.whatsapp !== undefined) clinicUpdateData.whatsapp = body.whatsapp;
      if (body.description !== undefined) clinicUpdateData.description = body.description;
      if (body.isActive !== undefined) clinicUpdateData.is_active = body.isActive;
      if (body.latitude !== undefined) clinicUpdateData.latitude = body.latitude !== null ? body.latitude : null;
      if (body.longitude !== undefined) clinicUpdateData.longitude = body.longitude !== null ? body.longitude : null;
      if (body.google_maps_url !== undefined) clinicUpdateData.google_maps_url = body.google_maps_url !== null && body.google_maps_url !== "" ? body.google_maps_url : null;
      
      // Nuevos campos JSON
      if (body.consultationPrices !== undefined) {
        // Validar que las especialidades existan en el array de especialties
        if (body.specialties) {
          const validSpecialties = body.specialties;
          const invalidPrices = body.consultationPrices.filter(
            (price: any) => !validSpecialties.includes(price.specialty)
          );
          if (invalidPrices.length > 0) {
            const invalidSpecialties = invalidPrices.map((p: any) => p.specialty).join(', ');
            console.error(`❌ [CLINICS] Especialidades inválidas en consultationPrices: ${invalidSpecialties}`);
            return errorResponse(`Invalid specialties in consultationPrices: ${invalidSpecialties}. Must be one of: ${validSpecialties.join(', ')}`, 400);
          }
        }
        clinicUpdateData.consultation_prices = body.consultationPrices;
      }
      
      if (body.bankAccount !== undefined) {
        clinicUpdateData.bank_account = body.bankAccount;
      }

      if (Object.keys(clinicUpdateData).length > 1) { // Más que solo updated_at
        await tx.clinics.update({
          where: { id: clinic.id },
          data: clinicUpdateData,
        });
      }

      // 2. Actualizar especialidades
      if (body.specialties !== undefined) {
        // Eliminar especialidades existentes
        await tx.clinic_specialties.deleteMany({
          where: { clinic_id: clinic.id },
        });

        // Crear nuevas especialidades
        if (body.specialties.length > 0) {
          await tx.clinic_specialties.createMany({
            data: body.specialties.map((specialty) => ({
              id: randomUUID(),
              clinic_id: clinic.id,
              specialty: specialty,
            })),
          });
        }
      }

      // 3. Actualizar horarios
      if (body.generalSchedule !== undefined) {
        // Eliminar horarios existentes
        await tx.clinic_schedules.deleteMany({
          where: { clinic_id: clinic.id },
        });

        // Crear nuevos horarios
        const scheduleEntries = Object.entries(body.generalSchedule);
        for (const [dayName, daySchedule] of scheduleEntries) {
          if (daySchedule.enabled) {
            const dayOfWeek = dayNameToNumber(dayName);
            const startTime = new Date(`1970-01-01T${daySchedule.startTime}:00Z`);
            const endTime = new Date(`1970-01-01T${daySchedule.endTime}:00Z`);

            await tx.clinic_schedules.create({
              data: {
                id: randomUUID(),
                clinic_id: clinic.id,
                day_of_week: dayOfWeek,
                enabled: true,
                start_time: startTime,
                end_time: endTime,
              },
            });
          }
        }
      }
    });

    // Recuperar clínica actualizada
    const updatedClinic = await prisma.clinics.findFirst({
      where: { id: clinic.id },
      include: {
        clinic_specialties: {
          select: {
            specialty: true,
          },
        },
        clinic_schedules: {
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });

    if (!updatedClinic) {
      return internalErrorResponse('Failed to retrieve updated clinic');
    }

    // Construir objeto de horarios actualizado
    const schedule: Record<string, any> = {
      monday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      tuesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      wednesday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      thursday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      friday: { enabled: false, startTime: '09:00', endTime: '18:00' },
      saturday: { enabled: false, startTime: '09:00', endTime: '13:00' },
      sunday: { enabled: false, startTime: '09:00', endTime: '13:00' },
    };

    updatedClinic.clinic_schedules.forEach((sched) => {
      const dayName = dayNumberToName(sched.day_of_week);
      schedule[dayName] = {
        enabled: sched.enabled ?? false,
        startTime: formatTime(sched.start_time),
        endTime: formatTime(sched.end_time),
      };
    });

    const formattedResponse = {
      id: updatedClinic.id,
      name: updatedClinic.name,
      logoUrl: updatedClinic.logo_url || null,
      specialties: updatedClinic.clinic_specialties.map((s) => s.specialty),
      address: updatedClinic.address,
      phone: updatedClinic.phone,
      whatsapp: updatedClinic.whatsapp,
      latitude: updatedClinic.latitude ? Number(updatedClinic.latitude) : null,
      longitude: updatedClinic.longitude ? Number(updatedClinic.longitude) : null,
      google_maps_url: updatedClinic.google_maps_url || null,
      generalSchedule: schedule,
      description: updatedClinic.description || '',
      isActive: updatedClinic.is_active ?? true,
      consultationPrices: updatedClinic.consultation_prices || [],
      bankAccount: updatedClinic.bank_account || null,
      createdAt: updatedClinic.created_at?.toISOString() || null,
      updatedAt: updatedClinic.updated_at?.toISOString() || null,
    };

    console.log('✅ [CLINICS] Perfil actualizado exitosamente');
    return successResponse(formattedResponse);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al actualizar perfil:`, error.message);
    logger.error('Error updating clinic profile', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update clinic profile');
  }
}

// POST /api/clinics/upload-logo
export async function uploadLogo(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] POST /api/clinics/upload-logo - Subiendo logo');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] POST /api/clinics/upload-logo - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = JSON.parse(event.body || '{}');
    const logoUrl = body.logoUrl || body.url || body.imageUrl;

    if (!logoUrl || typeof logoUrl !== 'string') {
      return errorResponse('Logo URL is required', 400);
    }

    // Validar que sea una URL válida o base64
    const isBase64 = logoUrl.startsWith('data:image/');
    const isUrl = logoUrl.startsWith('http://') || logoUrl.startsWith('https://');

    if (!isBase64 && !isUrl) {
      return errorResponse('Logo must be a valid URL or base64 image', 400);
    }

    // Buscar clínica del usuario
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Actualizar logo
    await prisma.clinics.update({
      where: { id: clinic.id },
      data: {
        logo_url: logoUrl,
        updated_at: new Date(),
      },
    });

    console.log('✅ [CLINICS] Logo actualizado exitosamente');
    return successResponse({
      logoUrl: logoUrl,
      message: 'Logo actualizado correctamente',
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al subir logo:`, error.message);
    logger.error('Error uploading logo', error);
    return internalErrorResponse('Failed to upload logo');
  }
}
