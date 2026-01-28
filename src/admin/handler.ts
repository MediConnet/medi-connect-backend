import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole, AuthContext } from '../shared/auth';
import { enum_roles, enum_verification } from '../generated/prisma/client';
import { approveRequestSchema, rejectRequestSchema, parseBody } from '../shared/validators';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

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

    // POST /api/providers/register - Recibir solicitud de registro de proveedor
    if (method === 'POST' && path === '/api/providers/register') {
      console.log('✅ [ADMIN] POST /api/providers/register - Recibiendo solicitud de registro');
      const result = await registerProviderRequest(event);
      console.log(`✅ [ADMIN] POST /api/providers/register - Completado con status ${result.statusCode}`);
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

async function registerProviderRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📝 [REGISTER_PROVIDER_REQUEST] Recibiendo solicitud de registro de proveedor');
  try {
    // Schema para validar los datos de registro (actualizado para incluir clinic)
    const registerProviderSchema = z.object({
      type: z.enum(['clinic', 'doctor', 'pharmacy', 'laboratory', 'ambulance', 'supplies'], {
        errorMap: () => ({ message: 'Type must be one of: clinic, doctor, pharmacy, laboratory, ambulance, supplies' })
      }),
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email format'),
      password: z.string().min(6, 'Password must be at least 6 characters').max(50, 'Password must be at most 50 characters'),
      phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').optional(),
      whatsapp: z.string().regex(/^\d{10}$/, 'WhatsApp must be exactly 10 digits').optional(),
      serviceName: z.string().min(1, 'Service name is required'),
      address: z.string().optional(),
      city: z.string().min(1, 'City is required'),
      price: z.string().optional(), // String vacío "" para todos excepto doctor
      description: z.string().optional(),
      chainId: z.string().optional(), // Solo para farmacias
      // Campos adicionales opcionales (pueden no venir)
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      openingHours: z.string().optional(),
      is24h: z.boolean().optional(),
      hasDelivery: z.boolean().optional(),
      logoUrl: z.string().url().optional().or(z.literal('')),
      // Documentos PDF
      documents: z.array(z.object({
        name: z.string().min(1, 'Document name is required'),
        type: z.enum(['license', 'certificate', 'degree']), // licencia, certificado, titulo
        url: z.string().url('Document URL must be a valid URL'),
      })).optional(),
    });

    const body = parseBody(event.body, registerProviderSchema);
    const prisma = getPrismaClient();

    console.log('📝 [REGISTER_PROVIDER_REQUEST] Datos recibidos:', {
      name: body.name,
      email: body.email,
      type: body.type,
      city: body.city,
      address: body.address || 'No proporcionada',
      hasCoordinates: !!(body.latitude && body.longitude),
      hasLogo: !!body.logoUrl,
      hasOpeningHours: !!body.openingHours,
      documentsCount: body.documents?.length || 0,
    });

    // 1. Buscar o crear ciudad
    let city = await prisma.cities.findFirst({
      where: {
        name: {
          equals: body.city,
          mode: 'insensitive',
        },
      },
    });

    if (!city) {
      console.log(`📍 [REGISTER_PROVIDER_REQUEST] Creando ciudad: ${body.city}`);
      city = await prisma.cities.create({
        data: {
          id: randomUUID(),
          name: body.city,
          country: 'Ecuador',
        },
      });
    }

    // 2. Buscar categoría de servicio por slug
    const categorySlug = body.type.toLowerCase();
    let category = await prisma.service_categories.findFirst({
      where: { slug: categorySlug },
    });

    if (!category) {
      console.log(`🏷️ [REGISTER_PROVIDER_REQUEST] Creando categoría: ${categorySlug}`);
      // Mapear nombres de categorías
      const categoryNames: Record<string, string> = {
        'clinic': 'Clínica',
        'doctor': 'Doctor',
        'pharmacy': 'Farmacia',
        'laboratory': 'Laboratorio',
        'ambulance': 'Ambulancia',
        'supplies': 'Insumos Médicos',
      };
      
      category = await prisma.service_categories.create({
        data: {
          name: categoryNames[categorySlug] || body.type.charAt(0).toUpperCase() + body.type.slice(1),
          slug: categorySlug,
          allows_booking: body.type === 'doctor' || body.type === 'ambulance', // Clínicas no permiten booking directo
        },
      });
    }

    // 3. Buscar o crear usuario
    let user = await prisma.users.findFirst({
      where: { email: body.email },
    });

    if (!user) {
      console.log(`👤 [REGISTER_PROVIDER_REQUEST] Creando usuario: ${body.email}`);
      // Usar la contraseña enviada por el usuario
      const passwordHash = await bcrypt.hash(body.password, 10);

      // En desarrollo, crear usuarios activos para poder probar inmediatamente
      // En producción, crear inactivos hasta aprobación del admin
      const isDevelopment = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development';
      const isActive = isDevelopment;

      user = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: body.email,
          password_hash: passwordHash,
          role: enum_roles.provider,
          is_active: isActive, // Activo en desarrollo, inactivo en producción
        },
      });
      
      if (isActive) {
        console.log(`✅ [REGISTER_PROVIDER_REQUEST] Usuario creado como ACTIVO (modo desarrollo)`);
      } else {
        console.log(`⚠️ [REGISTER_PROVIDER_REQUEST] Usuario creado como INACTIVO (modo producción - requiere aprobación)`);
      }
    } else if (user.role !== enum_roles.provider) {
      // Si el usuario existe pero no es provider, actualizar su rol
      user = await prisma.users.update({
        where: { id: user.id },
        data: { role: enum_roles.provider },
      });
    }

    // 4. Verificar si ya existe un provider para este usuario
    const existingProvider = await prisma.providers.findFirst({
      where: { user_id: user.id },
    });

    if (existingProvider) {
      console.log(`⚠️ [REGISTER_PROVIDER_REQUEST] Ya existe un provider para este usuario`);
      // Si ya existe pero está rechazado, actualizar a PENDING
      if (existingProvider.verification_status === 'REJECTED') {
        await prisma.providers.update({
          where: { id: existingProvider.id },
          data: {
            verification_status: 'PENDING', // Usar string directamente
            commercial_name: body.serviceName,
            description: body.description || null,
          },
        });
        console.log(`✅ [REGISTER_PROVIDER_REQUEST] Provider actualizado a PENDING`);
        return successResponse({ 
          success: true, 
          message: 'Solicitud de registro enviada exitosamente',
          providerId: existingProvider.id,
        });
      }
      return errorResponse('Ya existe una solicitud para este usuario', 409);
    }

    // 5. Procesar documentos si existen
    let documentsInfo = null;
    if (body.documents && body.documents.length > 0) {
      console.log(`📄 [REGISTER_PROVIDER_REQUEST] Procesando ${body.documents.length} documento(s)`);
      documentsInfo = body.documents.map((doc, index) => ({
        id: index + 1,
        name: doc.name,
        type: doc.type,
        url: doc.url,
      }));
      // Loggear tipos de documentos recibidos
      const docTypes = body.documents.map(d => d.type).join(', ');
      console.log(`📄 [REGISTER_PROVIDER_REQUEST] Tipos de documentos: ${docTypes}`);
    }

    // 6. Crear provider con estado PENDING
    console.log(`🏥 [REGISTER_PROVIDER_REQUEST] Creando provider con estado PENDING`);
    const provider = await prisma.providers.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        category_id: category.id,
        commercial_name: body.serviceName,
        description: body.description || null,
        logo_url: body.logoUrl && body.logoUrl !== '' ? body.logoUrl : null,
        verification_status: 'PENDING', // Usar string directamente (el campo es String? en el schema)
        commission_percentage: 15.0,
      },
    });
    
    // Verificar que se guardó correctamente
    const savedProvider = await prisma.providers.findUnique({
      where: { id: provider.id },
      select: { id: true, verification_status: true, commercial_name: true },
    });
    console.log(`✅ [REGISTER_PROVIDER_REQUEST] Provider creado y verificado:`, {
      id: savedProvider?.id,
      name: savedProvider?.commercial_name,
      status: savedProvider?.verification_status,
      statusType: typeof savedProvider?.verification_status,
    });

    // 7. Crear sucursal principal (siempre se crea, con o sin dirección)
    console.log(`🏪 [REGISTER_PROVIDER_REQUEST] Creando sucursal principal`);
    await prisma.provider_branches.create({
      data: {
        id: randomUUID(),
        provider_id: provider.id,
        city_id: city.id,
        name: body.serviceName,
        address_text: body.address || null,
        phone_contact: body.phone || body.whatsapp || null,
        email_contact: body.email,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        opening_hours_text: body.openingHours || null,
        is_24h: body.is24h || false,
        has_delivery: body.hasDelivery || false,
        is_main: true,
        is_active: false, // Inactiva hasta aprobación
      },
    });

    // Si es clínica, crear registro en tabla clinics
    if (body.type === 'clinic') {
      console.log('🏥 [REGISTER_PROVIDER_REQUEST] Creando registro de clínica');
      
      await prisma.clinics.upsert({
        where: { user_id: user.id },
        update: {
          name: body.serviceName,
          address: body.address || 'Dirección no especificada',
          phone: body.phone || body.whatsapp || '0000000000',
          whatsapp: body.whatsapp || body.phone || '0000000000',
          description: body.description || '',
          is_active: false, // Inactiva hasta aprobación del admin
        },
        create: {
          id: randomUUID(),
          user_id: user.id,
          name: body.serviceName,
          address: body.address || 'Dirección no especificada',
          phone: body.phone || body.whatsapp || '0000000000',
          whatsapp: body.whatsapp || body.phone || '0000000000',
          description: body.description || '',
          is_active: false, // Inactiva hasta aprobación del admin
        },
      });
      
      console.log('✅ [REGISTER_PROVIDER_REQUEST] Registro de clínica creado');
    }

    console.log(`✅ [REGISTER_PROVIDER_REQUEST] Solicitud creada exitosamente. Provider ID: ${provider.id}`);
    return successResponse({
      success: true,
      message: 'Solicitud de registro enviada exitosamente',
      providerId: provider.id,
      documentsReceived: documentsInfo ? documentsInfo.length : 0,
      documents: documentsInfo || [],
    }, 201);
  } catch (error: any) {
    console.error('❌ [REGISTER_PROVIDER_REQUEST] Error:', error.message);
    logger.error('Error registering provider request', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to register provider request');
  }
}

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
  const statusCounts = allProviders.reduce((acc, p) => {
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
          phone_contact: true,
        },
        take: 1, // Solo la primera sucursal
      },
    },
    // Ordenar por ID (más recientes primero, asumiendo que IDs más grandes son más recientes)
    // En el futuro, cuando se agregue created_at a providers, usar ese campo
    orderBy: {
      id: 'desc',
    },
    take: limit,
    skip: offset,
  });

  // Obtener ciudades para mapear
  const cityIds = providers
    .flatMap(p => p.provider_branches.map(b => b.city_id))
    .filter((id): id is string => id !== null);
  
  const cities = await prisma.cities.findMany({
    where: {
      id: { in: cityIds },
    },
  });

  const cityMap = new Map(cities.map(c => [c.id, c]));

  // Mapear a la estructura esperada por el frontend
  const requests = providers.map((provider) => {
    const branch = provider.provider_branches[0];
    const city = branch?.city_id ? cityMap.get(branch.city_id) : null;

    return {
      id: provider.id,
      providerName: provider.commercial_name || 'Sin nombre',
      email: provider.users?.email || '',
      avatarUrl: provider.users?.profile_picture_url || undefined,
      serviceType: provider.service_categories?.slug || provider.service_categories?.name?.toLowerCase() || 'doctor',
      submissionDate: provider.users?.created_at 
        ? new Date(provider.users.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      documentsCount: 0, // TODO: Implementar cuando exista modelo de documentos
      status: provider.verification_status === 'APPROVED' ? 'APPROVED' :
              provider.verification_status === 'REJECTED' ? 'REJECTED' :
              'PENDING',
      rejectionReason: null, // TODO: Agregar campo de razón de rechazo
      phone: branch?.phone_contact || '',
      whatsapp: branch?.phone_contact || '',
      city: city?.name || 'Sin ciudad',
      address: branch?.address_text || '',
      description: provider.description || '',
      documents: [], // TODO: Implementar cuando exista modelo de documentos
    };
  });

    console.log(`✅ [GET_REQUESTS] Retornando ${requests.length} solicitudes`);
    console.log(`🔍 [GET_REQUESTS] IDs de providers encontrados:`, providers.map(p => ({ id: p.id, name: p.commercial_name, status: p.verification_status })));
  return successResponse(requests);
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
  const prisma = getPrismaClient();
  
  // Buscar el provider
  const provider = await prisma.providers.findUnique({
    where: { id: requestId },
    include: { users: true },
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

function extractIdFromPath(path: string, prefix: string, suffix: string): string {
  const start = prefix.length;
  const end = path.indexOf(suffix);
  if (end === -1) {
    throw new Error('Invalid path format');
  }
  return path.substring(start, end);
}
