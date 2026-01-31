import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireAuth, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, createReviewSchema, extractIdFromPath } from '../shared/validators';

// GET /api/pharmacies/reviews/:branchId - Obtener reseñas de una sucursal (público para todos los roles)
export async function getBranchReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] GET /api/pharmacies/reviews/:branchId - Obteniendo reseñas de sucursal');
  
  const prisma = getPrismaClient();
  const path = event.rawPath || event.requestContext.http.path;
  
  try {
    // Extraer branchId de la URL
    let branchId: string | null = null;
    
    // Intentar extraer de la ruta /api/pharmacies/reviews/:branchId
    if (path.includes('/reviews/')) {
      branchId = extractIdFromPath(path, '/api/pharmacies/reviews/');
    } else {
      // Si no está en la ruta, buscar en query params
      branchId = event.queryStringParameters?.branch_id || event.queryStringParameters?.branchId || null;
    }

    if (!branchId) {
      console.error('❌ [PHARMACIES] Branch ID no proporcionado');
      return errorResponse('Branch ID is required', 400);
    }

    console.log('🔍 [PHARMACIES] Buscando reseñas para branch_id:', branchId);

    // Función para validar si es un UUID válido
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Obtener reseñas de la sucursal
    let reviews: any[] = [];
    if (isValidUUID(branchId)) {
      // Si es UUID válido, buscar en BD por branch_id
      reviews = await prisma.reviews.findMany({
        where: {
          branch_id: branchId,
        },
        include: {
          patients: {
            select: {
              id: true,
              full_name: true,
              users: {
                select: {
                  profile_picture_url: true,
                },
              },
            },
          },
          provider_branches: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    } else {
      // Si no es UUID válido (datos mock), buscar reseñas con branch_id: null
      // Esto permite que las reseñas creadas con IDs mock se muestren
      console.log('⚠️ [PHARMACIES] Branch ID no es UUID válido, buscando reseñas con branch_id: null');
      reviews = await prisma.reviews.findMany({
        where: {
          branch_id: null,
        },
        include: {
          patients: {
            select: {
              id: true,
              full_name: true,
              users: {
                select: {
                  profile_picture_url: true,
                },
              },
            },
          },
          provider_branches: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });
      console.log(`✅ [PHARMACIES] Encontradas ${reviews.length} reseñas con branch_id: null`);
    }

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

    console.log(`✅ [PHARMACIES] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`);
    return successResponse({
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment || null,
        createdAt: r.created_at,
        patient: r.patients ? {
          id: r.patients.id,
          fullName: r.patients.full_name,
          profilePictureUrl: r.patients.users?.profile_picture_url || null,
        } : null,
        branch: r.provider_branches ? {
          id: r.provider_branches.id,
          name: r.provider_branches.name,
        } : null,
      })),
      averageRating: Number(averageRating.toFixed(2)),
      totalReviews: reviews.length,
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al obtener reseñas:`, error.message);
    logger.error('Error getting branch reviews', error);
    return internalErrorResponse('Failed to get reviews');
  }
}

// GET /api/pharmacies/reviews - Listar reseñas (solo para providers)
export async function getReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] GET /api/pharmacies/reviews - Obteniendo reseñas');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] GET /api/pharmacies/reviews - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  try {
    // Buscar provider
    const provider = await prisma.providers.findFirst({
      where: { user_id: userId },
    });

    if (!provider) {
      console.log('⚠️ [PHARMACIES] Provider no encontrado, retornando array vacío de reseñas');
      return successResponse({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
      });
    }

    // Obtener reseñas de las sucursales del provider
    const reviews = await prisma.reviews.findMany({
      where: {
        provider_branches: {
          provider_id: provider.id,
        },
      },
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
            users: {
              select: {
                profile_picture_url: true,
              },
            },
          },
        },
        provider_branches: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

    console.log(`✅ [PHARMACIES] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`);
    return successResponse({
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment || null,
        createdAt: r.created_at,
        patient: r.patients ? {
          id: r.patients.id,
          fullName: r.patients.full_name,
          profilePictureUrl: r.patients.users?.profile_picture_url || null,
        } : null,
        branch: r.provider_branches ? {
          id: r.provider_branches.id,
          name: r.provider_branches.name,
        } : null,
      })),
      averageRating: Number(averageRating.toFixed(2)),
      totalReviews: reviews.length,
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al obtener reseñas:`, error.message);
    logger.error('Error getting reviews', error);
    return internalErrorResponse('Failed to get reviews');
  }
}

// POST /api/pharmacies/reviews - Crear reseña
export async function createReview(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] POST /api/pharmacies/reviews - Creando reseña');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] POST /api/pharmacies/reviews - Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Validar body
    console.log('📝 [PHARMACIES] Body recibido:', event.body);
    const body = parseBody(event.body, createReviewSchema);
    console.log('✅ [PHARMACIES] Body validado:', body);

    // Buscar paciente del usuario autenticado
    console.log('🔍 [PHARMACIES] Buscando paciente para user_id:', authContext.user.id);
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      console.error('❌ [PHARMACIES] Paciente no encontrado para user_id:', authContext.user.id);
      return errorResponse('Patient not found. Please complete your profile first.', 404);
    }
    console.log('✅ [PHARMACIES] Paciente encontrado:', patient.id);

    // Verificar que la sucursal existe
    console.log('🔍 [PHARMACIES] Verificando sucursal:', body.branch_id);
    
    // Función para validar si es un UUID válido
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Detectar modo desarrollo (siempre true en local.ts)
    const CLIENT_ID = process.env.COGNITO_USER_POOL_CLIENT_ID || '';
    const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
    const isLocalDev = !process.env.STAGE || process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !CLIENT_ID || !USER_POOL_ID;
    let branch = null;

    // Solo intentar buscar en BD si es un UUID válido
    if (isValidUUID(body.branch_id)) {
      try {
        branch = await prisma.provider_branches.findUnique({
          where: { id: body.branch_id },
        });
        if (branch) {
          console.log('✅ [PHARMACIES] Sucursal encontrada:', branch.name);
        } else {
          console.warn('⚠️ [PHARMACIES] Sucursal no encontrada en BD:', body.branch_id);
        }
      } catch (error: any) {
        console.warn('⚠️ [PHARMACIES] Error al buscar sucursal (continuando):', error.message);
      }
    } else {
      // No es un UUID válido, probablemente es un ID mock del frontend
      console.warn('⚠️ [PHARMACIES] Branch ID no es UUID válido:', body.branch_id);
      if (!isLocalDev) {
        console.error('❌ [PHARMACIES] Branch ID debe ser un UUID válido en producción');
        return errorResponse('Invalid branch ID format', 400);
      }
      console.log('✅ [PHARMACIES] Permitiendo en modo desarrollo (datos mock)');
    }

    // En producción, la sucursal debe existir
    if (!isLocalDev && !branch) {
      console.error('❌ [PHARMACIES] Sucursal no encontrada:', body.branch_id);
      return notFoundResponse('Branch not found');
    }

    // Verificar si ya existe una reseña del mismo paciente para esta sucursal
    // Solo verificar si branch_id es un UUID válido
    if (isValidUUID(body.branch_id)) {
      try {
        const existingReview = await prisma.reviews.findFirst({
          where: {
            patient_id: patient.id,
            branch_id: body.branch_id,
          },
        });

        if (existingReview) {
          console.error('❌ [PHARMACIES] Ya existe una reseña para esta sucursal');
          return errorResponse('Review already exists for this branch', 409);
        }
      } catch (error: any) {
        console.warn('⚠️ [PHARMACIES] Error al verificar reseña existente (continuando):', error.message);
      }
    }

    // Crear reseña
    // Si branch_id no es UUID válido, usar null en desarrollo (para datos mock)
    const branchIdForDB = isValidUUID(body.branch_id) ? body.branch_id : null;

    const review = await prisma.reviews.create({
      data: {
        id: randomUUID(),
        patient_id: patient.id,
        branch_id: branchIdForDB,
        rating: body.rating,
        comment: body.comment || null,
        appointment_id: body.appointment_id || null,
      },
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
            users: {
              select: {
                profile_picture_url: true,
              },
            },
          },
        },
        provider_branches: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`✅ [PHARMACIES] Reseña creada exitosamente: ${review.id}`);
    return successResponse({
      id: review.id,
      rating: review.rating,
      comment: review.comment || null,
      createdAt: review.created_at,
      patient: review.patients ? {
        id: review.patients.id,
        fullName: review.patients.full_name,
        profilePictureUrl: review.patients.users?.profile_picture_url || null,
      } : null,
      branch: review.provider_branches ? {
        id: review.provider_branches.id,
        name: review.provider_branches.name,
      } : null,
    }, 201);
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al crear reseña:`, error.message);
    logger.error('Error creating review', error);
    if (error.message.includes('Validation error')) return errorResponse(error.message, 400);
    return internalErrorResponse('Failed to create review');
  }
}
