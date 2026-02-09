import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { AuthContext, requireAuth } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, notFoundResponse } from '../shared/response';
import { logger } from '../shared/logger';

/**
 * Generar número de orden único
 */
function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9999) + 1;
  return `ORD-${year}-${String(random).padStart(4, '0')}`;
}

/**
 * GET /api/supplies/orders
 * Listar órdenes de la tienda
 */
export async function getOrders(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies/orders - Listando órdenes');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    // Verificar que es un proveedor
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    // Obtener filtros opcionales
    const queryParams = event.queryStringParameters || {};
    const statusFilter = queryParams.status;

    // Construir where clause
    const where: any = {
      provider_id: provider.id,
    };

    if (statusFilter) {
      where.status = statusFilter;
    }

    // Obtener órdenes con sus items
    const orders = await prisma.supply_orders.findMany({
      where,
      include: {
        supply_order_items: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Formatear respuesta
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      clientName: order.client_name,
      clientEmail: order.client_email,
      clientPhone: order.client_phone,
      clientAddress: order.client_address,
      items: order.supply_order_items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        total: Number(item.total),
      })),
      totalAmount: Number(order.total_amount),
      status: order.status,
      orderDate: order.order_date.toISOString().split('T')[0],
      deliveryDate: order.delivery_date ? order.delivery_date.toISOString().split('T')[0] : null,
      notes: order.notes,
      createdAt: order.created_at.toISOString(),
    }));

    console.log(`✅ [SUPPLIES] ${formattedOrders.length} órdenes obtenidas`);

    return successResponse(formattedOrders);
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error getting orders:', error);
    logger.error('Error getting orders', error);
    return internalErrorResponse('Error al obtener órdenes');
  }
}

/**
 * GET /api/supplies/orders/:id
 * Obtener detalle de una orden específica
 */
export async function getOrderById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies/orders/:id - Obteniendo detalle de orden');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    // Extraer ID del path
    const pathParts = event.requestContext.http.path.split('/');
    const orderId = pathParts[pathParts.length - 1];

    if (!orderId) {
      return errorResponse('ID de orden requerido', 400);
    }

    const prisma = getPrismaClient();

    // Verificar que es un proveedor
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    // Obtener orden con items
    const order = await prisma.supply_orders.findFirst({
      where: {
        id: orderId,
        provider_id: provider.id,
      },
      include: {
        supply_order_items: true,
      },
    });

    if (!order) {
      return notFoundResponse('Orden no encontrada o no tienes permiso para verla');
    }

    // Formatear respuesta
    const response = {
      id: order.id,
      orderNumber: order.order_number,
      clientName: order.client_name,
      clientEmail: order.client_email,
      clientPhone: order.client_phone,
      clientAddress: order.client_address,
      items: order.supply_order_items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        total: Number(item.total),
      })),
      totalAmount: Number(order.total_amount),
      status: order.status,
      orderDate: order.order_date.toISOString().split('T')[0],
      deliveryDate: order.delivery_date ? order.delivery_date.toISOString().split('T')[0] : null,
      notes: order.notes,
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at.toISOString(),
    };

    console.log(`✅ [SUPPLIES] Orden obtenida: ${orderId}`);

    return successResponse(response);
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error getting order:', error);
    logger.error('Error getting order', error);
    return internalErrorResponse('Error al obtener orden');
  }
}

/**
 * POST /api/supplies/orders
 * Crear una orden nueva
 */
export async function createOrder(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] POST /api/supplies/orders - Creando orden');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    const prisma = getPrismaClient();

    // Verificar que es un proveedor
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    const body = JSON.parse(event.body || '{}');
    const { clientName, clientEmail, clientPhone, clientAddress, items, deliveryDate, notes } = body;

    // Validaciones
    if (!clientName || clientName.trim() === '') {
      return errorResponse('El nombre del cliente es requerido', 400);
    }

    if (!clientEmail || clientEmail.trim() === '') {
      return errorResponse('El email del cliente es requerido', 400);
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return errorResponse('El email no es válido', 400);
    }

    if (!clientPhone || clientPhone.trim() === '') {
      return errorResponse('El teléfono del cliente es requerido', 400);
    }

    if (!clientAddress || clientAddress.trim() === '') {
      return errorResponse('La dirección del cliente es requerida', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Debe incluir al menos un producto', 400);
    }

    // Validar items
    for (const item of items) {
      if (!item.productId || !item.productName) {
        return errorResponse('Cada item debe tener productId y productName', 400);
      }

      if (!item.quantity || item.quantity <= 0) {
        return errorResponse('La cantidad debe ser mayor a 0', 400);
      }

      if (!item.unitPrice || item.unitPrice <= 0) {
        return errorResponse('El precio unitario debe ser mayor a 0', 400);
      }
    }

    // Calcular total
    let totalAmount = 0;
    const orderItems = items.map((item: any) => {
      const itemTotal = item.quantity * item.unitPrice;
      totalAmount += itemTotal;

      return {
        id: randomUUID(),
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: itemTotal,
      };
    });

    // Generar número de orden único
    let orderNumber = generateOrderNumber();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.supply_orders.findUnique({
        where: { order_number: orderNumber },
      });

      if (!existing) break;

      orderNumber = generateOrderNumber();
      attempts++;
    }

    if (attempts >= 10) {
      return internalErrorResponse('No se pudo generar un número de orden único');
    }

    // Crear orden con items en transacción
    const order = await prisma.supply_orders.create({
      data: {
        id: randomUUID(),
        order_number: orderNumber,
        provider_id: provider.id,
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        client_address: clientAddress.trim(),
        total_amount: totalAmount,
        status: 'pending',
        order_date: new Date(),
        delivery_date: deliveryDate ? new Date(deliveryDate) : null,
        notes: notes?.trim() || null,
        created_at: new Date(),
        updated_at: new Date(),
        supply_order_items: {
          create: orderItems,
        },
      },
      include: {
        supply_order_items: true,
      },
    });

    console.log(`✅ [SUPPLIES] Orden creada: ${order.id} (${order.order_number})`);

    return successResponse(
      {
        id: order.id,
        orderNumber: order.order_number,
        clientName: order.client_name,
        clientEmail: order.client_email,
        clientPhone: order.client_phone,
        clientAddress: order.client_address,
        items: order.supply_order_items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          total: Number(item.total),
        })),
        totalAmount: Number(order.total_amount),
        status: order.status,
        orderDate: order.order_date.toISOString().split('T')[0],
        deliveryDate: order.delivery_date ? order.delivery_date.toISOString().split('T')[0] : null,
        notes: order.notes,
        createdAt: order.created_at.toISOString(),
      },
      201
    );
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error creating order:', error);
    logger.error('Error creating order', error);
    return internalErrorResponse('Error al crear orden');
  }
}

/**
 * PUT /api/supplies/orders/:id/status
 * Actualizar estado de una orden
 */
export async function updateOrderStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] PUT /api/supplies/orders/:id/status - Actualizando estado');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    // Extraer ID del path
    const pathParts = event.requestContext.http.path.split('/');
    const orderIdIndex = pathParts.indexOf('orders') + 1;
    const orderId = pathParts[orderIdIndex];

    if (!orderId) {
      return errorResponse('ID de orden requerido', 400);
    }

    const body = JSON.parse(event.body || '{}');
    const { status } = body;

    // Validar estado
    const validStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(
        `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`,
        400
      );
    }

    const prisma = getPrismaClient();

    // Verificar que es un proveedor
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    // Verificar que la orden existe y pertenece al proveedor
    const existingOrder = await prisma.supply_orders.findFirst({
      where: {
        id: orderId,
        provider_id: provider.id,
      },
    });

    if (!existingOrder) {
      return notFoundResponse('Orden no encontrada o no tienes permiso para editarla');
    }

    // Actualizar estado
    const updatedOrder = await prisma.supply_orders.update({
      where: { id: orderId },
      data: {
        status,
        updated_at: new Date(),
      },
    });

    console.log(`✅ [SUPPLIES] Estado de orden actualizado: ${orderId} -> ${status}`);

    return successResponse({
      id: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      status: updatedOrder.status,
      updatedAt: updatedOrder.updated_at.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error updating order status:', error);
    logger.error('Error updating order status', error);
    return internalErrorResponse('Error al actualizar estado de orden');
  }
}
