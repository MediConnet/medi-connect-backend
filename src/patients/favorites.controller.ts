import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { AuthContext, requireAuth } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, extractIdFromPath } from '../shared/validators';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const addFavoriteSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID'),
});

// --- GET FAVORITES ---
export async function getFavorites(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] GET /api/patients/favorites - Obteniendo favoritos');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      console.log('⚠️ [PATIENTS] Paciente no encontrado, retornando array vacío');
      return successResponse([]);
    }

    // Obtener favoritos
    const favorites = await prisma.patient_favorites.findMany({
      where: { patient_id: patient.id },
      include: {
        provider_branches: {
          include: {
            providers: {
              select: {
                id: true,
                commercial_name: true,
                logo_url: true,
                service_categories: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
            cities: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log(`✅ [PATIENTS] Se encontraron ${favorites.length} favoritos`);
    return successResponse(
      favorites.map(fav => ({
        id: fav.id,
        branch: fav.provider_branches ? {
          id: fav.provider_branches.id,
          name: fav.provider_branches.name,
          address: fav.provider_branches.address_text,
          phone: fav.provider_branches.phone_contact,
          provider: fav.provider_branches.providers ? {
            id: fav.provider_branches.providers.id,
            name: fav.provider_branches.providers.commercial_name,
            logoUrl: fav.provider_branches.providers.logo_url,
            category: fav.provider_branches.providers.service_categories?.name || null,
          } : null,
          city: fav.provider_branches.cities?.name || null,
        } : null,
        createdAt: fav.created_at,
      }))
    );
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al obtener favoritos:', error.message);
    logger.error('Error getting favorites', error);
    return internalErrorResponse('Failed to get favorites');
  }
}

// --- ADD FAVORITE ---
export async function addFavorite(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] POST /api/patients/favorites - Agregando favorito');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, addFavoriteSchema);

    // Buscar el paciente
    let patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      // Crear paciente si no existe
      patient = await prisma.patients.create({
        data: {
          id: randomUUID(),
          user_id: authContext.user.id,
          full_name: authContext.user.email.split('@')[0],
        },
      });
    }

    // Verificar que la sucursal existe
    const branch = await prisma.provider_branches.findUnique({
      where: { id: body.branchId },
    });

    if (!branch) {
      return notFoundResponse('Branch not found');
    }

    // Verificar que no esté ya en favoritos
    const existingFavorite = await prisma.patient_favorites.findFirst({
      where: {
        patient_id: patient.id,
        branch_id: body.branchId,
      },
    });

    if (existingFavorite) {
      return errorResponse('Branch is already in favorites', 409);
    }

    // Crear favorito
    const favorite = await prisma.patient_favorites.create({
      data: {
        id: randomUUID(),
        patient_id: patient.id,
        branch_id: body.branchId,
      },
      include: {
        provider_branches: {
          include: {
            providers: {
              select: {
                id: true,
                commercial_name: true,
                logo_url: true,
              },
            },
          },
        },
      },
    });

    console.log('✅ [PATIENTS] Favorito agregado exitosamente');
    return successResponse({
      id: favorite.id,
      branchId: favorite.branch_id,
      message: 'Favorite added successfully',
    }, 201);
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al agregar favorito:', error.message);
    logger.error('Error adding favorite', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to add favorite');
  }
}

// --- REMOVE FAVORITE ---
export async function removeFavorite(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PATIENTS] DELETE /api/patients/favorites/:id - Eliminando favorito');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const favoriteId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/patients/favorites/',
      ''
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return notFoundResponse('Patient not found');
    }

    // Buscar el favorito
    const favorite = await prisma.patient_favorites.findUnique({
      where: { id: favoriteId },
    });

    if (!favorite) {
      return notFoundResponse('Favorite not found');
    }

    // Verificar que el favorito pertenece al paciente
    if (favorite.patient_id !== patient.id) {
      return errorResponse('Access denied', 403);
    }

    // Eliminar favorito
    await prisma.patient_favorites.delete({
      where: { id: favoriteId },
    });

    console.log('✅ [PATIENTS] Favorito eliminado exitosamente');
    return successResponse({
      message: 'Favorite removed successfully',
    });
  } catch (error: any) {
    console.error('❌ [PATIENTS] Error al eliminar favorito:', error.message);
    logger.error('Error removing favorite', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid favorite ID', 400);
    }
    return internalErrorResponse('Failed to remove favorite');
  }
}
