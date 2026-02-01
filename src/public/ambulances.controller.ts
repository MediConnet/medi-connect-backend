import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';

/**
 * Listar ambulancias públicas (sin autenticación)
 * GET /api/ambulances
 */
export async function getAllAmbulances(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC AMBULANCES] GET /api/ambulances - Listando ambulancias públicas');
  
  try {
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};
    
    // Parámetros de paginación
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;
    
    // Filtros
    const city = queryParams.city;
    const search = queryParams.search;
    
    // Construir where clause
    const where: any = {
      category_id: 4, // Ambulancias (category_id = 4)
      verification_status: 'APPROVED',
      users: {
        is_active: true,
      },
      // Removido filtro de provider_branches para permitir ambulancias sin sucursales
    };
    
    // Filtrar por ciudad (a través de branches)
    if (city) {
      where.provider_branches = {
        some: {
          is_active: true,
          cities: {
            name: {
              contains: city,
              mode: 'insensitive',
            },
          },
        },
      };
    }
    
    // Búsqueda por nombre o descripción
    if (search) {
      where.OR = [
        {
          commercial_name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          provider_branches: {
            some: {
              address_text: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }
    
    // Obtener ambulancias
    const [ambulances, total] = await Promise.all([
      prisma.providers.findMany({
        where,
        include: {
          users: {
            select: {
              email: true,
            },
          },
          provider_branches: {
            where: {
              is_active: true,
            },
            orderBy: [
              { is_main: 'desc' }, // Priorizar sucursal principal
            ],
            take: 1,
            include: {
              cities: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          commercial_name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.providers.count({ where }),
    ]);
    
    // Transformar datos para el frontend
    const formattedAmbulances = ambulances.map(ambulance => {
      const mainBranch = ambulance.provider_branches[0];
      const horarioAtencion = mainBranch?.opening_hours_text || '24 horas';
      const disponible24h = horarioAtencion.toLowerCase().includes('24') || horarioAtencion.toLowerCase().includes('24 horas');
      
      return {
        id: ambulance.id,
        nombre: ambulance.commercial_name || '',
        descripcion: ambulance.description || '',
        direccion: mainBranch?.address_text || '',
        ciudad: mainBranch?.cities?.name || '',
        codigoPostal: '',
        telefono: mainBranch?.phone_contact || '',
        email: ambulance.users?.email || mainBranch?.email_contact || '',
        horarioAtencion: horarioAtencion,
        latitud: mainBranch?.latitude || null,
        longitud: mainBranch?.longitude || null,
        imagen: ambulance.logo_url || mainBranch?.image_url || '',
        calificacion: mainBranch?.rating_cache || 0,
        disponible24h: disponible24h,
        tipo: 'Ambulancia',
        zonaCobertura: mainBranch?.cities?.name ? `Área metropolitana de ${mainBranch.cities.name}` : 'Área metropolitana',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    
    console.log(`✅ [PUBLIC AMBULANCES] Se encontraron ${formattedAmbulances.length} ambulancias (total: ${total})`);
    
    return successResponse({
      ambulances: formattedAmbulances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC AMBULANCES] Error al listar ambulancias:', error.message);
    logger.error('Error fetching public ambulances', error);
    return internalErrorResponse('Failed to fetch ambulances', event);
  }
}

/**
 * Obtener ambulancia pública por ID
 * GET /api/ambulances/{id}
 */
export async function getAmbulanceById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC AMBULANCES] GET /api/ambulances/{id} - Obteniendo ambulancia');
  
  try {
    const ambulanceId = extractIdFromPath(event.requestContext.http.path, '/api/ambulances/');
    
    if (!ambulanceId) {
      return errorResponse('Ambulance ID is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    
    const ambulance = await prisma.providers.findFirst({
      where: {
        id: ambulanceId,
        category_id: 4, // Ambulancias (category_id = 4)
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        // Removido filtro de provider_branches para permitir ambulancias sin sucursales
      },
      include: {
        users: {
          select: {
            email: true,
          },
        },
        provider_branches: {
          where: {
            is_active: true,
          },
          orderBy: [
            { is_main: 'desc' }, // Priorizar sucursal principal
          ],
          take: 1,
          include: {
            cities: {
              select: {
                id: true,
                name: true,
                state: true,
              },
            },
          },
        },
      },
    });
    
    if (!ambulance) {
      return errorResponse('Ambulance not found', 404, undefined, event);
    }
    
    const mainBranch = ambulance.provider_branches[0];
    const horarioAtencion = mainBranch?.opening_hours_text || '24 horas';
    const disponible24h = horarioAtencion.toLowerCase().includes('24') || horarioAtencion.toLowerCase().includes('24 horas');
    
    const formattedAmbulance = {
      id: ambulance.id,
      nombre: ambulance.commercial_name || '',
      descripcion: ambulance.description || '',
      direccion: mainBranch?.address_text || '',
      ciudad: mainBranch?.cities?.name || '',
      codigoPostal: '',
      telefono: mainBranch?.phone_contact || '',
      email: ambulance.users?.email || mainBranch?.email_contact || '',
      horarioAtencion: horarioAtencion,
      latitud: mainBranch?.latitude || null,
      longitud: mainBranch?.longitude || null,
      imagen: ambulance.logo_url || mainBranch?.image_url || '',
      calificacion: mainBranch?.rating_cache || 0,
      disponible24h: disponible24h,
      tipo: 'Ambulancia',
      zonaCobertura: mainBranch?.cities?.name ? `Área metropolitana de ${mainBranch.cities.name}` : 'Área metropolitana',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    console.log(`✅ [PUBLIC AMBULANCES] Ambulancia encontrada: ${formattedAmbulance.nombre}`);
    return successResponse(formattedAmbulance, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC AMBULANCES] Error al obtener ambulancia:', error.message);
    logger.error('Error fetching ambulance by id', error);
    return internalErrorResponse('Failed to fetch ambulance', event);
  }
}

/**
 * Buscar ambulancias
 * GET /api/ambulances/search?q={query}
 */
export async function searchAmbulances(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC AMBULANCES] GET /api/ambulances/search - Buscando ambulancias');
  
  try {
    const queryParams = event.queryStringParameters || {};
    const query = queryParams.q || queryParams.query || '';
    
    if (!query || query.trim().length === 0) {
      return errorResponse('Search query is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    
    const ambulances = await prisma.providers.findMany({
      where: {
        category_id: 4, // Ambulancias (category_id = 4)
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        // Removido filtro de provider_branches para permitir ambulancias sin sucursales
        OR: [
          {
            commercial_name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            provider_branches: {
              some: {
                address_text: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            provider_branches: {
              some: {
                cities: {
                  name: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        provider_branches: {
          where: {
            is_active: true,
          },
          orderBy: [
            { is_main: 'desc' }, // Priorizar sucursal principal
          ],
          take: 1,
          include: {
            cities: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      take: 20,
    });
    
    const formattedAmbulances = ambulances.map(ambulance => {
      const mainBranch = ambulance.provider_branches[0];
      const horarioAtencion = mainBranch?.opening_hours_text || '24 horas';
      const disponible24h = horarioAtencion.toLowerCase().includes('24') || horarioAtencion.toLowerCase().includes('24 horas');
      
      return {
        id: ambulance.id,
        nombre: ambulance.commercial_name || '',
        descripcion: ambulance.description || '',
        direccion: mainBranch?.address_text || '',
        ciudad: mainBranch?.cities?.name || '',
        telefono: mainBranch?.phone_contact || '',
        horarioAtencion: horarioAtencion,
        imagen: ambulance.logo_url || mainBranch?.image_url || '',
        calificacion: mainBranch?.rating_cache || 0,
        disponible24h: disponible24h,
        tipo: 'Ambulancia',
        zonaCobertura: mainBranch?.cities?.name ? `Área metropolitana de ${mainBranch.cities.name}` : 'Área metropolitana',
      };
    });
    
    console.log(`✅ [PUBLIC AMBULANCES] Se encontraron ${formattedAmbulances.length} ambulancias para "${query}"`);
    return successResponse({
      ambulances: formattedAmbulances,
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC AMBULANCES] Error al buscar ambulancias:', error.message);
    logger.error('Error searching ambulances', error);
    return internalErrorResponse('Failed to search ambulances', event);
  }
}

