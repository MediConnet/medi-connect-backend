import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { AuthContext, requireAuth } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, internalErrorResponse, notFoundResponse } from '../shared/response';
import { logger } from '../shared/logger';

/**
 * GET /api/supplies/products
 * Listar productos del proveedor autenticado
 */
export async function getProducts(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] GET /api/supplies/products - Listando productos');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    // Buscar proveedor
    const prisma = getPrismaClient();
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [SUPPLIES] Usuario no tiene tienda asociada');
      // Retornar array vacío en lugar de error
      return successResponse({
        products: [],
        message: 'No tienes una tienda de insumos configurada'
      });
    }

    // Obtener productos del proveedor
    const products = await prisma.provider_catalog.findMany({
      where: {
        provider_id: provider.id,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    console.log(`✅ [SUPPLIES] ${products.length} productos encontrados`);

    return successResponse({
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        type: p.type,
        price: p.price ? parseFloat(p.price.toString()) : 0,
        stock: p.stock || 0,
        imageUrl: p.image_url,
        isActive: p.is_available,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error al listar productos:', error.message);
    logger.error('Error getting products', error);
    return internalErrorResponse('Error al obtener productos');
  }
}

/**
 * POST /api/supplies/products
 * Crear un producto nuevo
 */
export async function createProduct(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] POST /api/supplies/products - Creando producto');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    // Verificar que es un proveedor de supplies
    const prisma = getPrismaClient();
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    const body = JSON.parse(event.body || '{}');
    const { name, description, type, price, stock, imageUrl, isActive } = body;

    // Validaciones
    if (!name || name.trim() === '') {
      return errorResponse('El nombre del producto es requerido', 400);
    }

    if (!type || type.trim() === '') {
      return errorResponse('El tipo/categoría del producto es requerido', 400);
    }

    if (price === undefined || price === null || price <= 0) {
      return errorResponse('El precio debe ser mayor a 0', 400);
    }

    if (stock !== undefined && stock < 0) {
      return errorResponse('El stock no puede ser negativo', 400);
    }

    // Crear producto
    const product = await prisma.provider_catalog.create({
      data: {
        id: randomUUID(),
        provider_id: provider.id,
        name: name.trim(),
        description: description?.trim() || null,
        type: type.trim(),
        price,
        stock: stock || 0,
        image_url: imageUrl || null,
        is_available: isActive !== undefined ? isActive : true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log(`✅ [SUPPLIES] Producto creado: ${product.id}`);

    return successResponse(
      {
        id: product.id,
        name: product.name,
        description: product.description,
        type: product.type,
        price: Number(product.price),
        stock: product.stock,
        imageUrl: product.image_url,
        isActive: product.is_available,
        createdAt: product.created_at?.toISOString(),
        updatedAt: product.updated_at?.toISOString(),
      },
      201
    );
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error creating product:', error);
    logger.error('Error creating product', error);
    return internalErrorResponse('Error al crear producto');
  }
}

/**
 * PUT /api/supplies/products/:id
 * Actualizar un producto existente
 */
export async function updateProduct(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] PUT /api/supplies/products/:id - Actualizando producto');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    // Extraer ID del path
    const pathParts = event.requestContext.http.path.split('/');
    const productId = pathParts[pathParts.length - 1];

    if (!productId) {
      return errorResponse('ID de producto requerido', 400);
    }

    const prisma = getPrismaClient();

    // Verificar que es un proveedor
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    // Verificar que el producto existe y pertenece al proveedor
    const existingProduct = await prisma.provider_catalog.findFirst({
      where: {
        id: productId,
        provider_id: provider.id,
      },
    });

    if (!existingProduct) {
      return notFoundResponse('Producto no encontrado o no tienes permiso para editarlo');
    }

    const body = JSON.parse(event.body || '{}');
    const { name, description, type, price, stock, imageUrl, isActive } = body;

    // Validaciones
    if (price !== undefined && price <= 0) {
      return errorResponse('El precio debe ser mayor a 0', 400);
    }

    if (stock !== undefined && stock < 0) {
      return errorResponse('El stock no puede ser negativo', 400);
    }

    // Preparar datos para actualizar (solo campos enviados)
    const updateData: any = {
      updated_at: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (type !== undefined) updateData.type = type.trim();
    if (price !== undefined) updateData.price = price;
    if (stock !== undefined) updateData.stock = stock;
    if (imageUrl !== undefined) updateData.image_url = imageUrl || null;
    if (isActive !== undefined) updateData.is_available = isActive;

    // Actualizar producto
    const updatedProduct = await prisma.provider_catalog.update({
      where: { id: productId },
      data: updateData,
    });

    console.log(`✅ [SUPPLIES] Producto actualizado: ${productId}`);

    return successResponse({
      id: updatedProduct.id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      type: updatedProduct.type,
      price: Number(updatedProduct.price),
      stock: updatedProduct.stock,
      imageUrl: updatedProduct.image_url,
      isActive: updatedProduct.is_available,
      createdAt: updatedProduct.created_at?.toISOString(),
      updatedAt: updatedProduct.updated_at?.toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error updating product:', error);
    logger.error('Error updating product', error);
    return internalErrorResponse('Error al actualizar producto');
  }
}

/**
 * DELETE /api/supplies/products/:id
 * Eliminar un producto (soft delete)
 */
export async function deleteProduct(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [SUPPLIES] DELETE /api/supplies/products/:id - Eliminando producto');

  try {
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;

    // Extraer ID del path
    const pathParts = event.requestContext.http.path.split('/');
    const productId = pathParts[pathParts.length - 1];

    if (!productId) {
      return errorResponse('ID de producto requerido', 400);
    }

    const prisma = getPrismaClient();

    // Verificar que es un proveedor
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      return errorResponse('Proveedor no encontrado', 404);
    }

    // Verificar que el producto existe y pertenece al proveedor
    const existingProduct = await prisma.provider_catalog.findFirst({
      where: {
        id: productId,
        provider_id: provider.id,
      },
    });

    if (!existingProduct) {
      return notFoundResponse('Producto no encontrado o no tienes permiso para eliminarlo');
    }

    // Soft delete: marcar como no disponible
    await prisma.provider_catalog.update({
      where: { id: productId },
      data: {
        is_available: false,
        updated_at: new Date(),
      },
    });

    console.log(`✅ [SUPPLIES] Producto eliminado (soft delete): ${productId}`);

    return successResponse({
      success: true,
      message: 'Producto eliminado correctamente',
    });
  } catch (error: any) {
    console.error('❌ [SUPPLIES] Error deleting product:', error);
    logger.error('Error deleting product', error);
    return internalErrorResponse('Error al eliminar producto');
  }
}
