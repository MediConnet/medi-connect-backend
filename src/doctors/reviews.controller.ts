import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { internalErrorResponse, successResponse } from '../shared/response';

/**
 * GET /api/doctors/reviews
 * Devuelve las reseñas que los pacientes han dejado al doctor autenticado.
 * Las reseñas están asociadas a la sucursal (branch) del provider del doctor.
 */
export async function getDoctorReviews(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/reviews - Obteniendo reseñas');

  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Obtener el provider del doctor autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      select: { id: true },
    });

    if (!provider) {
      return successResponse({ reviews: [], averageRating: 0, totalReviews: 0 });
    }

    // Obtener todas las sucursales del provider
    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: provider.id },
      select: { id: true },
    });

    const branchIds = branches.map((b) => b.id);

    if (branchIds.length === 0) {
      return successResponse({ reviews: [], averageRating: 0, totalReviews: 0 });
    }

    // Obtener reseñas de todas las sucursales del doctor
    const reviews = await prisma.reviews.findMany({
      where: { branch_id: { in: branchIds } },
      include: {
        patients: {
          select: {
            full_name: true,
            users: {
              select: { profile_picture_url: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? Number(
            (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(2),
          )
        : 0;

    const formatted = reviews.map((r) => ({
      id: r.id,
      rating: r.rating || 0,
      comment: r.comment || null,
      createdAt: r.created_at,
      userName: r.patients?.full_name || 'Paciente',
      profilePictureUrl: r.patients?.users?.profile_picture_url || null,
    }));

    console.log(`✅ [DOCTORS] ${totalReviews} reseñas encontradas para provider ${provider.id}`);

    return successResponse({ reviews: formatted, averageRating, totalReviews }, 200, event);
  } catch (error: any) {
    console.error('❌ [DOCTORS] Error al obtener reseñas:', error.message);
    return internalErrorResponse('Failed to get reviews');
  }
}
