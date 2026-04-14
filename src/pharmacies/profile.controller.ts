import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updatePharmacyProfileSchema } from '../shared/validators';
import { randomUUID } from 'crypto';
import { uploadImageToCloudinary, isBase64Image } from '../shared/cloudinary';

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

  // ⭐ Buscar provider con todas las relaciones (solo aprobados o pendientes, más reciente primero)
  const profile = await prisma.providers.findFirst({
    where: { 
      user_id: authContext.user.id,
      verification_status: { in: ['APPROVED', 'PENDING'] }, // Solo aprobados o pendientes
      // ⭐ Filtrar solo por tipo pharmacy
      service_categories: {
        slug: "pharmacy",
      },
    },
    include: {
      users: { select: { email: true, profile_picture_url: true } },
      service_categories: true,
      pharmacy_chains: true, // ⭐ Incluir relación con cadena
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
    // ⭐ Ordenar por más reciente primero
    orderBy: {
      id: "desc",
    },
  });

  if (!profile) return notFoundResponse('Pharmacy profile not found');

  const mainBranch = profile.provider_branches[0] || null;
  const user = profile.users;
  const isChainMember = !!(profile.chain_id && profile.pharmacy_chains); // ⭐ Asegurar booleano
  const chain = profile.pharmacy_chains;

  // ⭐ Si pertenece a una cadena, usar datos de la cadena; si no, usar datos del provider
  const formattedResponse = {
    id: profile.id,
    full_name: isChainMember && chain ? chain.name : (profile.commercial_name || user?.email),
    email: user?.email,
    profile_picture_url: isChainMember && chain ? (chain.logo_url || null) : (user?.profile_picture_url || profile.logo_url || null),
    is_chain_member: isChainMember === true, // ⭐ SIEMPRE booleano (true o false, nunca null/undefined)
    chain_name: isChainMember && chain ? chain.name : null,
    chain_logo: isChainMember && chain ? (chain.logo_url || null) : null,
    chain_description: isChainMember && chain ? (chain.description || null) : null,
    
    category: profile.service_categories?.name || 'Farmacia',
    description: isChainMember && chain ? (chain.description || '') : (profile.description || ''), // ⭐ Usar descripción de cadena si aplica
    address: mainBranch?.address_text || '',
    phone: mainBranch?.phone_contact || '',
    whatsapp: mainBranch?.phone_contact || '',
    latitude: mainBranch?.latitude ? Number(mainBranch.latitude) : null,
    longitude: mainBranch?.longitude ? Number(mainBranch.longitude) : null,
    google_maps_url: mainBranch?.google_maps_url || null,
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
    console.log('📤 [PHARMACIES] PUT /api/pharmacies/profile - Body recibido:', event.body?.substring(0, 500));
    const body = parseBody(event.body || null, updatePharmacyProfileSchema);
    console.log('✅ [PHARMACIES] Body validado:', JSON.stringify(body, null, 2));
    const prisma = getPrismaClient();

    // ⭐ Buscar provider (solo aprobados o pendientes, más reciente primero)
    let profile = await prisma.providers.findFirst({
      where: { 
        user_id: authContext.user.id,
        verification_status: { in: ['APPROVED', 'PENDING'] }, // Solo aprobados o pendientes
        // ⭐ Filtrar solo por tipo pharmacy
        service_categories: {
          slug: "pharmacy",
        },
      },
      include: { 
        provider_branches: { where: { is_main: true } },
        pharmacy_chains: true, // ⭐ Incluir relación con cadena
      },
      // ⭐ Ordenar por más reciente primero
      orderBy: {
        id: "desc",
      },
    });

    if (!profile) return notFoundResponse('Pharmacy profile not found for updates');

    // ⭐ Validar: Si pertenece a una cadena, ignorar cambios a nombre, logo ni descripción
    const isChainMember = !!(profile.chain_id && profile.pharmacy_chains);
    if (isChainMember) {
      // ⭐ Ignorar estos campos si vienen en el request (no retornar error, solo ignorar)
      // El frontend ya los deshabilitará, pero por seguridad los ignoramos aquí
      if (body.full_name !== undefined) {
        console.log(`ℹ️ [PHARMACIES] Ignorando full_name porque pertenece a cadena`);
        delete body.full_name;
      }
      if (body.description !== undefined || body.bio !== undefined) {
        console.log(`ℹ️ [PHARMACIES] Ignorando description/bio porque pertenece a cadena`);
        delete body.description;
        delete body.bio;
      }
      // Nota: profile_picture_url no está en el schema, pero si el frontend lo envía, se ignorará
      console.log(`ℹ️ [PHARMACIES] Farmacia pertenece a cadena, ignorando cambios a nombre y descripción`);
    }

    // --- SUBIR IMAGEN A CLOUDINARY (fuera de la transacción) ---
    let uploadedImageUrl: string | undefined;
    if (body.imageUrl && isBase64Image(body.imageUrl)) {
      try {
        uploadedImageUrl = await uploadImageToCloudinary(body.imageUrl, 'providers/pharmacies');
        console.log('✅ [PHARMACIES] Imagen subida a Cloudinary:', uploadedImageUrl);
      } catch (imgErr: any) {
        console.error('❌ [PHARMACIES] Error subiendo imagen a Cloudinary:', imgErr.message);
        return errorResponse('Error al subir la imagen. Intenta de nuevo.', 500);
      }
    } else if (body.imageUrl && !isBase64Image(body.imageUrl) && !body.imageUrl.startsWith('blob:')) {
      // Solo usar la URL si es una URL válida (no un blob URL temporal)
      uploadedImageUrl = body.imageUrl;
    }

    // --- TRANSACCIÓN UNIFICADA ---
    await prisma.$transaction(async (tx) => {
      
      // A. Actualizar Provider (solo si NO pertenece a una cadena)
      const providerUpdateData: any = {};

      // ⭐ Solo actualizar commercial_name y description si NO pertenece a una cadena
      if (!isChainMember) {
        if (body.full_name !== undefined) {
          providerUpdateData.commercial_name = body.full_name;
        }
        if (body.bio !== undefined || body.description !== undefined) {
          providerUpdateData.description = body.bio || body.description;
        }
      }
      
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
            latitude: body.latitude !== undefined ? body.latitude : undefined,
            longitude: body.longitude !== undefined ? body.longitude : undefined,
            google_maps_url: body.google_maps_url !== undefined ? (body.google_maps_url === "" ? null : body.google_maps_url) : undefined,
            phone_contact: body.whatsapp || body.phone, 
            is_active: body.is_published,
            has_delivery: body.has_delivery,
            is_24h: body.is_24h,
            image_url: uploadedImageUrl, // Cloudinary URL
        };
        
        Object.keys(branchData).forEach(key => branchData[key] === undefined && delete branchData[key]);

        if (Object.keys(branchData).length > 0) {
          console.log('💾 [PHARMACIES] Actualizando branch con datos:', JSON.stringify(branchData, null, 2));
          await tx.provider_branches.update({
            where: { id: mainBranch.id },
            data: branchData
          });
          console.log('✅ [PHARMACIES] Branch actualizado exitosamente');
        } else {
          console.log('⚠️ [PHARMACIES] No hay datos para actualizar en branch');
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
      where: { 
        id: profile.id,
        // ⭐ Filtrar solo por tipo pharmacy
        service_categories: {
          slug: "pharmacy",
        },
      },
      include: {
        users: { select: { email: true, profile_picture_url: true } },
        service_categories: true,
        pharmacy_chains: true, // ⭐ Incluir relación con cadena
        provider_branches: {
          where: { is_main: true },
          take: 1,
          include: { provider_schedules: { orderBy: { day_of_week: 'asc' } } }
        },
      },
    });

    const updatedMainBranch = updatedProfile?.provider_branches[0] || null;
    const updatedUser = updatedProfile?.users;
    const updatedIsChainMember = !!(updatedProfile?.chain_id && updatedProfile?.pharmacy_chains);
    const updatedChain = updatedProfile?.pharmacy_chains;

    // ⭐ Si pertenece a una cadena, usar datos de la cadena; si no, usar datos del provider
    const formattedResponse = {
      id: updatedProfile?.id,
      full_name: updatedIsChainMember && updatedChain ? updatedChain.name : (updatedProfile?.commercial_name || updatedUser?.email),
      email: updatedUser?.email, 
      profile_picture_url: updatedIsChainMember && updatedChain ? (updatedChain.logo_url || null) : (updatedUser?.profile_picture_url || updatedProfile?.logo_url || null),
      is_chain_member: updatedIsChainMember === true, // ⭐ SIEMPRE booleano (true o false, nunca null/undefined)
      chain_name: updatedIsChainMember && updatedChain ? updatedChain.name : null,
      chain_logo: updatedIsChainMember && updatedChain ? (updatedChain.logo_url || null) : null,
      chain_description: updatedIsChainMember && updatedChain ? (updatedChain.description || null) : null,
      
      category: updatedProfile?.service_categories?.name || 'Farmacia',
      description: updatedIsChainMember && updatedChain ? (updatedChain.description || '') : (updatedProfile?.description || ''), // ⭐ Usar descripción de cadena si aplica
      address: updatedMainBranch?.address_text || '',
      phone: updatedMainBranch?.phone_contact || '',
      whatsapp: updatedMainBranch?.phone_contact || '',
      latitude: updatedMainBranch?.latitude ? Number(updatedMainBranch.latitude) : null,
      longitude: updatedMainBranch?.longitude ? Number(updatedMainBranch.longitude) : null,
      google_maps_url: updatedMainBranch?.google_maps_url || null,
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
    console.error('❌ [PHARMACIES] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    if (error.message && error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    if (error.message) {
      return errorResponse(error.message, 500);
    }
    return internalErrorResponse('Failed to update profile');
  }
}
