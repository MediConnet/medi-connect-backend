import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse } from '../shared/response';
import { getProfile, updateProfile } from './profile.controller';
import { getDashboard } from './dashboard.controller';
import { getProducts, createProduct, updateProduct, deleteProduct } from './products.controller';
import { getOrders, updateOrderStatus } from './orders.controller';
import { getReviews, getBranchReviews, createReview } from './reviews.controller';
import { getPayments } from './payments.controller';
import { getBranches, createBranch, updateBranch, deleteBranch } from './branches.controller';
import { extractIdFromPath } from '../shared/validators';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Pharmacies handler invoked', { method, path });
  console.log(`🔍 [PHARMACIES HANDLER] ${method} ${path}`);
  console.log(`🔍 [PHARMACIES HANDLER] Path exacto: "${path}"`);
  console.log(`🔍 [PHARMACIES HANDLER] Path length: ${path.length}`);
  console.log(`🔍 [PHARMACIES HANDLER] Path === '/api/pharmacies/reviews': ${path === '/api/pharmacies/reviews'}`);

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    return optionsResponse(event);
  }

  try {
    // --- Rutas de Perfil ---
    if (path === '/api/pharmacies/profile') {
      if (method === 'GET') return await getProfile(event);
      if (method === 'PUT') return await updateProfile(event);
    }

    // --- Rutas de Dashboard ---
    if (path === '/api/pharmacies/dashboard') {
      if (method === 'GET') return await getDashboard(event);
    }

    // --- Rutas de Productos ---
    if (path === '/api/pharmacies/products') {
      if (method === 'GET') return await getProducts(event);
      if (method === 'POST') return await createProduct(event);
    }

    // --- Rutas de Producto Individual ---
    if (path.startsWith('/api/pharmacies/products/')) {
      const productId = extractIdFromPath(path, '/api/pharmacies/products/');
      if (method === 'PUT') return await updateProduct(event);
      if (method === 'DELETE') return await deleteProduct(event);
    }

    // --- Rutas de Pedidos ---
    if (path === '/api/pharmacies/orders') {
      if (method === 'GET') return await getOrders(event);
    }

    // --- Rutas de Estado de Pedido ---
    if (path.startsWith('/api/pharmacies/orders/') && path.endsWith('/status')) {
      if (method === 'PUT') return await updateOrderStatus(event);
    }

    // --- Rutas de Reseñas ---
    // GET /api/pharmacies/reviews/:branchId - Obtener reseñas de una sucursal (público)
    if (path.startsWith('/api/pharmacies/reviews/') && method === 'GET') {
      return await getBranchReviews(event);
    }
    
    // GET /api/pharmacies/reviews - Listar reseñas del provider (solo providers)
    // POST /api/pharmacies/reviews - Crear reseña
    if (path === '/api/pharmacies/reviews') {
      if (method === 'GET') return await getReviews(event);
      if (method === 'POST') return await createReview(event);
    }

    // --- Rutas de Pagos ---
    if (path === '/api/pharmacies/payments' || path === '/api/pharmacies/payments/income') {
      if (method === 'GET') return await getPayments(event);
    }

    // --- Rutas de Sucursales ---
    if (path === '/api/pharmacies/branches') {
      if (method === 'GET') return await getBranches(event);
      if (method === 'POST') return await createBranch(event);
    }

    // --- Rutas de Sucursal Individual ---
    if (path.startsWith('/api/pharmacies/branches/')) {
      const branchId = extractIdFromPath(path, '/api/pharmacies/branches/');
      if (branchId) {
        if (method === 'PUT') return await updateBranch(event);
        if (method === 'DELETE') return await deleteBranch(event);
      }
    }

    // Si no coincide ninguna ruta
    return errorResponse('Not found', 404);

  } catch (error: any) {
    console.error(`❌ [PHARMACIES] ${method} ${path} - Error:`, error.message);
    logger.error('Error in pharmacies handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}
