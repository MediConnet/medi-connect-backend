import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, createPharmacyChainSchema, updatePharmacyChainSchema } from '../shared/validators';
import { randomUUID } from 'crypto';

// Helper para extraer ID de la ruta
function extractIdFromPath(path: string, prefix: string): string | null {
  const id = path.replace(prefix, '').split('/')[0];
  return id && id.length > 0 ? id : null;
}

// GET /api/admin/pharmacy-chains - Listar todas las cadenas (solo admin)
export async function getPharmacyChains(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] GET /api/admin/pharmacy-chains - Obteniendo cadenas de farmacias');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [ADMIN] GET /api/admin/pharmacy-chains - Error de autenticación/autorización');
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const chains = await prisma.pharmacy_chains.findMany({
      orderBy: { created_at: 'desc' },
    });

    const chainsData = chains.map((chain) => ({
      id: chain.id,
      name: chain.name,
      logoUrl: chain.logo_url || null,
      description: chain.description || null,
      createdAt: chain.created_at?.toISOString() || null,
      updatedAt: chain.updated_at?.toISOString() || null,
      isActive: chain.is_active ?? true,
    }));

    console.log(`✅ [ADMIN] Retornando ${chainsData.length} cadenas`);
    return successResponse(chainsData);
  } catch (error: any) {
    console.error(`❌ [ADMIN] Error al obtener cadenas:`, error.message);
    logger.error('Error getting pharmacy chains', error);
    return internalErrorResponse('Failed to get pharmacy chains');
  }
}

// POST /api/admin/pharmacy-chains - Crear nueva cadena (solo admin)
export async function createPharmacyChain(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] POST /api/admin/pharmacy-chains - Creando cadena de farmacias');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [ADMIN] POST /api/admin/pharmacy-chains - Error de autenticación/autorización');
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, createPharmacyChainSchema);

    // Verificar que el nombre sea único
    const existingChain = await prisma.pharmacy_chains.findFirst({
      where: { name: body.name },
    });

    if (existingChain) {
      return errorResponse('A pharmacy chain with this name already exists', 400);
    }

    const chain = await prisma.pharmacy_chains.create({
      data: {
        id: randomUUID(),
        name: body.name,
        logo_url: body.logoUrl || null,
        description: body.description || null,
        is_active: body.isActive ?? true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log(`✅ [ADMIN] Cadena creada: ${chain.name}`);
    return successResponse(
      {
        id: chain.id,
        name: chain.name,
        logoUrl: chain.logo_url || null,
        description: chain.description || null,
        createdAt: chain.created_at?.toISOString() || null,
        updatedAt: chain.updated_at?.toISOString() || null,
        isActive: chain.is_active ?? true,
      },
      201
    );
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      return errorResponse(error.message, 400);
    }
    console.error(`❌ [ADMIN] Error al crear cadena:`, error.message);
    logger.error('Error creating pharmacy chain', error);
    return internalErrorResponse('Failed to create pharmacy chain');
  }
}

// PUT /api/admin/pharmacy-chains/:id - Actualizar cadena (solo admin)
export async function updatePharmacyChain(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] PUT /api/admin/pharmacy-chains/:id - Actualizando cadena de farmacias');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [ADMIN] PUT /api/admin/pharmacy-chains/:id - Error de autenticación/autorización');
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const chainId = extractIdFromPath(event.requestContext.http.path, '/api/admin/pharmacy-chains/');
    if (!chainId) {
      return errorResponse('Chain ID is required', 400);
    }

    const body = parseBody(event.body, updatePharmacyChainSchema);

    // Verificar que la cadena exista
    const existingChain = await prisma.pharmacy_chains.findUnique({
      where: { id: chainId },
    });

    if (!existingChain) {
      return notFoundResponse('Pharmacy chain not found');
    }

    // Si se actualiza el nombre, verificar que sea único
    if (body.name && body.name !== existingChain.name) {
      const nameExists = await prisma.pharmacy_chains.findFirst({
        where: { name: body.name },
      });

      if (nameExists) {
        return errorResponse('A pharmacy chain with this name already exists', 400);
      }
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    // Detectar qué campos se están actualizando
    let nameUpdated = false;
    let logoUpdated = false;
    let descriptionUpdated = false;

    if (body.name !== undefined && body.name !== existingChain.name) {
      updateData.name = body.name;
      nameUpdated = true;
    }
    if (body.logoUrl !== undefined && body.logoUrl !== existingChain.logo_url) {
      updateData.logo_url = body.logoUrl;
      logoUpdated = true;
    }
    if (body.description !== undefined && body.description !== existingChain.description) {
      updateData.description = body.description;
      descriptionUpdated = true;
    }
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    // Actualizar la cadena
    const chain = await prisma.pharmacy_chains.update({
      where: { id: chainId },
      data: updateData,
    });

    // ⭐ ACTUALIZACIÓN EN CASCADA: Actualizar todas las farmacias asociadas
    if (nameUpdated || logoUpdated || descriptionUpdated) {
      console.log(`🔄 [ADMIN] Actualizando farmacias asociadas a la cadena: ${chain.name}`);
      
      const cascadeUpdateData: any = {};
      if (nameUpdated) {
        cascadeUpdateData.commercial_name = chain.name; // ⭐ Actualizar nombre
      }
      if (logoUpdated) {
        cascadeUpdateData.logo_url = chain.logo_url; // ⭐ Actualizar logo
      }
      if (descriptionUpdated) {
        cascadeUpdateData.description = chain.description; // ⭐ Actualizar descripción
      }

      if (Object.keys(cascadeUpdateData).length > 0) {
        const updatedCount = await prisma.providers.updateMany({
          where: {
            chain_id: chainId,
            verification_status: { in: ['APPROVED', 'PENDING'] }, // Solo aprobadas o pendientes
          },
          data: cascadeUpdateData,
        });
        console.log(`✅ [ADMIN] ${updatedCount.count} farmacias actualizadas en cascada`);
      }
    }

    console.log(`✅ [ADMIN] Cadena actualizada: ${chain.name}`);
    return successResponse({
      id: chain.id,
      name: chain.name,
      logoUrl: chain.logo_url || null,
      description: chain.description || null,
      createdAt: chain.created_at?.toISOString() || null,
      updatedAt: chain.updated_at?.toISOString() || null,
      isActive: chain.is_active ?? true,
    });
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      return errorResponse(error.message, 400);
    }
    console.error(`❌ [ADMIN] Error al actualizar cadena:`, error.message);
    logger.error('Error updating pharmacy chain', error);
    return internalErrorResponse('Failed to update pharmacy chain');
  }
}

// DELETE /api/admin/pharmacy-chains/:id - Eliminar cadena (solo admin)
export async function deletePharmacyChain(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [ADMIN] DELETE /api/admin/pharmacy-chains/:id - Eliminando cadena de farmacias');
  
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [ADMIN] DELETE /api/admin/pharmacy-chains/:id - Error de autenticación/autorización');
    return authResult;
  }

  const prisma = getPrismaClient();

  try {
    const chainId = extractIdFromPath(event.requestContext.http.path, '/api/admin/pharmacy-chains/');
    if (!chainId) {
      return errorResponse('Chain ID is required', 400);
    }

    // Verificar que la cadena exista
    const existingChain = await prisma.pharmacy_chains.findUnique({
      where: { id: chainId },
      include: {
        providers: {
          where: { chain_id: chainId },
          take: 1, // Solo necesitamos saber si hay al menos una
        },
      },
    });

    if (!existingChain) {
      return notFoundResponse('Pharmacy chain not found');
    }

    // Validar que no haya farmacias asociadas
    if (existingChain.providers && existingChain.providers.length > 0) {
      return errorResponse('No se puede eliminar la cadena porque tiene farmacias asociadas', 400);
    }

    await prisma.pharmacy_chains.delete({
      where: { id: chainId },
    });

    console.log(`✅ [ADMIN] Cadena eliminada: ${chainId}`);
    return successResponse({ success: true, message: 'Cadena eliminada correctamente' });
  } catch (error: any) {
    console.error(`❌ [ADMIN] Error al eliminar cadena:`, error.message);
    logger.error('Error deleting pharmacy chain', error);
    return internalErrorResponse('Failed to delete pharmacy chain');
  }
}

// GET /api/pharmacy-chains - Listar solo cadenas activas (público)
export async function getActivePharmacyChains(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC] GET /api/pharmacy-chains - Obteniendo cadenas activas');
  
  const prisma = getPrismaClient();

  try {
    const chains = await prisma.pharmacy_chains.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });

    const chainsData = chains.map((chain) => ({
      id: chain.id,
      name: chain.name,
      logoUrl: chain.logo_url || null,
      description: chain.description || null,
      createdAt: chain.created_at?.toISOString() || null,
      updatedAt: chain.updated_at?.toISOString() || null,
      isActive: chain.is_active ?? true,
    }));

    console.log(`✅ [PUBLIC] Retornando ${chainsData.length} cadenas activas`);
    return successResponse(chainsData);
  } catch (error: any) {
    console.error(`❌ [PUBLIC] Error al obtener cadenas activas:`, error.message);
    logger.error('Error getting active pharmacy chains', error);
    return internalErrorResponse('Failed to get active pharmacy chains');
  }
}
