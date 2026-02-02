import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { enum_roles } from '../generated/prisma/client';
import { requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse, unauthorizedResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';

// Schema para crear reseña
const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000).optional(),
});

// --- HELPER: Formateo de Horarios ---
// Recibe un objeto Date (ej: 1970-01-01T09:00:00.000Z) y devuelve "09:00"
function formatTime(date: Date): string {
  if (!date) return '';
  return date.toISOString().substring(11, 16);
}

// Calcula el resumen del horario para mostrar en tarjetas
function calculateScheduleSummary(schedules: any[]): string {
  if (!schedules || schedules.length === 0) return 'Horario no disponible';

  const activeSchedules = schedules.filter(s => s.is_active);
  if (activeSchedules.length === 0) return 'Cerrado temporalmente';

  const daysMap = new Map<number, { start: string, end: string }>();
  
  activeSchedules.forEach(s => {
    if (s.start_time && s.end_time && s.day_of_week !== null) {
      daysMap.set(s.day_of_week, { 
        start: formatTime(s.start_time), 
        end: formatTime(s.end_time) 
      });
    }
  });

  const weekDays = [1, 2, 3, 4, 5];
  const firstDay = daysMap.get(1); 
  
  if (firstDay) {
    const isMonToFriSame = weekDays.every(d => {
      const day = daysMap.get(d);
      return day && day.start === firstDay.start && day.end === firstDay.end;
    });

    if (isMonToFriSame) {
      const sat = daysMap.get(6);
      if (sat && sat.start === firstDay.start && sat.end === firstDay.end) {
        return `Lun - Sáb: ${firstDay.start} - ${firstDay.end}`;
      }
      return `Lun - Vie: ${firstDay.start} - ${firstDay.end}`;
    }
  }

  const todayDate = new Date();
  let todayIndex = todayDate.getDay(); 
  const dbDay = todayIndex === 0 ? 7 : todayIndex;
  
  const todaySchedule = daysMap.get(dbDay);
  if (todaySchedule) {
    return `Hoy: ${todaySchedule.start} - ${todaySchedule.end}`;
  }

  return 'Horarios Variados';
}

// --- CONTROLLERS ---

// GET /api/supplies
export async function getSupplies(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies - Obteniendo lista de tiendas');
  
  const prisma = getPrismaClient();
  
  try {
    const suppliesCategory = await prisma.service_categories.findFirst({
      where: {
        OR: [
          { slug: 'supplies' },
          { slug: 'insumos' },
          { name: { contains: 'insumo', mode: 'insensitive' } },
        ],
      },
    });

    if (!suppliesCategory) {
      return successResponse([]);
    }

    const providers = await prisma.providers.findMany({
      where: {
        category_id: suppliesCategory.id,
        verification_status: 'APPROVED',
      },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1, 
          include: {
            provider_schedules: true 
          }
        },
        provider_catalog: {
          where: { is_available: true },
          take: 10,
        },
      },
      take: 50,
    });

    const supplies = providers.map(provider => {
      const branch = provider.provider_branches[0];
      
      const horarioTexto = branch 
        ? calculateScheduleSummary(branch.provider_schedules) 
        : 'Horario no disponible';

      return {
        id: provider.id,
        name: provider.commercial_name || 'Tienda de Insumos',
        description: provider.description || null,
        address: branch?.address_text || null, // 
        phone: branch?.phone_contact || null,
        rating: Number(branch?.rating_cache || 0),
        imageUrl: branch?.image_url || provider.logo_url || null,
        horarioAtencion: horarioTexto, // 
        products: provider.provider_catalog.map(prod => ({
            id: prod.id,
            name: prod.name,
            price: Number(prod.price),
            imageUrl: prod.image_url,
            description: prod.description
        }))
      };
    });

    return successResponse(supplies);
  } catch (error: any) {
    console.error(`❌ [SUPPLIES] Error al obtener tiendas:`, error.message);
    logger.error('Error getting supplies', error);
    return internalErrorResponse('Failed to get supplies');
  }
}

// GET /api/supplies/:id
export async function getSupplyById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const prisma = getPrismaClient();
  const supplyId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/');
  
  if (!supplyId) return errorResponse('Supply ID is required', 400);

  try {
    const provider = await prisma.providers.findFirst({
      where: { id: supplyId },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1,
          include: {
            provider_schedules: true 
          }
        },
        provider_catalog: {
            where: { is_available: true }
        }
      },
    });

    if (!provider) {
      return notFoundResponse('Supply store not found');
    }

    const branch = provider.provider_branches[0];
    
    const horarioTexto = branch 
        ? calculateScheduleSummary(branch.provider_schedules) 
        : 'Horario no disponible';

    return successResponse({
      id: provider.id,
      name: provider.commercial_name || 'Tienda de Insumos',
      description: provider.description || null,
      address: branch?.address_text || null,
      phone: branch?.phone_contact || null,
      rating: Number(branch?.rating_cache || 0),
      imageUrl: branch?.image_url || provider.logo_url || null,
      horarioAtencion: horarioTexto, 
      products: provider.provider_catalog.map(prod => ({
        id: prod.id,
        name: prod.name,
        price: Number(prod.price),
        imageUrl: prod.image_url,
        description: prod.description
      }))
    });
  } catch (error: any) {
    return internalErrorResponse('Failed to get supply');
  }
}

// GET /api/supplies/:id/reviews
export async function getSupplyReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const prisma = getPrismaClient();
  const supplyId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/');
  
  if (!supplyId) return errorResponse('Supply ID is required', 400);

  try {
    const provider = await prisma.providers.findFirst({
      where: { id: supplyId },
      include: {
        provider_branches: { select: { id: true } },
      },
    });

    if (!provider) return notFoundResponse('Supply store not found');

    const branchIds = provider.provider_branches.map(b => b.id);

    const reviews = await prisma.reviews.findMany({
      where: { branch_id: { in: branchIds } },
      include: {
        patients: {
          include: { users: { select: { email: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    const reviewsData = reviews.map(review => ({
      id: review.id,
      supplyStoreId: supplyId,
      userId: review.patient_id || null,
      userName: review.patients?.full_name || 'Usuario',
      rating: review.rating || 0,
      comment: review.comment || null,
      createdAt: review.created_at?.toISOString() || new Date().toISOString(),
    }));

    return successResponse(reviewsData);
  } catch (error: any) {
    return internalErrorResponse('Failed to get reviews');
  }
}

// POST /api/supplies/:id/reviews
export async function createSupplyReview(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.patient]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  const { randomUUID } = await import('crypto');
  const supplyId = extractIdFromPath(event.requestContext.http.path, '/api/supplies/');
  
  if (!supplyId) return errorResponse('Supply ID is required', 400);

  try {
    const body = JSON.parse(event.body || '{}');
    const validated = createReviewSchema.parse(body);

    const provider = await prisma.providers.findFirst({
      where: { id: supplyId },
      include: {
        provider_branches: { where: { is_active: true }, take: 1 },
      },
    });

    if (!provider || provider.provider_branches.length === 0) {
      return notFoundResponse('Supply store not found');
    }

    const branch = provider.provider_branches[0];
    const patient = await prisma.patients.findFirst({
      where: { user_id: authResult.user.id },
    });

    if (!patient) return notFoundResponse('Patient profile not found');

    const review = await prisma.reviews.create({
      data: {
        id: randomUUID(),
        patient_id: patient.id,
        branch_id: branch.id,
        rating: validated.rating,
        comment: validated.comment || null,
      },
      include: {
        patients: { include: { users: { select: { email: true } } } },
      },
    });

    return successResponse({
      id: review.id,
      supplyStoreId: supplyId,
      userId: review.patient_id || null,
      userName: review.patients?.full_name || 'Usuario',
      rating: review.rating || 0,
      comment: review.comment || null,
      createdAt: review.created_at?.toISOString() || new Date().toISOString(),
    }, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) return errorResponse(error.errors[0].message, 400);
    return internalErrorResponse('Failed to create review');
  }
}

// GET /api/supplies/:userId/dashboard
export async function getSupplyDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  const path = event.requestContext.http.path;
  const pathParts = path.split('/');
  const userIdIndex = pathParts.indexOf('supplies') + 1;
  const userId = pathParts[userIdIndex];

  if (userId !== authResult.user.id) return unauthorizedResponse('Unauthorized');

  try {
    const provider = await prisma.providers.findFirst({
      where: { user_id: authResult.user.id },
      include: {
        provider_branches: { where: { is_active: true }, take: 1 },
        service_categories: { select: { name: true, slug: true } },
      },
    });

    if (!provider) return notFoundResponse('Supply store not found');

    const branch = provider.provider_branches[0];
    const stats = {
      totalProducts: 0,
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
    };

    return successResponse({
      store: {
        id: provider.id,
        name: provider.commercial_name || 'Tienda de Insumos',
        description: provider.description || null,
        address: branch?.address_text || null,
        phone: branch?.phone_contact || null,
        whatsapp: branch?.phone_contact || null,
      },
      stats,
      recentOrders: [],
      products: [],
    });
  } catch (error: any) {
    return internalErrorResponse('Failed to get dashboard');
  }
}