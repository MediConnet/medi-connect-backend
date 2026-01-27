import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, createProductSchema, updateProductSchema, extractIdFromPath } from '../shared/validators';

// GET /api/pharmacies/products - Listar productos
export async function getProducts(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] GET /api/pharmacies/products - Obteniendo productos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] GET /api/pharmacies/products - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [PHARMACIES] Provider no encontrado, retornando array vacío de productos');
      return successResponse({
        products: [],
        total: 0,
      });
    }

    // Obtener productos del catálogo
    const products = await prisma.provider_catalog.findMany({
      where: {
        provider_id: provider.id,
        type: 'product', // Solo productos
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`✅ [PHARMACIES] Productos obtenidos exitosamente (${products.length} productos)`);
    return successResponse({
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || null,
        price: p.price ? parseFloat(p.price.toString()) : 0,
        is_available: p.is_available ?? true,
        image_url: p.image_url || null,
        type: p.type || 'product',
      })),
      total: products.length,
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al obtener productos:`, error.message);
    logger.error('Error getting products', error);
    return internalErrorResponse('Failed to get products');
  }
}

// POST /api/pharmacies/products - Crear producto
export async function createProduct(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] POST /api/pharmacies/products - Creando producto');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] POST /api/pharmacies/products - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Validar body
    const body = parseBody(event.body, createProductSchema);

    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.error('❌ [PHARMACIES] Provider no encontrado');
      return errorResponse('Provider not found', 404);
    }

    // Crear producto
    const product = await prisma.provider_catalog.create({
      data: {
        id: randomUUID(),
        provider_id: provider.id,
        type: body.type || 'product',
        name: body.name,
        description: body.description || null,
        price: body.price,
        is_available: body.is_available ?? true,
        image_url: body.image_url || null,
      },
    });

    console.log(`✅ [PHARMACIES] Producto creado exitosamente: ${product.id}`);
    return successResponse({
      id: product.id,
      name: product.name,
      description: product.description || null,
      price: product.price ? parseFloat(product.price.toString()) : 0,
      is_available: product.is_available ?? true,
      image_url: product.image_url || null,
      type: product.type || 'product',
    }, 201);
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al crear producto:`, error.message);
    logger.error('Error creating product', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to create product');
  }
}

// PUT /api/pharmacies/products/:id - Actualizar producto
export async function updateProduct(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] PUT /api/pharmacies/products/{id} - Actualizando producto');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] PUT /api/pharmacies/products/{id} - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Extraer ID de la URL
    const productId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/pharmacies/products/'
    );

    // Validar body
    const body = parseBody(event.body, updateProductSchema);

    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.error('❌ [PHARMACIES] Provider no encontrado');
      return errorResponse('Provider not found', 404);
    }

    // Verificar que el producto pertenece al provider
    const existingProduct = await prisma.provider_catalog.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      console.error(`❌ [PHARMACIES] Producto no encontrado: ${productId}`);
      return notFoundResponse('Product not found');
    }

    if (existingProduct.provider_id !== provider.id) {
      console.error(`❌ [PHARMACIES] El producto no pertenece al provider autenticado`);
      return errorResponse('Product does not belong to this provider', 403);
    }

    // Actualizar producto
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.is_available !== undefined) updateData.is_available = body.is_available;
    if (body.image_url !== undefined) updateData.image_url = body.image_url || null;

    const updatedProduct = await prisma.provider_catalog.update({
      where: { id: productId },
      data: updateData,
    });

    console.log(`✅ [PHARMACIES] Producto actualizado exitosamente: ${productId}`);
    return successResponse({
      id: updatedProduct.id,
      name: updatedProduct.name,
      description: updatedProduct.description || null,
      price: updatedProduct.price ? parseFloat(updatedProduct.price.toString()) : 0,
      is_available: updatedProduct.is_available ?? true,
      image_url: updatedProduct.image_url || null,
      type: updatedProduct.type || 'product',
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al actualizar producto:`, error.message);
    logger.error('Error updating product', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid product ID', 400);
    }
    return internalErrorResponse('Failed to update product');
  }
}

// DELETE /api/pharmacies/products/:id - Eliminar producto
export async function deleteProduct(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] DELETE /api/pharmacies/products/{id} - Eliminando producto');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] DELETE /api/pharmacies/products/{id} - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Extraer ID de la URL
    const productId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/pharmacies/products/'
    );

    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.error('❌ [PHARMACIES] Provider no encontrado');
      return errorResponse('Provider not found', 404);
    }

    // Verificar que el producto pertenece al provider
    const existingProduct = await prisma.provider_catalog.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      console.error(`❌ [PHARMACIES] Producto no encontrado: ${productId}`);
      return notFoundResponse('Product not found');
    }

    if (existingProduct.provider_id !== provider.id) {
      console.error(`❌ [PHARMACIES] El producto no pertenece al provider autenticado`);
      return errorResponse('Product does not belong to this provider', 403);
    }

    // Eliminar producto
    await prisma.provider_catalog.delete({
      where: { id: productId },
    });

    console.log(`✅ [PHARMACIES] Producto eliminado exitosamente: ${productId}`);
    return successResponse({ message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al eliminar producto:`, error.message);
    logger.error('Error deleting product', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid product ID', 400);
    }
    return internalErrorResponse('Failed to delete product');
  }
}
