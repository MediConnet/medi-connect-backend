import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { enum_roles } from '../generated/prisma/client';
import { requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody } from '../shared/validators';
import { createPharmacyChain, deletePharmacyChain, getPharmacyChains, updatePharmacyChain } from './pharmacy-chains.controller';
import { 
  getDoctorPayments, 
  getClinicPayments, 
  markDoctorPaymentsPaid, 
  markClinicPaymentPaid, 
  getPaymentHistory 
} from './payments.controller';
import {
  getUsers,
  getUserDetail,
  updateUserStatus,
  updateUser,
  deleteUser
} from './users.controller';
import { getSettings, updateSettings } from './settings.controller';

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
    // GET /api/admin/settings
    if (method === 'GET' && path === '/api/admin/settings') {
      console.log('✅ [ADMIN] GET /api/admin/settings - Obteniendo configuración');
      const result = await getSettings(event);
      console.log(`✅ [ADMIN] GET /api/admin/settings - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/admin/settings
    if (method === 'PUT' && path === '/api/admin/settings') {
      console.log('✅ [ADMIN] PUT /api/admin/settings - Actualizando configuración');
      const result = await updateSettings(event);
      console.log(`✅ [ADMIN] PUT /api/admin/settings - Completado con status ${result.statusCode}`);
      return result;
    }

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

    // GET /api/admin/requests/{id}
    if (method === 'GET' && path.startsWith('/api/admin/requests/') &&
        !path.endsWith('/approve') && !path.endsWith('/reject')) {
      console.log('✅ [ADMIN] GET /api/admin/requests/{id} - Obteniendo detalle de solicitud');
      const result = await getRequestDetail(event);
      console.log(`✅ [ADMIN] GET /api/admin/requests/{id} - Completado con status ${result.statusCode}`);
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

    // POST/PUT /api/admin/ad-requests/{id}/approve (soporta ambos métodos para compatibilidad con frontend)
    if ((method === 'POST' || method === 'PUT') && path.startsWith('/api/admin/ad-requests/') && path.endsWith('/approve')) {
      console.log(`✅ [ADMIN] ${method} /api/admin/ad-requests/{id}/approve - Aprobando anuncio`);
      const result = await approveAdRequest(event);
      console.log(`✅ [ADMIN] ${method} /api/admin/ad-requests/{id}/approve - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST/PUT /api/admin/ad-requests/{id}/reject (soporta ambos métodos para compatibilidad con frontend)
    if ((method === 'POST' || method === 'PUT') && path.startsWith('/api/admin/ad-requests/') && path.endsWith('/reject')) {
      console.log(`✅ [ADMIN] ${method} /api/admin/ad-requests/{id}/reject - Rechazando anuncio`);
      const result = await rejectAdRequest(event);
      console.log(`✅ [ADMIN] ${method} /api/admin/ad-requests/{id}/reject - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST/PUT /api/admin/requests/{id}/approve (soporta ambos métodos para compatibilidad con frontend)
    if ((method === 'POST' || method === 'PUT') && path.startsWith('/api/admin/requests/') && path.endsWith('/approve')) {
      console.log(`✅ [ADMIN] ${method} /api/admin/requests/{id}/approve - Aprobando solicitud`);
      const result = await approveRequest(event);
      console.log(`✅ [ADMIN] ${method} /api/admin/requests/{id}/approve - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST/PUT /api/admin/requests/{id}/reject (soporta ambos métodos para compatibilidad con frontend)
    if ((method === 'POST' || method === 'PUT') && path.startsWith('/api/admin/requests/') && path.endsWith('/reject')) {
      console.log(`✅ [ADMIN] ${method} /api/admin/requests/{id}/reject - Rechazando solicitud`);
      const result = await rejectRequest(event);
      console.log(`✅ [ADMIN] ${method} /api/admin/requests/{id}/reject - Completado con status ${result.statusCode}`);
      return result;
    }

    // --- Rutas de Pharmacy Chains (Admin) ---
    // GET /api/admin/pharmacy-chains
    if (method === 'GET' && path === '/api/admin/pharmacy-chains') {
      console.log('✅ [ADMIN] GET /api/admin/pharmacy-chains - Obteniendo cadenas de farmacias');
      const result = await getPharmacyChains(event);
      console.log(`✅ [ADMIN] GET /api/admin/pharmacy-chains - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/admin/pharmacy-chains
    if (method === 'POST' && path === '/api/admin/pharmacy-chains') {
      console.log('✅ [ADMIN] POST /api/admin/pharmacy-chains - Creando cadena de farmacias');
      const result = await createPharmacyChain(event);
      console.log(`✅ [ADMIN] POST /api/admin/pharmacy-chains - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/admin/pharmacy-chains/:id
    if (method === 'PUT' && path.startsWith('/api/admin/pharmacy-chains/')) {
      console.log('✅ [ADMIN] PUT /api/admin/pharmacy-chains/:id - Actualizando cadena de farmacias');
      const result = await updatePharmacyChain(event);
      console.log(`✅ [ADMIN] PUT /api/admin/pharmacy-chains/:id - Completado con status ${result.statusCode}`);
      return result;
    }

    // DELETE /api/admin/pharmacy-chains/:id
    if (method === 'DELETE' && path.startsWith('/api/admin/pharmacy-chains/')) {
      console.log('✅ [ADMIN] DELETE /api/admin/pharmacy-chains/:id - Eliminando cadena de farmacias');
      const result = await deletePharmacyChain(event);
      console.log(`✅ [ADMIN] DELETE /api/admin/pharmacy-chains/:id - Completado con status ${result.statusCode}`);
      return result;
    }

    // --- Rutas de Pagos (Admin) ---
    // GET /api/admin/payments/doctors
    if (method === 'GET' && path === '/api/admin/payments/doctors') {
      console.log('✅ [ADMIN] GET /api/admin/payments/doctors - Obteniendo pagos a médicos');
      const result = await getDoctorPayments(event);
      console.log(`✅ [ADMIN] GET /api/admin/payments/doctors - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/payments/clinics
    if (method === 'GET' && path === '/api/admin/payments/clinics') {
      console.log('✅ [ADMIN] GET /api/admin/payments/clinics - Obteniendo pagos a clínicas');
      const result = await getClinicPayments(event);
      console.log(`✅ [ADMIN] GET /api/admin/payments/clinics - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/admin/payments/doctors/:doctorId/mark-paid
    if (method === 'POST' && path.match(/^\/api\/admin\/payments\/doctors\/[^/]+\/mark-paid$/)) {
      console.log('✅ [ADMIN] POST /api/admin/payments/doctors/:doctorId/mark-paid - Marcando pagos como pagados');
      const result = await markDoctorPaymentsPaid(event);
      console.log(`✅ [ADMIN] POST /api/admin/payments/doctors/:doctorId/mark-paid - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid
    if (method === 'POST' && path.match(/^\/api\/admin\/payments\/clinics\/[^/]+\/mark-paid$/)) {
      console.log('✅ [ADMIN] POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid - Marcando pago como pagado');
      const result = await markClinicPaymentPaid(event);
      console.log(`✅ [ADMIN] POST /api/admin/payments/clinics/:clinicPaymentId/mark-paid - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/payments/history
    if (method === 'GET' && path === '/api/admin/payments/history') {
      console.log('✅ [ADMIN] GET /api/admin/payments/history - Obteniendo historial de pagos');
      const result = await getPaymentHistory(event);
      console.log(`✅ [ADMIN] GET /api/admin/payments/history - Completado con status ${result.statusCode}`);
      return result;
    }

    // --- Rutas de Usuarios (Admin) ---
    // GET /api/admin/users
    if (method === 'GET' && (path === '/api/admin/users' || path.startsWith('/api/admin/users?'))) {
      console.log('✅ [ADMIN] GET /api/admin/users - Obteniendo usuarios');
      const result = await getUsers(event);
      console.log(`✅ [ADMIN] GET /api/admin/users - Completado con status ${result.statusCode}`);
      return result;
    }

    // PATCH /api/admin/users/:id/status
    if (method === 'PATCH' && path.match(/^\/api\/admin\/users\/[^/]+\/status$/)) {
      console.log('✅ [ADMIN] PATCH /api/admin/users/:id/status - Actualizando estado');
      const result = await updateUserStatus(event);
      console.log(`✅ [ADMIN] PATCH /api/admin/users/:id/status - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/admin/users/:id (debe ir después de /status para no capturarlo)
    if (method === 'GET' && path.match(/^\/api\/admin\/users\/[^/]+$/) && !path.endsWith('/status')) {
      console.log('✅ [ADMIN] GET /api/admin/users/:id - Obteniendo detalle de usuario');
      const result = await getUserDetail(event);
      console.log(`✅ [ADMIN] GET /api/admin/users/:id - Completado con status ${result.statusCode}`);
      return result;
    }

    // PUT /api/admin/users/:id
    if (method === 'PUT' && path.match(/^\/api\/admin\/users\/[^/]+$/)) {
      console.log('✅ [ADMIN] PUT /api/admin/users/:id - Actualizando usuario');
      const result = await updateUser(event);
      console.log(`✅ [ADMIN] PUT /api/admin/users/:id - Completado con status ${result.statusCode}`);
      return result;
    }

    // DELETE /api/admin/users/:id
    if (method === 'DELETE' && path.match(/^\/api\/admin\/users\/[^/]+$/)) {
      console.log('✅ [ADMIN] DELETE /api/admin/users/:id - Eliminando usuario');
      const result = await deleteUser(event);
      console.log(`✅ [ADMIN] DELETE /api/admin/users/:id - Completado con status ${result.statusCode}`);
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

// ❌ FUNCION REGISTER_PROVIDER_REQUEST ELIMINADA

async function getRequests(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📋 [GET_REQUESTS] Obteniendo solicitudes de proveedores');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_REQUESTS] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const status = queryParams.status; // 'PENDING', 'APPROVED', 'REJECTED'
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  const prisma = getPrismaClient();

  // Obtener providers con estado PENDING (o el estado especificado)
  // IMPORTANTE: Como verification_status es String? en el schema, usar strings directamente
  const verificationStatus = status === 'APPROVED' ? 'APPROVED' :
                             status === 'REJECTED' ? 'REJECTED' :
                             'PENDING';

  console.log(`🔍 [GET_REQUESTS] Buscando providers con status: ${verificationStatus}`);

  // Primero, verificar cuántos providers hay en total y cuántos con cada estado
  const allProviders = await prisma.providers.findMany({
    select: {
      id: true,
      verification_status: true,
      commercial_name: true,
    },
  });
  
  console.log(`📊 [GET_REQUESTS] Total de providers en BD: ${allProviders.length}`);
  const statusCounts = allProviders.reduce((acc: Record<string, number>, p: typeof allProviders[0]) => {
    const status = p.verification_status || 'NULL';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`📊 [GET_REQUESTS] Distribución de estados:`, statusCounts);

  // Buscar usando el string directamente
  const providers = await prisma.providers.findMany({
    where: {
      verification_status: verificationStatus,
    },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          profile_picture_url: true,
          created_at: true,
        },
      },
      service_categories: {
        select: {
          slug: true,
          name: true,
        },
      },
      provider_branches: {
        select: {
          id: true,
          city_id: true,
          address_text: true,
          phone_contact: true,  // ✅ Este es el campo correcto
        },
        take: 1, // Solo la primera sucursal
      },
    },
    // Ordenar por fecha de creación del usuario (más recientes primero)
    orderBy: {
      users: {
        created_at: 'desc',
      },
    },
    take: limit,
    skip: offset,
  });

  // Obtener ciudades para mapear
  const cityIds = providers
    .flatMap((p: typeof providers[0]) => p.provider_branches.map((b: typeof p.provider_branches[0]) => b.city_id))
    .filter((id: string | null): id is string => id !== null);
  
  const cities = await prisma.cities.findMany({
    where: {
      id: { in: cityIds },
    },
  });

  // Crear mapa de ciudades de forma más simple
  const cityMap: Record<string, { name: string }> = {};
  cities.forEach((c: { id: string; name: string }) => {
    cityMap[c.id] = { name: c.name };
  });

  // Mapear a la estructura esperada por el frontend
  const requests = providers.map((provider: typeof providers[0]) => {
    const branch = provider.provider_branches[0];
    const city = branch?.city_id ? cityMap[branch.city_id] : undefined;
    const docs = Array.isArray((provider as any).documents) ? (provider as any).documents : [];

    // 🔍 DEBUG: Log de datos de la sucursal
    console.log(`🔍 [GET_REQUESTS] Provider ${provider.id}:`, {
      hasBranch: !!branch,
      branchId: branch?.id,
      phone: branch?.phone_contact,
      address: branch?.address_text,
      cityId: branch?.city_id,
      cityName: city?.name,
    });

    return {
      id: provider.id,
      providerName: provider.commercial_name || 'Sin nombre',
      email: provider.users?.email || '',
      avatarUrl: provider.users?.profile_picture_url || undefined,
      serviceType: provider.service_categories?.slug || provider.service_categories?.name?.toLowerCase() || 'doctor',
      submissionDate: provider.users?.created_at 
        ? new Date(provider.users.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      documentsCount: docs.length,
      status: provider.verification_status === 'APPROVED' ? 'APPROVED' :
              provider.verification_status === 'REJECTED' ? 'REJECTED' :
              'PENDING',
      rejectionReason: null, // TODO: Agregar campo de razón de rechazo
      phone: branch?.phone_contact || '',           // ✅ Desde provider_branches.phone_contact
      whatsapp: branch?.phone_contact || '',     // ✅ Mismo teléfono para whatsapp
      city: city?.name || 'Sin ciudad',
      address: branch?.address_text || '',
      description: provider.description || '',
      documents: docs,
    };
  });

    console.log(`✅ [GET_REQUESTS] Retornando ${requests.length} solicitudes`);
    console.log(`🔍 [GET_REQUESTS] IDs de providers encontrados:`, providers.map((p: typeof providers[0]) => ({ id: p.id, name: p.commercial_name, status: p.verification_status })));
  
  // Agregar headers de no-caché para evitar caché del navegador
  const response = successResponse(requests, 200, event);
  response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  response.headers['Pragma'] = 'no-cache';
  response.headers['Expires'] = '0';
  return response;
}

async function getRequestDetail(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📋 [GET_REQUEST_DETAIL] Obteniendo detalle de solicitud');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const requestId = extractIdFromPath(event.requestContext.http.path, '/api/admin/requests/');
  const prisma = getPrismaClient();

  const provider = await prisma.providers.findFirst({
    where: { id: requestId },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          profile_picture_url: true,
          created_at: true,
        },
      },
      service_categories: { select: { slug: true, name: true } },
      provider_branches: {
        select: { id: true, city_id: true, address_text: true, phone_contact: true },
        take: 1,
      },
    },
  });

  if (!provider) return notFoundResponse('Request not found');

  const branch = provider.provider_branches[0];
  const city = branch?.city_id
    ? await prisma.cities.findFirst({ where: { id: branch.city_id }, select: { name: true } })
    : null;

  const docs = Array.isArray((provider as any).documents) ? (provider as any).documents : [];

  // 🔍 DEBUG: Log de datos de la sucursal
  console.log(`🔍 [GET_REQUEST_DETAIL] Provider ${provider.id}:`, {
    hasBranch: !!branch,
    branchId: branch?.id,
    phone: branch?.phone_contact,
    address: branch?.address_text,
    cityId: branch?.city_id,
    cityName: city?.name,
  });

  return successResponse({
    id: provider.id,
    providerName: provider.commercial_name || 'Sin nombre',
    email: provider.users?.email || '',
    avatarUrl: provider.users?.profile_picture_url || undefined,
    serviceType: provider.service_categories?.slug || provider.service_categories?.name?.toLowerCase() || 'doctor',
    submissionDate: provider.users?.created_at
      ? new Date(provider.users.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    documentsCount: docs.length,
    status: provider.verification_status === 'APPROVED' ? 'APPROVED' :
            provider.verification_status === 'REJECTED' ? 'REJECTED' :
            'PENDING',
    rejectionReason: null,
    phone: branch?.phone_contact || '',           // ✅ Desde provider_branches.phone_contact
    whatsapp: branch?.phone_contact || '',     // ✅ Mismo teléfono para whatsapp
    city: city?.name || 'Sin ciudad',
    address: branch?.address_text || '',
    description: provider.description || '',
    documents: docs,
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
  const status = queryParams.status; // 'PENDING', 'APPROVED', 'REJECTED'
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  const prisma = getPrismaClient();

  // Determinar el estado a filtrar (por defecto PENDING para notificaciones)
  const adStatus = status === 'APPROVED' ? 'APPROVED' :
                   status === 'REJECTED' ? 'REJECTED' :
                   'PENDING';

  console.log(`🔍 [GET_AD_REQUESTS] Buscando anuncios con status: ${adStatus}`);

  // Obtener anuncios con información del proveedor
  const ads = await prisma.provider_ads.findMany({
    where: {
      status: adStatus,
    },
    include: {
      providers: {
        include: {
          users: {
            select: {
              id: true,
              email: true,
            },
          },
          service_categories: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      start_date: 'desc', // Más recientes primero
    },
    take: limit,
    skip: offset,
  });

  const now = new Date();

  // Mapear a la estructura esperada por el frontend
  const adRequests = ads.map((ad) => {
    const provider = ad.providers;
    const serviceType = provider?.service_categories?.slug || 
                       provider?.service_categories?.name?.toLowerCase() || 
                       'doctor';

    // Verificar si el anuncio está activo
    const hasActiveAd = ad.status === 'APPROVED' && 
                       ad.is_active === true &&
                       ad.start_date &&
                       new Date(ad.start_date) <= now &&
                       (!ad.end_date || new Date(ad.end_date) > now);

    // Usar start_date como submissionDate (fecha de creación aproximada)
    const submissionDate = ad.start_date
      ? new Date(ad.start_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    return {
      id: ad.id,
      providerId: ad.provider_id || '',
      providerName: provider?.commercial_name || 'Sin nombre',
      providerEmail: provider?.users?.email || '',
      serviceType: serviceType as 'doctor' | 'pharmacy' | 'laboratory' | 'ambulance' | 'supplies',
      submissionDate: submissionDate,
      status: ad.status as 'PENDING' | 'APPROVED' | 'REJECTED',
      rejectionReason: null, // TODO: Agregar campo de razón de rechazo al schema
      approvedAt: ad.status === 'APPROVED' ? submissionDate : undefined,
      rejectedAt: ad.status === 'REJECTED' ? submissionDate : undefined,
      hasActiveAd: hasActiveAd,
      adContent: {
        label: ad.badge_text || '',
        discount: ad.title || '',
        description: ad.subtitle || '',
        buttonText: ad.action_text || '',
        imageUrl: ad.image_url || undefined,
        startDate: ad.start_date
          ? new Date(ad.start_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        endDate: ad.end_date
          ? new Date(ad.end_date).toISOString().split('T')[0]
          : undefined,
        title: ad.title || undefined, // deprecated pero incluido para compatibilidad
      },
    };
  });

  console.log(`✅ [GET_AD_REQUESTS] Retornando ${adRequests.length} solicitudes de anuncios`);
  return successResponse(adRequests);
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
  console.log('📜 [GET_HISTORY] Obteniendo historial de solicitudes aprobadas y rechazadas');
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    console.error('❌ [GET_HISTORY] Error de autenticación');
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const status = queryParams.status; // Opcional: 'APPROVED' o 'REJECTED' para filtrar
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);
  const search = queryParams.search?.trim(); // Búsqueda por nombre, email o ciudad

  const prisma = getPrismaClient();

  // Construir el filtro WHERE - por defecto incluir APPROVED y REJECTED
  const statusFilter = {
    verification_status: {
      in: status === 'APPROVED' ? ['APPROVED'] :
          status === 'REJECTED' ? ['REJECTED'] :
          ['APPROVED', 'REJECTED'], // Por defecto, ambos estados
    },
  };

  // Construir el filtro completo
  const whereClause: any = search ? {
    AND: [
      statusFilter,
      {
        OR: [
          { commercial_name: { contains: search, mode: 'insensitive' } },
          { users: { email: { contains: search, mode: 'insensitive' } } },
          { provider_branches: { 
            some: {
              OR: [
                { address_text: { contains: search, mode: 'insensitive' } },
                { cities: { name: { contains: search, mode: 'insensitive' } } },
              ],
            },
          } },
        ],
      },
    ],
  } : statusFilter;

  console.log(`🔍 [GET_HISTORY] Buscando providers con status: ${whereClause.verification_status.in.join(', ')}`);
  if (search) {
    console.log(`🔍 [GET_HISTORY] Búsqueda: "${search}"`);
  }

  // Obtener providers aprobados y rechazados
  const providers = await prisma.providers.findMany({
    where: whereClause,
    include: {
      users: {
        select: {
          id: true,
          email: true,
          profile_picture_url: true,
          created_at: true,
        },
      },
      service_categories: {
        select: {
          slug: true,
          name: true,
        },
      },
      provider_branches: {
        include: {
          cities: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: 1, // Solo la primera sucursal
      },
    },
    orderBy: {
      users: {
        created_at: 'desc',
      },
    },
    take: limit,
    skip: offset,
  });

  // Obtener ciudades para mapear (si no se incluyeron en el include)
  const cityIds = providers
    .flatMap((p: typeof providers[0]) => p.provider_branches.map((b: typeof p.provider_branches[0]) => b.city_id))
    .filter((id: string | null): id is string => id !== null);
  
  const cities = await prisma.cities.findMany({
    where: {
      id: { in: cityIds },
    },
  });

  // Crear mapa de ciudades
  const cityMap: Record<string, { name: string }> = {};
  cities.forEach((c: { id: string; name: string }) => {
    cityMap[c.id] = { name: c.name };
  });

  // Mapear a la estructura esperada por el frontend
  const history = providers.map((provider: typeof providers[0]) => {
    const branch = provider.provider_branches[0];
    // Intentar obtener ciudad del include primero, luego del mapa
    const city = branch?.cities || (branch?.city_id ? cityMap[branch.city_id] : undefined);
    const docs = Array.isArray((provider as any).documents) ? (provider as any).documents : [];

    return {
      id: provider.id,
      providerName: provider.commercial_name || 'Sin nombre',
      email: provider.users?.email || '',
      avatarUrl: provider.users?.profile_picture_url || undefined,
      serviceType: provider.service_categories?.slug || provider.service_categories?.name?.toLowerCase() || 'doctor',
      submissionDate: provider.users?.created_at 
        ? new Date(provider.users.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      documentsCount: docs.length,
      status: provider.verification_status === 'APPROVED' ? 'APPROVED' :
              provider.verification_status === 'REJECTED' ? 'REJECTED' :
              'PENDING',
      rejectionReason: null, // TODO: Agregar campo de razón de rechazo si existe
      phone: branch?.phone_contact || '',
      whatsapp: branch?.phone_contact || '',
      city: city?.name || 'Sin ciudad',
      address: branch?.address_text || '',
      description: provider.description || '',
      documents: docs,
    };
  });

  const approvedCount = history.filter(h => h.status === 'APPROVED').length;
  const rejectedCount = history.filter(h => h.status === 'REJECTED').length;
  
  console.log(`✅ [GET_HISTORY] Retornando ${history.length} registros del historial`);
  console.log(`📊 [GET_HISTORY] Distribución: ${approvedCount} aprobados, ${rejectedCount} rechazados`);
  
  // Agregar headers de no-caché para evitar caché del navegador
  const response = successResponse(history, 200, event);
  response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  response.headers['Pragma'] = 'no-cache';
  response.headers['Expires'] = '0';
  return response;
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
  const prisma = getPrismaClient();
  
  // Buscar el anuncio
  const ad = await prisma.provider_ads.findUnique({
    where: { id: requestId },
  });

  if (!ad) {
    console.error(`❌ [APPROVE_AD_REQUEST] Anuncio no encontrado: ${requestId}`);
    return notFoundResponse('Ad request not found');
  }

  // Actualizar estado a APPROVED y activar el anuncio
  await prisma.provider_ads.update({
    where: { id: requestId },
    data: {
      status: 'APPROVED',
      is_active: true,
    },
  });

  console.log(`✅ [APPROVE_AD_REQUEST] Solicitud ${requestId} aprobada exitosamente`);
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
  const prisma = getPrismaClient();
  
  let reason: string | undefined = undefined;
  if (event.body) {
    try {
      const body = parseBody(event.body, z.object({ reason: z.string().optional() }));
      reason = body.reason;
    } catch (e) {
      // Si el body no tiene reason, está bien, es opcional
    }
  }

  // Buscar el anuncio
  const ad = await prisma.provider_ads.findUnique({
    where: { id: requestId },
  });

  if (!ad) {
    console.error(`❌ [REJECT_AD_REQUEST] Anuncio no encontrado: ${requestId}`);
    return notFoundResponse('Ad request not found');
  }

  // Actualizar estado a REJECTED y desactivar el anuncio
  await prisma.provider_ads.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      is_active: false,
    },
  });
  
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
  const prisma = getPrismaClient();
  
  // Buscar el provider
  const provider = await prisma.providers.findUnique({
    where: { id: requestId },
    include: { users: true, service_categories: true },
  });

  if (!provider) {
    console.error(`❌ [APPROVE_REQUEST] Provider no encontrado: ${requestId}`);
    return notFoundResponse('Provider request not found');
  }

  // Actualizar estado a APPROVED
  await prisma.providers.update({
    where: { id: requestId },
    data: {
      verification_status: 'APPROVED', // Usar string directamente
    },
  });

  // Activar el usuario y las sucursales
  if (provider.users) {
    await prisma.users.update({
      where: { id: provider.users.id },
      data: { is_active: true },
    });
  }

  // Activar las sucursales del provider
  await prisma.provider_branches.updateMany({
    where: { provider_id: requestId },
    data: { is_active: true },
  });

  // Enviar email de bienvenida (asíncrono, no bloquea la respuesta)
  if (provider.users?.email) {
    const { sendEmail } = await import("../shared/email-adapter");
    const { generateWelcomeEmail } = await import("../shared/email");

    // Guardar email en variable para evitar problemas de null check en callbacks
    const userEmail = provider.users.email;

    const userName =
      provider.commercial_name ||
      userEmail.split("@")[0] ||
      "Usuario";

    const userRole =
      provider.service_categories?.slug ||
      provider.service_categories?.name?.toLowerCase() ||
      "provider";

    const emailHtml = generateWelcomeEmail({
      userName,
      userRole,
    });

    console.log(
      `📧 [APPROVE_REQUEST] Iniciando envío de email de bienvenida a: ${userEmail}`,
    );

    sendEmail({
      to: userEmail,
      subject: "¡Bienvenido a DOCALINK! 🎉",
      html: emailHtml,
    })
      .then((emailSent) => {
        if (emailSent) {
          console.log(
            `✅ [APPROVE_REQUEST] Email de bienvenida enviado exitosamente a: ${userEmail}`,
          );
        } else {
          console.error(
            `❌ [APPROVE_REQUEST] FALLO: No se pudo enviar email de bienvenida a ${userEmail}`,
          );
          console.error(
            `⚠️ [APPROVE_REQUEST] IMPORTANTE: El usuario ${userEmail} NO recibirá el email de bienvenida`,
          );
        }
      })
      .catch((error: any) => {
        console.error(
          `❌ [APPROVE_REQUEST] ERROR al enviar email de bienvenida a ${userEmail}:`,
          error.message,
        );
        console.error(
          `⚠️ [APPROVE_REQUEST] IMPORTANTE: El usuario ${userEmail} NO recibirá el email de bienvenida`,
        );
      });
  } else {
    console.warn(
      "⚠️ [APPROVE_REQUEST] No se puede enviar email de bienvenida: usuario sin email",
    );
  }

  console.log(`✅ [APPROVE_REQUEST] Solicitud ${requestId} aprobada exitosamente`);
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
  const prisma = getPrismaClient();
  
  let reason: string | undefined = undefined;
  if (event.body) {
    try {
      const body = parseBody(event.body, z.object({ reason: z.string().optional() }));
      reason = body.reason;
    } catch (e) {
      // Si el body no tiene reason, está bien, es opcional
    }
  }

  // Buscar el provider
  const provider = await prisma.providers.findUnique({
    where: { id: requestId },
  });

  if (!provider) {
    console.error(`❌ [REJECT_REQUEST] Provider no encontrado: ${requestId}`);
    return notFoundResponse('Provider request not found');
  }

  // Actualizar estado a REJECTED
  await prisma.providers.update({
    where: { id: requestId },
    data: {
      verification_status: 'REJECTED', // Usar string directamente
    },
  });

  // Mantener el usuario inactivo
  // (No activamos el usuario si se rechaza)

  console.log(`❌ [REJECT_REQUEST] Solicitud ${requestId} rechazada. Razón: ${reason || 'No especificada'}`);
  return successResponse({ success: true });
}

function extractIdFromPath(path: string, prefix: string, suffix: string = ''): string {
  const start = prefix.length;
  const end = suffix ? path.indexOf(suffix) : path.length;
  if (end === -1 || start >= end) {
    throw new Error('Invalid path format');
  }
  return path.substring(start, end);
}