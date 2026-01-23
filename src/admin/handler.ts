import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole, AuthContext } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';
import { approveRequestSchema, rejectRequestSchema, parseBody } from '../shared/validators';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Admin handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    const { optionsResponse } = await import('../shared/response');
    return optionsResponse(event);
  }

  try {
    // GET /api/admin/dashboard/stats
    if (method === 'GET' && path === '/api/admin/dashboard/stats') {
      console.log('✅ [ADMIN] GET /api/admin/dashboard/stats - Obteniendo estadísticas');
      const result = await getDashboardStats(event);
      console.log(`✅ [ADMIN] GET /api/admin/dashboard/stats - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/requests
    if (method === 'GET' && path === '/api/admin/requests') {
      console.log('✅ [ADMIN] GET /api/admin/requests - Obteniendo solicitudes');
      const result = await getRequests(event);
      console.log(`✅ [ADMIN] GET /api/admin/requests - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/ad-requests
    if (method === 'GET' && path === '/api/admin/ad-requests') {
      console.log('✅ [ADMIN] GET /api/admin/ad-requests - Obteniendo solicitudes de anuncios');
      const result = await getAdRequests(event);
      console.log(`✅ [ADMIN] GET /api/admin/ad-requests - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/provider-requests
    if (method === 'GET' && path === '/api/admin/provider-requests') {
      console.log('✅ [ADMIN] GET /api/admin/provider-requests - Obteniendo solicitudes de proveedores');
      const result = await getProviderRequests(event);
      console.log(`✅ [ADMIN] GET /api/admin/provider-requests - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/activity
    if (method === 'GET' && path === '/api/admin/activity') {
      console.log('✅ [ADMIN] GET /api/admin/activity - Obteniendo historial de actividad');
      const result = await getActivity(event);
      console.log(`✅ [ADMIN] GET /api/admin/activity - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/history o /api/admin/historial
    if (method === 'GET' && (path === '/api/admin/history' || path === '/api/admin/historial')) {
      console.log('✅ [ADMIN] GET /api/admin/history - Obteniendo historial');
      const result = await getHistory(event);
      console.log(`✅ [ADMIN] GET /api/admin/history - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/rejected-services o /api/admin/services/rejected
    if (method === 'GET' && (path === '/api/admin/rejected-services' || path === '/api/admin/services/rejected')) {
      console.log('✅ [ADMIN] GET /api/admin/rejected-services - Obteniendo servicios rechazados');
      const result = await getRejectedServices(event);
      console.log(`✅ [ADMIN] GET /api/admin/rejected-services - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/admin/ad-requests/{id}/approve
    if (method === 'PUT' && path.startsWith('/api/admin/ad-requests/') && path.endsWith('/approve')) {
      console.log('✅ [ADMIN] PUT /api/admin/ad-requests/{id}/approve - Aprobando anuncio');
      const result = await approveAdRequest(event);
      console.log(`✅ [ADMIN] PUT /api/admin/ad-requests/{id}/approve - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/admin/ad-requests/{id}/reject
    if (method === 'PUT' && path.startsWith('/api/admin/ad-requests/') && path.endsWith('/reject')) {
      console.log('✅ [ADMIN] PUT /api/admin/ad-requests/{id}/reject - Rechazando anuncio');
      const result = await rejectAdRequest(event);
      console.log(`✅ [ADMIN] PUT /api/admin/ad-requests/{id}/reject - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/admin/requests/{id}/approve
    if (method === 'PUT' && path.startsWith('/api/admin/requests/') && path.endsWith('/approve')) {
      console.log('✅ [ADMIN] PUT /api/admin/requests/{id}/approve - Aprobando solicitud');
      const result = await approveRequest(event);
      console.log(`✅ [ADMIN] PUT /api/admin/requests/{id}/approve - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/admin/requests/{id}/reject
    if (method === 'PUT' && path.startsWith('/api/admin/requests/') && path.endsWith('/reject')) {
      console.log('✅ [ADMIN] PUT /api/admin/requests/{id}/reject - Rechazando solicitud');
      const result = await rejectRequest(event);
      console.log(`✅ [ADMIN] PUT /api/admin/requests/{id}/reject - Completado con status ${result.statusCode}`);
      return result;
    }

    console.log(`❌ [ADMIN] ${method} ${path} - Ruta no encontrada (404)`);
    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [ADMIN] ${method} ${path} - Error:`, error.message);
    logger.error('Error in admin handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function getDashboardStats(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📊 [GET_DASHBOARD_STATS] Obteniendo estadísticas del dashboard');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_DASHBOARD_STATS] Error de autenticación');
    return authResult;
  }

  const prisma = getPrismaClient();

  // Obtener el primer día del mes actual para filtrar citas mensuales
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Obtener todas las estadísticas en paralelo
  const [
    totalUsers,
    totalCities,
    totalAppointments,
    // Contar servicios por tipo (providers aprobados por categoría)
    totalDoctors,
    totalPharmacies,
    totalLaboratories,
    totalAmbulances,
    totalSupplies,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.cities.count(),
    // Citas del mes actual
    prisma.appointments.count({
      where: {
        scheduled_for: {
          gte: firstDayOfMonth,
        },
      },
    }),
    // Contar providers aprobados por categoría usando slug
    prisma.providers.count({
      where: {
        service_categories: {
          slug: 'doctor',
        },
        verification_status: 'APPROVED',
      },
    }),
    prisma.providers.count({
      where: {
        service_categories: {
          slug: 'pharmacy',
        },
        verification_status: 'APPROVED',
      },
    }),
    prisma.providers.count({
      where: {
        service_categories: {
          slug: 'laboratory',
        },
        verification_status: 'APPROVED',
      },
    }),
    prisma.providers.count({
      where: {
        service_categories: {
          slug: 'ambulance',
        },
        verification_status: 'APPROVED',
      },
    }),
    prisma.providers.count({
      where: {
        service_categories: {
          slug: 'supplies',
        },
        verification_status: 'APPROVED',
      },
    }),
  ]);

  // Calcular total de servicios
  const totalServices = totalDoctors + totalPharmacies + totalLaboratories + totalAmbulances + totalSupplies;

  // Por ahora, los trends son "0%" ya que no tenemos datos históricos
  // En el futuro se puede calcular comparando con el mes anterior
  const servicesTrend = "+0%";
  const usersTrend = "+0%";

  // Solicitudes (por ahora 0 ya que no existen los modelos)
  const pendingRequests = 0;
  const approvedRequests = 0;
  const rejectedRequests = 0;

  // Construir respuesta con la estructura esperada por el frontend
  const responseData = {
    totalServices: {
      value: totalServices,
      trend: servicesTrend,
    },
    usersInApp: {
      value: totalUsers,
      trend: usersTrend,
    },
    monthlyContacts: totalAppointments,
    totalCities: totalCities,
    requestStatus: {
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests,
    },
    servicesByType: {
      doctors: totalDoctors,
      pharmacies: totalPharmacies,
      laboratories: totalLaboratories,
      ambulances: totalAmbulances,
      supplies: totalSupplies,
    },
    recentActivity: [], // Por ahora vacío, se puede implementar después
  };

  console.log(`✅ [GET_DASHBOARD_STATS] Estadísticas obtenidas: ${totalUsers} usuarios, ${totalServices} servicios, ${totalAppointments} citas del mes, ${totalCities} ciudades`);
  console.log('📤 [GET_DASHBOARD_STATS] Respuesta completa:', JSON.stringify(responseData, null, 2));
  
  return successResponse(responseData);
}

async function getRequests(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📋 [GET_REQUESTS] Obteniendo solicitudes');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_REQUESTS] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const type = queryParams.type || 'all'; // 'provider', 'ad', 'all'
  const status = queryParams.status;
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  const prisma = getPrismaClient();

  // TODO: Models providerRequest and adRequest don't exist in schema
  // Retornar array vacío para evitar errores en el frontend
  console.log(`✅ [GET_REQUESTS] Retornando array vacío (modelos no implementados)`);
  return successResponse({
    requests: [],
    type: type === 'provider' ? 'provider' : type === 'ad' ? 'ad' : 'all',
    pagination: { limit, offset, total: 0 },
  });
}

async function getAdRequests(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📢 [GET_AD_REQUESTS] Obteniendo solicitudes de anuncios');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_AD_REQUESTS] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const status = queryParams.status; // 'pending', 'approved', 'rejected'
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  // TODO: Model adRequest doesn't exist in schema
  // Retornar array vacío para evitar errores en el frontend
  console.log(`✅ [GET_AD_REQUESTS] Retornando array vacío (modelo no implementado)`);
  return successResponse([]);
}

async function getProviderRequests(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('👤 [GET_PROVIDER_REQUESTS] Obteniendo solicitudes de proveedores');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_PROVIDER_REQUESTS] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const status = queryParams.status; // 'pending', 'approved', 'rejected'
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  // TODO: Model providerRequest doesn't exist in schema
  // Retornar array vacío para evitar errores en el frontend
  console.log(`✅ [GET_PROVIDER_REQUESTS] Retornando array vacío (modelo no implementado)`);
  return successResponse([]);
}

async function getHistory(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📜 [GET_HISTORY] Obteniendo historial');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_HISTORY] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  // TODO: Implementar historial real cuando existan los modelos
  // Por ahora retornar array vacío con estructura esperada
  console.log(`✅ [GET_HISTORY] Retornando array vacío (modelo no implementado)`);
  return successResponse([]);
}

async function getRejectedServices(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('🚫 [GET_REJECTED_SERVICES] Obteniendo servicios rechazados');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_REJECTED_SERVICES] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  // TODO: Implementar servicios rechazados reales
  // Por ahora retornar array vacío con estructura esperada
  console.log(`✅ [GET_REJECTED_SERVICES] Retornando array vacío (modelo no implementado)`);
  return successResponse([]);
}

async function getActivity(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📊 [GET_ACTIVITY] Obteniendo historial de actividad');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_ACTIVITY] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  // TODO: Implementar historial real cuando existan los modelos
  // El frontend espera: { success: true, data: ActivityHistory[] }
  console.log(`✅ [GET_ACTIVITY] Retornando array vacío (modelo no implementado)`);
  return successResponse([]);
}

async function approveAdRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [APPROVE_AD_REQUEST] Aprobando solicitud de anuncio');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [APPROVE_AD_REQUEST] Error de autenticación');
    return authResult;
  }

  const requestId = extractIdFromPath(event.requestContext.http.path, '/api/admin/ad-requests/', '/approve');
  
  // TODO: Implementar aprobación real cuando exista el modelo
  console.log(`✅ [APPROVE_AD_REQUEST] Solicitud ${requestId} aprobada (mock)`);
  return successResponse({ success: true });
}

async function rejectAdRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('❌ [REJECT_AD_REQUEST] Rechazando solicitud de anuncio');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [REJECT_AD_REQUEST] Error de autenticación');
    return authResult;
  }

  const requestId = extractIdFromPath(event.requestContext.http.path, '/api/admin/ad-requests/', '/reject');
  let reason: string | undefined = undefined;
  if (event.body) {
    try {
      const body = parseBody(event.body, z.object({ reason: z.string().optional() }));
      reason = body.reason;
    } catch (e) {
      // Si el body no tiene reason, está bien, es opcional
    }
  }
  
  // TODO: Implementar rechazo real cuando exista el modelo
  console.log(`❌ [REJECT_AD_REQUEST] Solicitud ${requestId} rechazada. Razón: ${reason || 'No especificada'}`);
  return successResponse({ success: true });
}

async function approveRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [APPROVE_REQUEST] Aprobando solicitud de proveedor');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [APPROVE_REQUEST] Error de autenticación');
    return authResult;
  }

  const requestId = extractIdFromPath(event.requestContext.http.path, '/api/admin/requests/', '/approve');
  
  // TODO: Implementar aprobación real cuando exista el modelo
  console.log(`✅ [APPROVE_REQUEST] Solicitud ${requestId} aprobada (mock)`);
  return successResponse({ success: true });
}

async function rejectRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('❌ [REJECT_REQUEST] Rechazando solicitud de proveedor');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [REJECT_REQUEST] Error de autenticación');
    return authResult;
  }

  const requestId = extractIdFromPath(event.requestContext.http.path, '/api/admin/requests/', '/reject');
  let reason: string | undefined = undefined;
  if (event.body) {
    try {
      const body = parseBody(event.body, z.object({ reason: z.string().optional() }));
      reason = body.reason;
    } catch (e) {
      // Si el body no tiene reason, está bien, es opcional
    }
  }
  
  // TODO: Implementar rechazo real cuando exista el modelo
  console.log(`❌ [REJECT_REQUEST] Solicitud ${requestId} rechazada. Razón: ${reason || 'No especificada'}`);
  return successResponse({ success: true });
}

function extractIdFromPath(path: string, prefix: string, suffix: string): string {
  const start = prefix.length;
  const end = path.indexOf(suffix);
  if (end === -1) {
    throw new Error('Invalid path format');
  }
  return path.substring(start, end);
}
