import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updateOrderStatusSchema, extractIdFromPath } from '../shared/validators';

// GET /api/pharmacies/orders - Listar pedidos
export async function getOrders(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] GET /api/pharmacies/orders - Obteniendo pedidos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] GET /api/pharmacies/orders - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [PHARMACIES] Provider no encontrado, retornando array vacío de pedidos');
      return successResponse({
        orders: [],
        total: 0,
      });
    }

    // Filtros opcionales
    const status = queryParams.status;
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    const offset = queryParams.offset ? parseInt(queryParams.offset) : 0;

    // Construir where clause
    const where: any = {
      provider_id: provider.id,
    };

    if (status) {
      // Mapear estados del frontend a estados de la BD
      const statusMap: Record<string, string> = {
        'pending': 'CONFIRMED',
        'confirmed': 'CONFIRMED',
        'preparing': 'CONFIRMED',
        'ready': 'CONFIRMED',
        'delivered': 'COMPLETED',
        'cancelled': 'CANCELLED',
      };
      where.status = statusMap[status] || status.toUpperCase();
    }

    // Obtener pedidos (appointments)
    const orders = await prisma.appointments.findMany({
      where,
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            users: {
              select: {
                email: true,
              },
            },
          },
        },
        provider_branches: {
          select: {
            id: true,
            name: true,
            address_text: true,
            phone_contact: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount_total: true,
            provider_amount: true,
            status: true,
          },
          take: 1,
          orderBy: {
            created_at: 'desc',
          },
        },
      },
      orderBy: {
        scheduled_for: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.appointments.count({ where });

    console.log(`✅ [PHARMACIES] Pedidos obtenidos exitosamente (${orders.length} de ${total})`);
    return successResponse({
      orders: orders.map(order => ({
        id: order.id,
        scheduledFor: order.scheduled_for,
        status: order.status,
        reason: order.reason || null,
        patient: order.patients ? {
          id: order.patients.id,
          fullName: order.patients.full_name,
          phone: order.patients.phone,
          email: order.patients.users?.email || null,
        } : null,
        branch: order.provider_branches ? {
          id: order.provider_branches.id,
          name: order.provider_branches.name,
          address: order.provider_branches.address_text || null,
          phone: order.provider_branches.phone_contact || null,
        } : null,
        payment: order.payments && order.payments.length > 0 ? {
          id: order.payments[0].id,
          amountTotal: order.payments[0].amount_total ? parseFloat(order.payments[0].amount_total.toString()) : 0,
          providerAmount: order.payments[0].provider_amount ? parseFloat(order.payments[0].provider_amount.toString()) : 0,
          status: order.payments[0].status,
        } : null,
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al obtener pedidos:`, error.message);
    logger.error('Error getting orders', error);
    return internalErrorResponse('Failed to get orders');
  }
}

// PUT /api/pharmacies/orders/:id/status - Actualizar estado de pedido
export async function updateOrderStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] PUT /api/pharmacies/orders/{id}/status - Actualizando estado de pedido');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] PUT /api/pharmacies/orders/{id}/status - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Extraer ID de la URL
    const orderId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/pharmacies/orders/',
      '/status'
    );

    // Validar body
    const body = parseBody(event.body, updateOrderStatusSchema);

    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.error('❌ [PHARMACIES] Provider no encontrado');
      return errorResponse('Provider not found', 404);
    }

    // Buscar el pedido y verificar que pertenece al provider
    const order = await prisma.appointments.findUnique({
      where: { id: orderId },
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    if (!order) {
      console.error(`❌ [PHARMACIES] Pedido no encontrado: ${orderId}`);
      return notFoundResponse('Order not found');
    }

    if (order.provider_id !== provider.id) {
      console.error(`❌ [PHARMACIES] El pedido no pertenece al provider autenticado`);
      return errorResponse('Order does not belong to this provider', 403);
    }

    // Mapear estados del frontend a estados de la BD
    const statusMap: Record<string, string> = {
      'pending': 'CONFIRMED',
      'confirmed': 'CONFIRMED',
      'preparing': 'CONFIRMED',
      'ready': 'CONFIRMED',
      'delivered': 'COMPLETED',
      'cancelled': 'CANCELLED',
    };

    const dbStatus = statusMap[body.status] || body.status.toUpperCase();

    // Actualizar estado
    const updatedOrder = await prisma.appointments.update({
      where: { id: orderId },
      data: {
        status: dbStatus,
      },
    });

    console.log(`✅ [PHARMACIES] Estado de pedido actualizado: ${orderId} -> ${body.status}`);
    return successResponse({
      id: updatedOrder.id,
      status: body.status,
      dbStatus: dbStatus,
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al actualizar estado de pedido:`, error.message);
    logger.error('Error updating order status', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid order ID', 400);
    }
    return internalErrorResponse('Failed to update order status');
  }
}
