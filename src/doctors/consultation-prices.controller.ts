import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';

/**
 * GET /api/doctors/consultation-prices
 * Obtener especialidades del médico con sus precios
 * 
 * Retorna:
 * {
 *   "success": true,
 *   "data": {
 *     "Cardiología": 50.00,
 *     "Medicina General": 30.00
 *   }
 * }
 */
export async function getConsultationPrices(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/consultation-prices - Obteniendo precios de consulta');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const userId = authResult.user.id;

    // Obtener el provider del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!provider) {
      console.error(`❌ [DOCTORS] Provider no encontrado para usuario ${userId}`);
      return errorResponse('Provider no encontrado', 404);
    }

    // Obtener especialidades con sus precios
    const specialties = await prisma.provider_specialties.findMany({
      where: { provider_id: provider.id },
      include: {
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Formatear respuesta como objeto { "Especialidad": precio }
    const prices: Record<string, number> = {};
    specialties.forEach((ps) => {
      prices[ps.specialties.name] = parseFloat(ps.fee.toString());
    });

    console.log(`✅ [DOCTORS] Retornando ${Object.keys(prices).length} especialidades con precios:`, prices);
    
    return successResponse(prices);
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al obtener precios de consulta:', error.message);
    logger.error('Error getting consultation prices', error);
    return internalErrorResponse('Failed to get consultation prices');
  }
}

/**
 * PUT /api/doctors/consultation-prices
 * Actualizar precios de consulta por especialidad
 * 
 * Body:
 * {
 *   "prices": {
 *     "Cardiología": 50.00,
 *     "Medicina General": 30.00
 *   }
 * }
 */
export async function updateConsultationPrices(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] PUT /api/doctors/consultation-prices - Actualizando precios de consulta');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const userId = authResult.user.id;
    const body = JSON.parse(event.body || '{}');

    // Validar body
    if (!body.prices || typeof body.prices !== 'object') {
      return errorResponse('El campo "prices" es requerido y debe ser un objeto', 400);
    }

    // Obtener el provider del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!provider) {
      console.error(`❌ [DOCTORS] Provider no encontrado para usuario ${userId}`);
      return errorResponse('Provider no encontrado', 404);
    }

    // Obtener todas las especialidades del médico
    const doctorSpecialties = await prisma.provider_specialties.findMany({
      where: { provider_id: provider.id },
      include: {
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Crear un mapa de nombre -> specialty_id
    const specialtyMap = new Map<string, string>();
    doctorSpecialties.forEach((ps) => {
      specialtyMap.set(ps.specialties.name, ps.specialty_id);
    });

    // Validar precios y que las especialidades existan
    const updates: Array<{ specialtyId: string; price: number }> = [];
    
    for (const [specialtyName, price] of Object.entries(body.prices)) {
      // Validar precio
      if (typeof price !== 'number' || price < 0) {
        return errorResponse(`El precio de "${specialtyName}" debe ser un número mayor o igual a 0`, 400);
      }

      // Validar que la especialidad pertenezca al médico
      const specialtyId = specialtyMap.get(specialtyName);
      if (!specialtyId) {
        return errorResponse(`La especialidad "${specialtyName}" no pertenece al médico`, 400);
      }

      updates.push({ specialtyId, price });
    }

    // Actualizar precios (UPSERT)
    const updatePromises = updates.map(({ specialtyId, price }) => {
      return prisma.provider_specialties.update({
        where: {
          provider_id_specialty_id: {
            provider_id: provider.id,
            specialty_id: specialtyId,
          },
        },
        data: {
          fee: price,
          updated_at: new Date(),
        },
      });
    });

    await Promise.all(updatePromises);

    console.log(`✅ [DOCTORS] ${updates.length} precios actualizados correctamente`);
    
    return successResponse({
      success: true,
      message: 'Precios actualizados correctamente',
    });
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al actualizar precios de consulta:', error.message);
    logger.error('Error updating consultation prices', error);
    return internalErrorResponse('Failed to update consultation prices');
  }
}
