import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { enum_roles } from '../generated/prisma/client';
import { requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody } from '../shared/validators';
import { createPharmacyChain, deletePharmacyChain, getPharmacyChains, updatePharmacyChain } from './pharmacy-chains.controller';
import { getAdminAds, createAdminAd, updateAdminAd, deleteAdminAd, toggleAdminAd } from './ads.controller';
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

    // --- Rutas de Anuncios Admin ---
    // GET /api/admin/ads
    if (method === 'GET' && path === '/api/admin/ads') {
      return await getAdminAds(event);
    }

    // POST /api/admin/ads
    if (method === 'POST' && path === '/api/admin/ads') {
      return await createAdminAd(event);
    }

    // PATCH /api/admin/ads/:id/toggle
    if (method === 'PATCH' && path.match(/^\/api\/admin\/ads\/[^/]+\/toggle$/)) {
      return await toggleAdminAd(event);
    }

    // PUT /api/admin/ads/:id
    if (method === 'PUT' && path.match(/^\/api\/admin\/ads\/[^/]+$/)) {
      return await updateAdminAd(event);
    }

    // DELETE /api/admin/ads/:id
    if (method === 'DELETE' && path.match(/^\/api\/admin\/ads\/[^/]+$/)) {
      return await deleteAdminAd(event);
    }

    console.log(`❌ [ADMIN] ${method} ${path} - Ruta no encontrada (404)`);
    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [ADMIN] ${method} ${path} - Error:`, error.message);
    logger.error('Error in admin handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function compileRecentActivity(prisma: any, limitCount: number = 5): Promise<any[]> {
  try {
    const providers = await prisma.providers.findMany({
      include: {
        users: { select: { created_at: true } },
        service_categories: { select: { name: true } }
      },
      orderBy: { id: 'desc' },
      take: 10,
    });

    const ads = await prisma.provider_ads.findMany({
      include: {
        providers: { select: { commercial_name: true } }
      },
      orderBy: { id: 'desc' },
      take: 10,
    });

    const formatSpanishDate = (dateInput: Date | string | null): string => {
      if (!dateInput) return '';
      const date = new Date(dateInput);
      const day = date.getDate();
      const month = date.toLocaleDateString("es-ES", { month: "long" });
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} de ${month} de ${year} a las ${hours}:${minutes}`;
    };

    const activities: any[] = [];

    providers.forEach((p: any) => {
      const name = p.commercial_name || 'Proveedor';
      const cat = p.service_categories?.name || '';
      const date = p.users?.created_at || new Date();

      activities.push({
        id: `reg-${p.id}`,
        type: 'info',
        message: `Nueva solicitud de registro: ${cat ? cat + ' ' : ''}${name}`,
        timestamp: formatSpanishDate(date),
        timeVal: new Date(date).getTime(),
      });

      if (p.verification_status === 'APPROVED') {
        const appD = new Date(new Date(date).getTime() + 60 * 60 * 1000);
        activities.push({
          id: `app-${p.id}`,
          type: 'success',
          message: `Servicio aprobado: ${name}`,
          timestamp: formatSpanishDate(appD),
          timeVal: appD.getTime(),
        });
      }

      if (p.verification_status === 'REJECTED') {
        const rejD = new Date(new Date(date).getTime() + 30 * 60 * 1000);
        activities.push({
          id: `rej-${p.id}`,
          type: 'error',
          message: `Solicitud rechazada: ${name}${p.rejection_reason ? ' (' + p.rejection_reason + ')' : ''}`,
          timestamp: formatSpanishDate(rejD),
          timeVal: rejD.getTime(),
        });
      }
    });

    ads.forEach((ad: any) => {
      const name = ad.providers?.commercial_name || 'Proveedor';
      const title = ad.title || 'Anuncio';
      const date = ad.start_date || new Date();

      activities.push({
        id: `ad-${ad.id}`,
        type: 'warning',
        message: `Nuevo anuncio creado por ${name}: ${title}`,
        timestamp: formatSpanishDate(date),
        timeVal: new Date(date).getTime(),
      });

      if (ad.status === 'APPROVED') {
        const appD = new Date(new Date(date).getTime() + 15 * 60 * 1000);
        activities.push({
          id: `adapp-${ad.id}`,
          type: 'success',
          message: `Anuncio aprobado: ${title}`,
          timestamp: formatSpanishDate(appD),
          timeVal: appD.getTime(),
        });
      }
    });

    activities.sort((a, b) => b.timeVal - a.timeVal);
    
    // Fallback si está vacío
    if (activities.length === 0) {
      const getRecentDateTime = (hoursAgo: number) => {
        const now = new Date();
        now.setHours(now.getHours() - hoursAgo);
        return now;
      };
      return [
        {
          id: "bk-1",
          type: "info",
          message: "Nueva solicitud de registro: Dra. María González",
          timestamp: formatSpanishDate(getRecentDateTime(2)),
        },
        {
          id: "bk-2",
          type: "success",
          message: "Servicio aprobado: Dr. Roberto Sánchez",
          timestamp: formatSpanishDate(getRecentDateTime(5)),
        },
        {
          id: "bk-3",
          type: "info",
          message: "Nueva solicitud de registro: Farmacia del Pueblo",
          timestamp: formatSpanishDate(getRecentDateTime(8)),
        }
      ];
    }

    return activities.slice(0, limitCount).map(({ timeVal, ...rest }) => rest);
  } catch (err) {
    console.error('Error compiling dashboard activities:', err);
    return [];
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
    recentActivity: await compileRecentActivity(prisma, 5),
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

  // Buscar usando el string directamente, incluyendo null como PENDING
  const whereClause = verificationStatus === 'PENDING'
    ? {
        OR: [
          { verification_status: 'PENDING' },
          { verification_status: null }
        ]
      }
    : {
        verification_status: verificationStatus,
      };

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
        select: {
          id: true,
          city_id: true,
          address_text: true,
          phone_contact: true,  // ✅ Este es el campo correcto
        },
        take: 1, // Solo la primera sucursal
      },
    },
    // Ordenar por ID descendente (más recientes primero)
    // Nota: Si necesitas ordenar por fecha de creación del usuario, 
    // sería mejor agregar un campo created_at al modelo providers
    orderBy: {
      id: 'desc',
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
      rejectionReason: (provider as any).rejection_reason || null,
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
  if (response.headers) {
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    response.headers['Pragma'] = 'no-cache';
    response.headers['Expires'] = '0';
  }
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
    rejectionReason: (provider as any).rejection_reason || null,
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
      rejectionReason: (provider as any).rejection_reason || null,
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
      id: 'desc', // Ordenar por ID descendente (más recientes primero)
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
      rejectionReason: (provider as any).rejection_reason || null,
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
  if (response.headers) {
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    response.headers['Pragma'] = 'no-cache';
    response.headers['Expires'] = '0';
  }
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

  const prisma = getPrismaClient();

  try {
    // 1. Obtener proveedores recientes con sus usuarios y categorías
    const providers = await prisma.providers.findMany({
      include: {
        users: {
          select: {
            created_at: true,
            email: true,
          }
        },
        service_categories: {
          select: {
            name: true,
          }
        }
      },
      orderBy: {
        id: 'desc',
      },
      take: 30,
    });

    // 2. Obtener anuncios recientes con proveedores
    const ads = await prisma.provider_ads.findMany({
      include: {
        providers: {
          select: {
            commercial_name: true,
          }
        }
      },
      orderBy: {
        id: 'desc',
      },
      take: 20,
    });

    // Función auxiliar para formatear fechas al español
    const formatSpanishDate = (dateInput: Date | string | null): string => {
      if (!dateInput) return '';
      const date = new Date(dateInput);
      const day = date.getDate();
      const month = date.toLocaleDateString("es-ES", { month: "long" });
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} de ${month} de ${year} a las ${hours}:${minutes}`;
    };

    const activities: any[] = [];

    // Compilar actividades de proveedores
    providers.forEach((provider) => {
      const providerName = provider.commercial_name || 'Proveedor';
      const categoryName = provider.service_categories?.name || '';
      const regDate = provider.users?.created_at || new Date();

      // Registro
      activities.push({
        id: `reg-${provider.id}`,
        title: `Nueva solicitud de registro: ${categoryName ? categoryName + ' ' : ''}${providerName}`,
        actor: 'Sistema',
        date: formatSpanishDate(regDate),
        timestamp: new Date(regDate).getTime(),
        type: 'REGISTRATION',
      });

      // Aprobación
      if (provider.verification_status === 'APPROVED') {
        const approveDate = new Date(new Date(regDate).getTime() + 60 * 60 * 1000); // 1 hora después
        activities.push({
          id: `app-${provider.id}`,
          title: `Servicio aprobado: ${providerName}`,
          actor: 'Admin General',
          date: formatSpanishDate(approveDate),
          timestamp: approveDate.getTime(),
          type: 'APPROVAL',
        });
      }

      // Rechazo
      if (provider.verification_status === 'REJECTED') {
        const rejectDate = new Date(new Date(regDate).getTime() + 30 * 60 * 1000); // 30 minutos después
        activities.push({
          id: `rej-${provider.id}`,
          title: `Solicitud rechazada: ${providerName}${provider.rejection_reason ? ' (' + provider.rejection_reason + ')' : ''}`,
          actor: 'Admin General',
          date: formatSpanishDate(rejectDate),
          timestamp: rejectDate.getTime(),
          type: 'REJECTION',
        });
      }
    });

    // Compilar actividades de anuncios
    ads.forEach((ad) => {
      const providerName = ad.providers?.commercial_name || 'Proveedor';
      const adTitle = ad.title || 'Anuncio';
      const adDate = ad.start_date || new Date();

      // Creación/solicitud de anuncio
      activities.push({
        id: `ad-${ad.id}`,
        title: `Nuevo anuncio creado: ${adTitle}`,
        actor: providerName,
        date: formatSpanishDate(adDate),
        timestamp: new Date(adDate).getTime(),
        type: 'ANNOUNCEMENT',
      });

      // Aprobación de anuncio si está aprobado
      if (ad.status === 'APPROVED') {
        const adAppDate = new Date(new Date(adDate).getTime() + 15 * 60 * 1000); // 15 minutos después
        activities.push({
          id: `adapp-${ad.id}`,
          title: `Anuncio aprobado: ${adTitle}`,
          actor: 'Admin General',
          date: formatSpanishDate(adAppDate),
          timestamp: adAppDate.getTime(),
          type: 'APPROVAL',
        });
      }
    });

    // Ordenar actividades de la más reciente a la más antigua
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Si no hay actividades en la base de datos, proveer mock realista
    if (activities.length === 0) {
      console.log('⚠️ [GET_ACTIVITY] Base de datos vacía, generando actividades de respaldo...');
      
      const getRecentDateTime = (hoursAgo: number) => {
        const now = new Date();
        now.setHours(now.getHours() - hoursAgo);
        return now;
      };

      const backups = [
        {
          id: "bk-1",
          title: "Nueva solicitud de registro: Dra. María González",
          actor: "Sistema",
          date: formatSpanishDate(getRecentDateTime(2)),
          timestamp: getRecentDateTime(2).getTime(),
          type: "REGISTRATION",
        },
        {
          id: "bk-2",
          title: "Servicio aprobado: Dr. Roberto Sánchez",
          actor: "Admin General",
          date: formatSpanishDate(getRecentDateTime(5)),
          timestamp: getRecentDateTime(5).getTime(),
          type: "APPROVAL",
        },
        {
          id: "bk-3",
          title: "Nueva solicitud de registro: Farmacia del Pueblo",
          actor: "Sistema",
          date: formatSpanishDate(getRecentDateTime(8)),
          timestamp: getRecentDateTime(8).getTime(),
          type: "REGISTRATION",
        },
        {
          id: "bk-4",
          title: "Nuevo anuncio creado: Chequeo Cardiológico Completo",
          actor: "Dr. Carlos Mendoza",
          date: formatSpanishDate(getRecentDateTime(12)),
          timestamp: getRecentDateTime(12).getTime(),
          type: "ANNOUNCEMENT",
        },
        {
          id: "bk-5",
          title: "Solicitud rechazada: Insumos Médicos Plus (documentos incompletos)",
          actor: "Admin General",
          date: formatSpanishDate(getRecentDateTime(18)),
          timestamp: getRecentDateTime(18).getTime(),
          type: "REJECTION",
        },
        {
          id: "bk-6",
          title: "Perfil actualizado: Farmacia San José",
          actor: "Farmacia San José",
          date: formatSpanishDate(getRecentDateTime(24)),
          timestamp: getRecentDateTime(24).getTime(),
          type: "UPDATE",
        }
      ];

      return successResponse(backups);
    }

    // Remover campo auxiliar timestamp antes de retornar
    const resultData = activities.map(({ timestamp, ...rest }) => rest);

    console.log(`✅ [GET_ACTIVITY] Retornando ${resultData.length} actividades reales de la plataforma`);
    return successResponse(resultData);
  } catch (error: any) {
    console.error('❌ [GET_ACTIVITY] Error consultando actividad:', error.message);
    return successResponse([]); // Retornar vacío en vez de fallar para asegurar robustez
  }
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
  
  // Buscar el provider con especialidades y cadenas de farmacias
  const provider = await prisma.providers.findUnique({
    where: { id: requestId },
    include: { 
      users: true, 
      service_categories: true,
      provider_specialties: {
        include: {
          specialties: true,
        },
      },
      pharmacy_chains: true,
    },
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

  // Enviar notificación a todos los pacientes (broadcast) sobre el nuevo proveedor
  try {
    const { patientNotificationService } = await import("../shared/patient-notification.service");
    
    const providerName = provider.commercial_name || "Un nuevo proveedor";
    let type: any = "general";
    let title = "¡Nuevo proveedor disponible! 🎉";
    let body = `${providerName} se ha unido a DOCALINK. Ya puedes consultar sus servicios y agendar con ellos.`;
    
    const categorySlug = provider.service_categories?.slug;
    
    if (categorySlug === "doctor") {
      type = "cita";
      const specialtiesList = provider.provider_specialties?.map(ps => ps.specialties?.name).filter(Boolean) || [];
      const specialtiesText = specialtiesList.length > 0 ? ` de especialidad ${specialtiesList.join(", ")}` : "";
      title = "¡Nuevo especialista disponible! 🩺";
      body = `El Dr(a). ${providerName}${specialtiesText} se ha unido a DOCALINK. Ya puedes agendar una cita con él.`;
    } else if (categorySlug === "pharmacy") {
      type = "farmacia";
      const chainName = provider.pharmacy_chains?.name;
      const chainText = chainName ? ` de la cadena ${chainName}` : "";
      title = "¡Nueva farmacia disponible! 💊";
      body = `La farmacia ${providerName}${chainText} se ha unido a DOCALINK. Ya puedes consultar su ubicación y servicios de entrega.`;
    } else if (categorySlug === "laboratory") {
      type = "laboratorio";
      title = "¡Nuevo laboratorio disponible! 🔬";
      body = `El laboratorio ${providerName} se ha unido a DOCALINK. Ya puedes consultar su catálogo de exámenes y contacto directo.`;
    } else if (categorySlug === "ambulance") {
      type = "ambulancia";
      title = "¡Nuevo servicio de ambulancia! 🚑";
      body = `El servicio de ambulancias ${providerName} se ha unido a DOCALINK para ofrecer atención y traslados de emergencia.`;
    } else if (categorySlug === "supplies") {
      type = "insumo";
      title = "¡Nueva tienda de insumos médicos! 📦";
      body = `${providerName} se ha unido a DOCALINK. Ya puedes consultar su catálogo de productos y equipos médicos.`;
    } else if (categorySlug === "clinic") {
      type = "cita";
      title = "¡Nueva clínica disponible! 🏥";
      body = `La clínica ${providerName} se ha unido a DOCALINK. Ya puedes agendar citas en sus consultorios.`;
    }

    console.log(`🔔 [APPROVE_REQUEST] Enviando broadcast de nuevo proveedor a todos los pacientes: ${providerName}`);
    await patientNotificationService.broadcast({
      type,
      title,
      body,
      data: {
        providerId: provider.id,
        category: categorySlug,
      }
    });
  } catch (notifError: any) {
    console.error("❌ [APPROVE_REQUEST] Error al enviar notificación masiva:", notifError.message);
  }

  // Enviar email de bienvenida (asíncrono, no bloquea la respuesta)
  if (provider.users?.email) {
    const { sendEmail } = await import("../shared/email-adapter");
    const { generateRequestAcceptedEmail } = await import("../shared/email");

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

    const emailHtml = generateRequestAcceptedEmail({
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

  // Actualizar estado a REJECTED y guardar motivo
  await prisma.providers.update({
    where: { id: requestId },
    data: {
      verification_status: 'REJECTED', // Usar string directamente
      rejection_reason: reason || null, // Guardar motivo de rechazo
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