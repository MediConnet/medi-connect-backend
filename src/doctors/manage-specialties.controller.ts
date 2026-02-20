import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, successResponse } from '../shared/response';

/**
 * POST /api/doctors/specialties
 * Agregar una especialidad con su tarifa
 */
export async function addSpecialty(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const body = JSON.parse(event.body || '{}');
    const { specialtyId, fee } = body;

    if (!specialtyId || fee === undefined) {
      return errorResponse('specialtyId y fee son requeridos', 400);
    }

    if (typeof fee !== 'number' || fee < 0) {
      return errorResponse('fee debe ser un número mayor o igual a 0', 400);
    }

    const prisma = getPrismaClient();

    // Obtener el provider del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id }
    });

    if (!provider) {
      return errorResponse('Perfil de doctor no encontrado', 404);
    }

    // Verificar que la especialidad existe
    const specialty = await prisma.specialties.findUnique({
      where: { id: specialtyId }
    });

    if (!specialty) {
      return errorResponse('Especialidad no encontrada', 404);
    }

    // Verificar si ya existe la relación
    const existing = await prisma.provider_specialties.findUnique({
      where: {
        provider_id_specialty_id: {
          provider_id: provider.id,
          specialty_id: specialtyId
        }
      }
    });

    if (existing) {
      return errorResponse('Esta especialidad ya está agregada', 409);
    }

    // Crear la relación
    const providerSpecialty = await prisma.provider_specialties.create({
      data: {
        provider_id: provider.id,
        specialty_id: specialtyId,
        fee: fee
      },
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
    });

    return successResponse({
      id: providerSpecialty.specialties.id,
      name: providerSpecialty.specialties.name,
      color_hex: providerSpecialty.specialties.color_hex,
      description: providerSpecialty.specialties.description,
      fee: parseFloat(providerSpecialty.fee.toString())
    });
  } catch (error: any) {
    console.error('Error adding specialty:', error);
    return errorResponse(error.message || 'Error al agregar especialidad', 500);
  }
}

/**
 * PUT /api/doctors/specialties/:specialtyId
 * Actualizar la tarifa de una especialidad
 */
export async function updateSpecialtyFee(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const path = event.requestContext.http.path;
    const specialtyId = path.split('/').pop();

    if (!specialtyId) {
      return errorResponse('ID de especialidad no proporcionado', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { fee } = body;

    if (fee === undefined) {
      return errorResponse('fee es requerido', 400);
    }

    if (typeof fee !== 'number' || fee < 0) {
      return errorResponse('fee debe ser un número mayor o igual a 0', 400);
    }

    const prisma = getPrismaClient();

    // Obtener el provider del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id }
    });

    if (!provider) {
      return errorResponse('Perfil de doctor no encontrado', 404);
    }

    // Verificar que existe la relación
    const existing = await prisma.provider_specialties.findUnique({
      where: {
        provider_id_specialty_id: {
          provider_id: provider.id,
          specialty_id: specialtyId
        }
      }
    });

    if (!existing) {
      return errorResponse('Especialidad no encontrada en tu perfil', 404);
    }

    // Actualizar la tarifa
    const updated = await prisma.provider_specialties.update({
      where: {
        provider_id_specialty_id: {
          provider_id: provider.id,
          specialty_id: specialtyId
        }
      },
      data: {
        fee: fee,
        updated_at: new Date()
      },
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
    });

    return successResponse({
      id: updated.specialties.id,
      name: updated.specialties.name,
      color_hex: updated.specialties.color_hex,
      description: updated.specialties.description,
      fee: parseFloat(updated.fee.toString())
    });
  } catch (error: any) {
    console.error('Error updating specialty fee:', error);
    return errorResponse(error.message || 'Error al actualizar tarifa', 500);
  }
}

/**
 * DELETE /api/doctors/specialties/:specialtyId
 * Eliminar una especialidad
 */
export async function removeSpecialty(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) return authResult;
    const authContext = authResult as AuthContext;

    const path = event.requestContext.http.path;
    const specialtyId = path.split('/').pop();

    if (!specialtyId) {
      return errorResponse('ID de especialidad no proporcionado', 400);
    }

    const prisma = getPrismaClient();

    // Obtener el provider del usuario
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id }
    });

    if (!provider) {
      return errorResponse('Perfil de doctor no encontrado', 404);
    }

    // Verificar que existe la relación
    const existing = await prisma.provider_specialties.findUnique({
      where: {
        provider_id_specialty_id: {
          provider_id: provider.id,
          specialty_id: specialtyId
        }
      }
    });

    if (!existing) {
      return errorResponse('Especialidad no encontrada en tu perfil', 404);
    }

    // Eliminar la relación
    await prisma.provider_specialties.delete({
      where: {
        provider_id_specialty_id: {
          provider_id: provider.id,
          specialty_id: specialtyId
        }
      }
    });

    return successResponse({ message: 'Especialidad eliminada exitosamente' });
  } catch (error: any) {
    console.error('Error removing specialty:', error);
    return errorResponse(error.message || 'Error al eliminar especialidad', 500);
  }
}
