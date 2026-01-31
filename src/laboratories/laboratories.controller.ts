import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';

/**
 * Listar laboratorios
 * GET /api/laboratories
 */
export async function getAllLaboratories(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [LABORATORIES] GET /api/laboratories - Listando laboratorios');
  
  try {
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};
    
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;
    const city = queryParams.city;
    const search = queryParams.search;
    
    // Construir where
    const where: any = {
      verification_status: 'APPROVED',
      users: {
        is_active: true,
      },
      service_categories: {
        slug: 'laboratory',
      },
      provider_branches: {
        some: {
          is_active: true,
        },
      },
    };
    
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
    
    const [laboratories, total] = await Promise.all([
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
              is_main: true,
              is_active: true,
            },
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
    
    const formattedLaboratories = laboratories.map(lab => {
      const mainBranch = lab.provider_branches[0];
      
      return {
        id: lab.id,
        nombre: lab.commercial_name || '',
        descripcion: lab.description || '',
        direccion: mainBranch?.address_text || '',
        ciudad: mainBranch?.cities?.name || '',
        codigoPostal: '',
        telefono: mainBranch?.phone_contact || '',
        email: lab.users?.email || mainBranch?.email_contact || '',
        horarioAtencion: mainBranch?.opening_hours_text || '',
        latitud: mainBranch?.latitude || null,
        longitud: mainBranch?.longitude || null,
        imagen: lab.logo_url || mainBranch?.image_url || '',
        calificacion: mainBranch?.rating_cache || 0,
        servicios: [], // Se puede obtener de provider_catalog si es necesario
        examenes: [], // Se puede obtener de provider_catalog si es necesario
        whatsapp: mainBranch?.phone_contact || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
    
    console.log(`✅ [LABORATORIES] Se encontraron ${formattedLaboratories.length} laboratorios (total: ${total})`);
    
    return successResponse({
      laboratories: formattedLaboratories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [LABORATORIES] Error al listar laboratorios:', error.message);
    logger.error('Error fetching laboratories', error);
    return internalErrorResponse('Failed to fetch laboratories', event);
  }
}

/**
 * Obtener laboratorio por ID
 * GET /api/laboratories/{id}
 */
export async function getLaboratoryById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [LABORATORIES] GET /api/laboratories/{id} - Obteniendo laboratorio');
  
  try {
    const laboratoryId = extractIdFromPath(event.requestContext.http.path, '/api/laboratories/');
    
    if (!laboratoryId) {
      return errorResponse('Laboratory ID is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    
    const laboratory = await prisma.providers.findFirst({
      where: {
        id: laboratoryId,
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        service_categories: {
          slug: 'laboratory',
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
      },
      include: {
        users: {
          select: {
            email: true,
          },
        },
        provider_branches: {
          where: {
            is_main: true,
            is_active: true,
          },
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
        provider_catalog: {
          where: {
            is_available: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            type: true,
          },
        },
      },
    });
    
    if (!laboratory) {
      return errorResponse('Laboratory not found', 404, undefined, event);
    }
    
    const mainBranch = laboratory.provider_branches[0];
    
    // Separar servicios y exámenes del catálogo
    const servicios: string[] = [];
    const examenes: string[] = [];
    
    laboratory.provider_catalog.forEach(item => {
      if (item.type === 'service') {
        servicios.push(item.name || '');
      } else if (item.type === 'exam' || item.type === 'test') {
        examenes.push(item.name || '');
      }
    });
    
    const formattedLaboratory = {
      id: laboratory.id,
      nombre: laboratory.commercial_name || '',
      descripcion: laboratory.description || '',
      direccion: mainBranch?.address_text || '',
      ciudad: mainBranch?.cities?.name || '',
      codigoPostal: '',
      telefono: mainBranch?.phone_contact || '',
      email: laboratory.users?.email || mainBranch?.email_contact || '',
      horarioAtencion: mainBranch?.opening_hours_text || '',
      latitud: mainBranch?.latitude || null,
      longitud: mainBranch?.longitude || null,
      imagen: laboratory.logo_url || mainBranch?.image_url || '',
      calificacion: mainBranch?.rating_cache || 0,
      servicios,
      examenes,
      whatsapp: mainBranch?.phone_contact || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    console.log(`✅ [LABORATORIES] Laboratorio encontrado: ${formattedLaboratory.nombre}`);
    return successResponse(formattedLaboratory, 200, event);
  } catch (error: any) {
    console.error('❌ [LABORATORIES] Error al obtener laboratorio:', error.message);
    logger.error('Error fetching laboratory by id', error);
    return internalErrorResponse('Failed to fetch laboratory', event);
  }
}

/**
 * Buscar laboratorios
 * GET /api/laboratories/search?q={query}
 */
export async function searchLaboratories(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [LABORATORIES] GET /api/laboratories/search - Buscando laboratorios');
  
  try {
    const queryParams = event.queryStringParameters || {};
    const query = queryParams.q || queryParams.query || '';
    
    if (!query || query.trim().length === 0) {
      return errorResponse('Search query is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    
    const laboratories = await prisma.providers.findMany({
      where: {
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        service_categories: {
          slug: 'laboratory',
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
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
            is_main: true,
            is_active: true,
          },
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
    
    const formattedLaboratories = laboratories.map(lab => {
      const mainBranch = lab.provider_branches[0];
      return {
        id: lab.id,
        nombre: lab.commercial_name || '',
        descripcion: lab.description || '',
        direccion: mainBranch?.address_text || '',
        ciudad: mainBranch?.cities?.name || '',
        telefono: mainBranch?.phone_contact || '',
        horarioAtencion: mainBranch?.opening_hours_text || '',
        imagen: lab.logo_url || mainBranch?.image_url || '',
        calificacion: mainBranch?.rating_cache || 0,
      };
    });
    
    console.log(`✅ [LABORATORIES] Se encontraron ${formattedLaboratories.length} laboratorios para "${query}"`);
    return successResponse(formattedLaboratories, 200, event);
  } catch (error: any) {
    console.error('❌ [LABORATORIES] Error al buscar laboratorios:', error.message);
    logger.error('Error searching laboratories', error);
    return internalErrorResponse('Failed to search laboratories', event);
  }
}

