import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { AuthContext, requireAuth } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { parseBody, createDoctorReviewSchema } from '../shared/validators';

/**
 * Obtener reseñas de un doctor (público)
 * GET /api/public/doctors/{doctorId}/reviews
 */
export async function getDoctorReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC DOCTORS] GET /api/public/doctors/{id}/reviews - Obteniendo reseñas de doctor');
  
  const prisma = getPrismaClient();
  const path = event.rawPath || event.requestContext.http.path;
  
  try {
    // Extraer doctorId de la URL: /api/public/doctors/{doctorId}/reviews
    const pathParts = path.split('/');
    const doctorIdIndex = pathParts.indexOf('doctors') + 1;
    const doctorId = doctorIdIndex > 0 && doctorIdIndex < pathParts.length ? pathParts[doctorIdIndex] : null;
    
    if (!doctorId || doctorId === 'reviews') {
      console.error('❌ [PUBLIC DOCTORS] Doctor ID no proporcionado');
      return errorResponse('Doctor ID is required', 400, undefined, event);
    }

    console.log('🔍 [PUBLIC DOCTORS] Buscando doctor:', doctorId);

    // Buscar el doctor y obtener su branch principal
    const doctor = await prisma.providers.findFirst({
      where: {
        id: doctorId,
        verification_status: 'APPROVED',
        category_id: 1, // Solo médicos
        users: {
          is_active: true,
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
      },
      include: {
        provider_branches: {
          where: {
            is_main: true,
            is_active: true,
          },
          take: 1,
        },
      },
    });

    if (!doctor) {
      console.error('❌ [PUBLIC DOCTORS] Doctor no encontrado:', doctorId);
      return errorResponse('Doctor not found', 404, undefined, event);
    }

    const mainBranch = doctor.provider_branches[0];
    
    if (!mainBranch) {
      console.warn('⚠️ [PUBLIC DOCTORS] Doctor no tiene branch principal activa');
      return successResponse({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
      }, 200, event);
    }

    console.log('🔍 [PUBLIC DOCTORS] Buscando reseñas para branch_id:', mainBranch.id);

    // Obtener reseñas de la branch principal del doctor
    const reviews = await prisma.reviews.findMany({
      where: {
        branch_id: mainBranch.id,
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

    // Calcular promedio de calificaciones
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

    console.log(`✅ [PUBLIC DOCTORS] Reseñas obtenidas exitosamente (${reviews.length} reseñas)`);
    
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
      })),
      averageRating: Number(averageRating.toFixed(2)),
      totalReviews: reviews.length,
    }, 200, event);
  } catch (error: any) {
    console.error(`❌ [PUBLIC DOCTORS] Error al obtener reseñas:`, error.message);
    logger.error('Error getting doctor reviews', error);
    return internalErrorResponse('Failed to get reviews', event);
  }
}

/**
 * Crear reseña de un doctor (requiere autenticación)
 * POST /api/public/doctors/{doctorId}/reviews
 */
export async function createDoctorReview(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC DOCTORS] POST /api/public/doctors/{id}/reviews - Creando reseña de doctor');
  
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    console.error('❌ [PUBLIC DOCTORS] POST /api/public/doctors/{id}/reviews - Error de autenticación');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const path = event.rawPath || event.requestContext.http.path;

  try {
    // Extraer doctorId de la URL
    const pathParts = path.split('/');
    const doctorIdIndex = pathParts.indexOf('doctors') + 1;
    const doctorId = doctorIdIndex > 0 && doctorIdIndex < pathParts.length ? pathParts[doctorIdIndex] : null;
    
    if (!doctorId || doctorId === 'reviews') {
      console.error('❌ [PUBLIC DOCTORS] Doctor ID no proporcionado');
      return errorResponse('Doctor ID is required', 400, undefined, event);
    }

    // Validar body
    console.log('📝 [PUBLIC DOCTORS] Body recibido:', event.body);
    const body = parseBody(event.body, createDoctorReviewSchema);
    console.log('✅ [PUBLIC DOCTORS] Body validado:', body);

    // Buscar paciente del usuario autenticado
    console.log('🔍 [PUBLIC DOCTORS] Buscando paciente para user_id:', authContext.user.id);
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      console.error('❌ [PUBLIC DOCTORS] Paciente no encontrado para user_id:', authContext.user.id);
      return errorResponse('Patient not found. Please complete your profile first.', 404, undefined, event);
    }
    console.log('✅ [PUBLIC DOCTORS] Paciente encontrado:', patient.id);

    // Buscar el doctor y obtener su branch principal
    console.log('🔍 [PUBLIC DOCTORS] Verificando doctor:', doctorId);
    const doctor = await prisma.providers.findFirst({
      where: {
        id: doctorId,
        verification_status: 'APPROVED',
        category_id: 1, // Solo médicos
        users: {
          is_active: true,
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
      },
      include: {
        provider_branches: {
          where: {
            is_main: true,
            is_active: true,
          },
          take: 1,
        },
      },
    });

    if (!doctor) {
      console.error('❌ [PUBLIC DOCTORS] Doctor no encontrado:', doctorId);
      return errorResponse('Doctor not found', 404, undefined, event);
    }

    const mainBranch = doctor.provider_branches[0];
    
    if (!mainBranch) {
      console.error('❌ [PUBLIC DOCTORS] Doctor no tiene branch principal activa');
      return errorResponse('Doctor branch not found', 404, undefined, event);
    }

    console.log('✅ [PUBLIC DOCTORS] Branch principal encontrada:', mainBranch.id);

    // Permitir múltiples reseñas del mismo paciente para el mismo doctor
    // (No hay restricción de múltiples reseñas)

    // Crear reseña
    const review = await prisma.reviews.create({
      data: {
        id: randomUUID(),
        patient_id: patient.id,
        branch_id: mainBranch.id,
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

    // Opcional: Actualizar rating_cache en la branch principal
    // Calcular nuevo promedio
    const allReviews = await prisma.reviews.findMany({
      where: { branch_id: mainBranch.id },
      select: { rating: true },
    });
    
    if (allReviews.length > 0) {
      const newAverage = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / allReviews.length;
      await prisma.provider_branches.update({
        where: { id: mainBranch.id },
        data: { rating_cache: newAverage },
      });
      console.log(`✅ [PUBLIC DOCTORS] Rating cache actualizado: ${newAverage.toFixed(2)}`);
    }

    console.log(`✅ [PUBLIC DOCTORS] Reseña creada exitosamente: ${review.id}`);
    
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
    }, 201, event);
  } catch (error: any) {
    console.error(`❌ [PUBLIC DOCTORS] Error al crear reseña:`, error.message);
    logger.error('Error creating doctor review', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400, undefined, event);
    }
    return internalErrorResponse('Failed to create review', event);
  }
}

