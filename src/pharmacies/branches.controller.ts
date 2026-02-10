import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, extractIdFromPath } from '../shared/validators';
import { z } from 'zod';

// Schemas de validación
const createBranchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  openingHours: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  hasHomeDelivery: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  openingHours: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  hasHomeDelivery: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/pharmacies/branches - Listar sucursales
export async function getBranches(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] GET /api/pharmacies/branches - Obteniendo sucursales');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] GET /api/pharmacies/branches - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar provider del usuario autenticado (tipo pharmacy, más reciente)
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        verification_status: { in: ['APPROVED', 'PENDING'] },
        service_categories: {
          slug: "pharmacy",
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    if (!provider) {
      console.log('⚠️ [PHARMACIES] Provider no encontrado, retornando array vacío de sucursales');
      return successResponse([]);
    }

    // Obtener todas las sucursales del provider (incluyendo la principal)
    const branches = await prisma.provider_branches.findMany({
      where: {
        provider_id: provider.id,
      },
      orderBy: {
        is_main: 'desc', // Principal primero
        name: 'asc',
      },
    });

    console.log(`✅ [PHARMACIES] Sucursales obtenidas exitosamente (${branches.length} sucursales)`);

    // Mapear al formato esperado por el frontend
    const formattedBranches = branches.map(branch => ({
      id: branch.id,
      name: branch.name || '',
      address: branch.address_text || '',
      openingHours: branch.opening_hours_text || '',
      phone: branch.phone_contact || '',
      whatsapp: branch.phone_contact || '', // Usar phone_contact como whatsapp también
      hasHomeDelivery: branch.has_delivery ?? false,
      isActive: branch.is_active ?? false,
    }));

    return successResponse(formattedBranches);
  } catch (error: any) {
    console.error('❌ [PHARMACIES] Error al obtener sucursales:', error.message);
    logger.error('Error getting branches', error);
    return internalErrorResponse('Error al obtener sucursales');
  }
}

// POST /api/pharmacies/branches - Crear sucursal
export async function createBranch(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] POST /api/pharmacies/branches - Creando sucursal');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] POST /api/pharmacies/branches - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body || null, createBranchSchema);

    // Buscar provider del usuario autenticado (tipo pharmacy, más reciente)
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        verification_status: { in: ['APPROVED', 'PENDING'] },
        service_categories: {
          slug: "pharmacy",
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    if (!provider) {
      return notFoundResponse('Pharmacy provider not found');
    }

    // Crear nueva sucursal
    const newBranch = await prisma.provider_branches.create({
      data: {
        id: randomUUID(),
        provider_id: provider.id,
        name: body.name,
        address_text: body.address || null,
        opening_hours_text: body.openingHours || null,
        phone_contact: body.phone || body.whatsapp || null,
        has_delivery: body.hasHomeDelivery ?? false,
        is_active: body.isActive ?? true,
        is_main: false, // Las nuevas sucursales no son principales por defecto
      },
    });

    console.log(`✅ [PHARMACIES] Sucursal creada exitosamente: ${newBranch.id}`);

    // Retornar en el formato esperado
    return successResponse({
      id: newBranch.id,
      name: newBranch.name || '',
      address: newBranch.address_text || '',
      openingHours: newBranch.opening_hours_text || '',
      phone: newBranch.phone_contact || '',
      whatsapp: newBranch.phone_contact || '',
      hasHomeDelivery: newBranch.has_delivery ?? false,
      isActive: newBranch.is_active ?? false,
    });
  } catch (error: any) {
    console.error('❌ [PHARMACIES] Error al crear sucursal:', error.message);
    logger.error('Error creating branch', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Error al crear sucursal');
  }
}

// PUT /api/pharmacies/branches/:id - Actualizar sucursal
export async function updateBranch(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] PUT /api/pharmacies/branches/:id - Actualizando sucursal');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] PUT /api/pharmacies/branches/:id - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const branchId = extractIdFromPath(event.requestContext.http.path, '/api/pharmacies/branches/');
    if (!branchId) {
      return errorResponse('Branch ID is required', 400);
    }

    const body = parseBody(event.body || null, updateBranchSchema);

    // Buscar provider del usuario autenticado (tipo pharmacy, más reciente)
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        verification_status: { in: ['APPROVED', 'PENDING'] },
        service_categories: {
          slug: "pharmacy",
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    if (!provider) {
      return notFoundResponse('Pharmacy provider not found');
    }

    // Verificar que la sucursal pertenece al provider
    const existingBranch = await prisma.provider_branches.findFirst({
      where: {
        id: branchId,
        provider_id: provider.id,
      },
    });

    if (!existingBranch) {
      return notFoundResponse('Branch not found');
    }

    // Actualizar sucursal
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.address !== undefined) updateData.address_text = body.address;
    if (body.openingHours !== undefined) updateData.opening_hours_text = body.openingHours;
    if (body.phone !== undefined || body.whatsapp !== undefined) {
      updateData.phone_contact = body.whatsapp || body.phone || existingBranch.phone_contact;
    }
    if (body.hasHomeDelivery !== undefined) updateData.has_delivery = body.hasHomeDelivery;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    const updatedBranch = await prisma.provider_branches.update({
      where: { id: branchId },
      data: updateData,
    });

    console.log(`✅ [PHARMACIES] Sucursal actualizada exitosamente: ${updatedBranch.id}`);

    // Retornar en el formato esperado
    return successResponse({
      id: updatedBranch.id,
      name: updatedBranch.name || '',
      address: updatedBranch.address_text || '',
      openingHours: updatedBranch.opening_hours_text || '',
      phone: updatedBranch.phone_contact || '',
      whatsapp: updatedBranch.phone_contact || '',
      hasHomeDelivery: updatedBranch.has_delivery ?? false,
      isActive: updatedBranch.is_active ?? false,
    });
  } catch (error: any) {
    console.error('❌ [PHARMACIES] Error al actualizar sucursal:', error.message);
    logger.error('Error updating branch', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Error al actualizar sucursal');
  }
}

// DELETE /api/pharmacies/branches/:id - Eliminar sucursal
export async function deleteBranch(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] DELETE /api/pharmacies/branches/:id - Eliminando sucursal');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] DELETE /api/pharmacies/branches/:id - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const branchId = extractIdFromPath(event.requestContext.http.path, '/api/pharmacies/branches/');
    if (!branchId) {
      return errorResponse('Branch ID is required', 400);
    }

    // Buscar provider del usuario autenticado (tipo pharmacy, más reciente)
    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        verification_status: { in: ['APPROVED', 'PENDING'] },
        service_categories: {
          slug: "pharmacy",
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    if (!provider) {
      return notFoundResponse('Pharmacy provider not found');
    }

    // Verificar que la sucursal pertenece al provider
    const existingBranch = await prisma.provider_branches.findFirst({
      where: {
        id: branchId,
        provider_id: provider.id,
      },
    });

    if (!existingBranch) {
      return notFoundResponse('Branch not found');
    }

    // No permitir eliminar la sucursal principal
    if (existingBranch.is_main) {
      return errorResponse('Cannot delete main branch', 400);
    }

    // Eliminar sucursal
    await prisma.provider_branches.delete({
      where: { id: branchId },
    });

    console.log(`✅ [PHARMACIES] Sucursal eliminada exitosamente: ${branchId}`);

    return successResponse({ success: true });
  } catch (error: any) {
    console.error('❌ [PHARMACIES] Error al eliminar sucursal:', error.message);
    logger.error('Error deleting branch', error);
    return internalErrorResponse('Error al eliminar sucursal');
  }
}
