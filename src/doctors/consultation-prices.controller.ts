import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, notFoundResponse, paginatedResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';

/**
 * GET /api/doctors/consultation-prices
 * Obtener tipos de consulta del médico con sus precios
 */
export async function getConsultationPrices(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/consultation-prices - Obteniendo tipos de consulta');
  
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

    // Paginación
    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;

    const whereClause = { 
      provider_id: provider.id,
      // No filtrar por is_active ya que ahora hacemos eliminación física
    };

    // Obtener tipos de consulta con sus precios
    const [consultationPrices, total] = await Promise.all([
      prisma.consultation_prices.findMany({
        where: whereClause,
        include: {
          specialties: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.consultation_prices.count({ where: whereClause }),
    ]);

    // Formatear respuesta
    const formattedPrices = consultationPrices.map((cp) => ({
      id: cp.id,
      consultationType: cp.consultation_type,
      price: parseFloat(cp.price.toString()),
      specialtyId: cp.specialty_id,
      specialtyName: cp.specialties?.name || null,
      description: cp.description,
      durationMinutes: cp.duration_minutes,
      isActive: cp.is_active ?? true,
      createdAt: cp.created_at.toISOString(),
      updatedAt: cp.updated_at.toISOString(),
    }));

    console.log(`✅ [DOCTORS] Retornando ${formattedPrices.length} tipos de consulta`);
    
    return paginatedResponse(formattedPrices, total, page, limit);
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al obtener tipos de consulta:', error.message);
    logger.error('Error getting consultation prices', error);
    return internalErrorResponse('Failed to get consultation prices');
  }
}

/**
 * POST /api/doctors/consultation-prices
 * Crear un nuevo tipo de consulta con su precio
 * 
 * Body:
 * {
 *   "consultationType": "Limpieza dental",
 *   "price": 30.00,
 *   "specialtyId": "uuid" (opcional),
 *   "description": "..." (opcional),
 *   "durationMinutes": 30 (opcional)
 * }
 */
export async function createConsultationPrice(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] POST /api/doctors/consultation-prices - Creando tipo de consulta');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const userId = authResult.user.id;
    const body = JSON.parse(event.body || '{}');

    // Validar body
    if (!body.consultationType || typeof body.consultationType !== 'string') {
      return errorResponse('El campo "consultationType" es requerido', 400);
    }

    if (!body.price || typeof body.price !== 'number' || body.price < 0) {
      return errorResponse('El campo "price" es requerido y debe ser un número mayor o igual a 0', 400);
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

    // Validar que la especialidad existe si se proporciona
    if (body.specialtyId) {
      const specialty = await prisma.specialties.findUnique({
        where: { id: body.specialtyId },
      });

      if (!specialty) {
        return errorResponse('Especialidad no encontrada', 404);
      }
    }

    // Crear tipo de consulta
    const consultationPrice = await prisma.consultation_prices.create({
      data: {
        provider_id: provider.id,
        consultation_type: body.consultationType,
        price: body.price,
        specialty_id: body.specialtyId || null,
        description: body.description || null,
        duration_minutes: body.durationMinutes || null,
        is_active: body.isActive !== undefined ? body.isActive : (body.is_active !== undefined ? body.is_active : true),
        updated_at: new Date(),
      },
      include: {
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`✅ [DOCTORS] Tipo de consulta creado: ${consultationPrice.id}`);
    
    return successResponse({
      id: consultationPrice.id,
      consultationType: consultationPrice.consultation_type,
      price: parseFloat(consultationPrice.price.toString()),
      specialtyId: consultationPrice.specialty_id,
      specialtyName: consultationPrice.specialties?.name || null,
      description: consultationPrice.description,
      durationMinutes: consultationPrice.duration_minutes,
      isActive: consultationPrice.is_active ?? true,
    });
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al crear tipo de consulta:', error.message);
    logger.error('Error creating consultation price', error);
    return internalErrorResponse('Failed to create consultation price');
  }
}

/**
 * PUT /api/doctors/consultation-prices/:id
 * Actualizar un tipo de consulta existente
 */
export async function updateConsultationPrice(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] PUT /api/doctors/consultation-prices/:id - Actualizando tipo de consulta');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const userId = authResult.user.id;
    const pathParts = event.requestContext.http.path.split('/');
    const consultationPriceId = pathParts[pathParts.length - 1];

    if (!consultationPriceId) {
      return errorResponse('ID de tipo de consulta no proporcionado', 400);
    }

    const body = JSON.parse(event.body || '{}');

    // Obtener el provider del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });

    if (!provider) {
      console.error(`❌ [DOCTORS] Provider no encontrado para usuario ${userId}`);
      return errorResponse('Provider no encontrado', 404);
    }

    // Verificar que el tipo de consulta pertenezca al médico
    const existingPrice = await prisma.consultation_prices.findFirst({
      where: {
        id: consultationPriceId,
        provider_id: provider.id,
      },
    });

    if (!existingPrice) {
      console.log(`⚠️ [DOCTORS] Tipo de consulta ${consultationPriceId} no encontrado o no pertenece al médico`);
      return notFoundResponse('Tipo de consulta no encontrado');
    }

    // Validar precio si se proporciona
    if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0)) {
      return errorResponse('El precio debe ser un número mayor o igual a 0', 400);
    }

    // Construir datos a actualizar
    const updateData: any = {
      updated_at: new Date(),
    };

    if (body.consultationType) updateData.consultation_type = body.consultationType;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.specialtyId !== undefined) updateData.specialty_id = body.specialtyId;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.durationMinutes !== undefined) updateData.duration_minutes = body.durationMinutes;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // Actualizar
    const updatedPrice = await prisma.consultation_prices.update({
      where: { id: consultationPriceId },
      data: updateData,
      include: {
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`✅ [DOCTORS] Tipo de consulta ${consultationPriceId} actualizado`);
    
    return successResponse({
      id: updatedPrice.id,
      consultationType: updatedPrice.consultation_type,
      price: parseFloat(updatedPrice.price.toString()),
      specialtyId: updatedPrice.specialty_id,
      specialtyName: updatedPrice.specialties?.name || null,
      description: updatedPrice.description,
      durationMinutes: updatedPrice.duration_minutes,
      isActive: updatedPrice.is_active ?? true,
    });
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al actualizar tipo de consulta:', error.message);
    logger.error('Error updating consultation price', error);
    return internalErrorResponse('Failed to update consultation price');
  }
}

/**
 * DELETE /api/doctors/consultation-prices/:id
 * Eliminar un tipo de consulta PERMANENTEMENTE de la base de datos
 */
export async function deleteConsultationPrice(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🗑️ [DOCTORS] DELETE /api/doctors/consultation-prices/:id - Eliminando tipo de consulta');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const userId = authResult.user.id;
    const pathParts = event.requestContext.http.path.split('/');
    const consultationPriceId = pathParts[pathParts.length - 1];

    console.log(`🔍 [DOCTORS] ID recibido: ${consultationPriceId}`);
    console.log(`🔍 [DOCTORS] User ID: ${userId}`);

    if (!consultationPriceId) {
      console.error('❌ [DOCTORS] ID de tipo de consulta no proporcionado');
      return errorResponse('ID de tipo de consulta no proporcionado', 400);
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

    console.log(`🔍 [DOCTORS] Provider ID: ${provider.id}`);

    // Verificar que el tipo de consulta pertenezca al médico
    const existingPrice = await prisma.consultation_prices.findFirst({
      where: {
        id: consultationPriceId,
        provider_id: provider.id,
      },
    });

    if (!existingPrice) {
      console.log(`⚠️ [DOCTORS] Tipo de consulta ${consultationPriceId} no encontrado o no pertenece al médico`);
      return notFoundResponse('Tipo de consulta no encontrado');
    }

    console.log(`✅ [DOCTORS] Tipo de consulta encontrado: ${existingPrice.consultation_type}`);

    // HARD DELETE: Eliminar permanentemente de la base de datos
    await prisma.consultation_prices.delete({
      where: { id: consultationPriceId },
    });

    console.log(`✅ [DOCTORS] Tipo de consulta ${consultationPriceId} eliminado PERMANENTEMENTE de la base de datos`);
    
    // Verificar que se eliminó
    const stillExists = await prisma.consultation_prices.findUnique({
      where: { id: consultationPriceId },
    });

    if (stillExists) {
      console.error(`❌ [DOCTORS] ERROR: El tipo de consulta AÚN EXISTE en la base de datos`);
      return internalErrorResponse('Error: El tipo de consulta no pudo ser eliminado');
    }

    console.log(`✅ [DOCTORS] Verificado: El tipo de consulta ya no existe en la base de datos`);
    
    return successResponse({
      success: true,
      message: 'Tipo de consulta eliminado correctamente',
    });
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al eliminar tipo de consulta:', error.message);
    console.error('❌ [DOCTORS] Stack:', error.stack);
    logger.error('Error deleting consultation price', error);
    return internalErrorResponse('Failed to delete consultation price');
  }
}
