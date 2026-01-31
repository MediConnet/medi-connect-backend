import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';
import { extractIdFromPath } from '../shared/validators';

/**
 * Listar marcas de farmacias
 * GET /api/public/pharmacies/brands
 */
export async function getPharmacyBrands(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC PHARMACIES] GET /api/public/pharmacies/brands - Listando marcas');
  
  try {
    const prisma = getPrismaClient();
    
    // Obtener providers de tipo farmacia
    const pharmacies = await prisma.providers.findMany({
      where: {
        service_categories: {
          slug: 'pharmacy',
        },
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
        provider_branches: {
          some: {
            is_active: true,
          },
        },
      },
      select: {
        id: true,
        commercial_name: true,
        logo_url: true,
      },
      orderBy: {
        commercial_name: 'asc',
      },
    });
    
    // Obtener marcas únicas por commercial_name
    const uniqueBrandsMap = new Map<string, { id: string; nombre: string; logo: string }>();
    pharmacies.forEach(pharmacy => {
      const name = pharmacy.commercial_name || '';
      if (name && !uniqueBrandsMap.has(name)) {
        uniqueBrandsMap.set(name, {
          id: pharmacy.id,
          nombre: name,
          logo: pharmacy.logo_url || '',
        });
      }
    });
    
    // Transformar a formato de marcas
    const brands = Array.from(uniqueBrandsMap.values()).map(brand => ({
      id: brand.id,
      nombre: brand.nombre,
      logo: brand.logo,
      color: '#002F87', // Color por defecto, puede venir de la DB en el futuro
    }));
    
    console.log(`✅ [PUBLIC PHARMACIES] Se encontraron ${brands.length} marcas`);
    return successResponse(brands, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC PHARMACIES] Error al listar marcas:', error.message);
    logger.error('Error fetching pharmacy brands', error);
    return internalErrorResponse('Failed to fetch pharmacy brands', event);
  }
}

/**
 * Listar sucursales por marca
 * GET /api/public/pharmacies/brands/{brandId}/branches
 */
export async function getPharmacyBranches(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC PHARMACIES] GET /api/public/pharmacies/brands/{brandId}/branches - Listando sucursales');
  
  try {
    const brandId = extractIdFromPath(event.requestContext.http.path, '/api/public/pharmacies/brands/', '/branches');
    
    if (!brandId) {
      return errorResponse('Brand ID is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};
    
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;
    const city = queryParams.city;
    const hasDelivery = queryParams.hasDelivery === 'true';
    
    // Construir where
    const where: any = {
      provider_id: brandId,
      is_active: true,
    };
    
    if (city) {
      where.cities = {
        name: {
          contains: city,
          mode: 'insensitive',
        },
      };
    }
    
    if (hasDelivery) {
      where.has_delivery = true;
    }
    
    const [branches, total] = await Promise.all([
      prisma.provider_branches.findMany({
        where,
        include: {
          cities: {
            select: {
              id: true,
              name: true,
            },
          },
          providers: {
            select: {
              id: true,
              commercial_name: true,
              logo_url: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.provider_branches.count({ where }),
    ]);
    
    const formattedBranches = branches.map(branch => ({
      id: branch.id,
      brandId: branch.provider_id,
      nombre: branch.name || '',
      descripcion: branch.description || '',
      categorias: [], // No disponible en schema actual
      direccion: branch.address_text || '',
      ciudad: branch.cities?.name || '',
      codigoPostal: '', // No disponible
      telefono: branch.phone_contact || '',
      horarioAtencion: branch.opening_hours_text || '',
      calificacion: branch.rating_cache || 0,
      disponible24h: branch.is_24h || false,
      hasDelivery: branch.has_delivery || false,
      email: branch.email_contact || '',
      imagen: branch.image_url || '',
      latitud: branch.latitude || null,
      longitud: branch.longitude || null,
    }));
    
    console.log(`✅ [PUBLIC PHARMACIES] Se encontraron ${formattedBranches.length} sucursales (total: ${total})`);
    
    return successResponse({
      branches: formattedBranches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC PHARMACIES] Error al listar sucursales:', error.message);
    logger.error('Error fetching pharmacy branches', error);
    return internalErrorResponse('Failed to fetch pharmacy branches', event);
  }
}

/**
 * Obtener sucursal por ID
 * GET /api/public/pharmacies/branches/{id}
 */
export async function getPharmacyBranchById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC PHARMACIES] GET /api/public/pharmacies/branches/{id} - Obteniendo sucursal');
  
  try {
    const branchId = extractIdFromPath(event.requestContext.http.path, '/api/public/pharmacies/branches/');
    
    if (!branchId) {
      return errorResponse('Branch ID is required', 400, undefined, event);
    }
    
    const prisma = getPrismaClient();
    
    const branch = await prisma.provider_branches.findFirst({
      where: {
        id: branchId,
        is_active: true,
        providers: {
          service_categories: {
            slug: 'pharmacy',
          },
          verification_status: 'APPROVED',
          users: {
            is_active: true,
          },
        },
      },
      include: {
        cities: {
          select: {
            id: true,
            name: true,
            state: true,
          },
        },
        providers: {
          select: {
            id: true,
            commercial_name: true,
            logo_url: true,
          },
        },
        provider_schedules: {
          where: {
            is_active: true,
          },
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });
    
    if (!branch) {
      return errorResponse('Branch not found', 404, undefined, event);
    }
    
    const formattedBranch = {
      id: branch.id,
      brandId: branch.provider_id,
      nombre: branch.name || '',
      descripcion: branch.description || '',
      categorias: [],
      direccion: branch.address_text || '',
      ciudad: branch.cities?.name || '',
      codigoPostal: '',
      telefono: branch.phone_contact || '',
      horarioAtencion: branch.opening_hours_text || '',
      calificacion: branch.rating_cache || 0,
      disponible24h: branch.is_24h || false,
      hasDelivery: branch.has_delivery || false,
      email: branch.email_contact || '',
      imagen: branch.image_url || '',
      latitud: branch.latitude || null,
      longitud: branch.longitude || null,
    };
    
    console.log(`✅ [PUBLIC PHARMACIES] Sucursal encontrada: ${formattedBranch.nombre}`);
    return successResponse(formattedBranch, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC PHARMACIES] Error al obtener sucursal:', error.message);
    logger.error('Error fetching pharmacy branch by id', error);
    return internalErrorResponse('Failed to fetch pharmacy branch', event);
  }
}

/**
 * Listar todas las farmacias (alternativa)
 * GET /api/public/pharmacies
 */
export async function getAllPharmacies(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC PHARMACIES] GET /api/public/pharmacies - Listando todas las farmacias');
  
  try {
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};
    
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;
    
    const [pharmacies, total] = await Promise.all([
      prisma.providers.findMany({
        where: {
          service_categories: {
            slug: 'pharmacy',
          },
          verification_status: 'APPROVED',
          users: {
            is_active: true,
          },
          provider_branches: {
            some: {
              is_active: true,
            },
          },
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
        orderBy: {
          commercial_name: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.providers.count({
        where: {
          service_categories: {
            slug: 'pharmacy',
          },
          verification_status: 'APPROVED',
          users: {
            is_active: true,
          },
          provider_branches: {
            some: {
              is_active: true,
            },
          },
        },
      }),
    ]);
    
    const formattedPharmacies = pharmacies.map(pharmacy => {
      const mainBranch = pharmacy.provider_branches[0];
      return {
        id: pharmacy.id,
        nombre: pharmacy.commercial_name || '',
        logo: pharmacy.logo_url || '',
        ciudad: mainBranch?.cities?.name || '',
        sucursales: 0, // Se puede calcular si es necesario
      };
    });
    
    return successResponse({
      pharmacies: formattedPharmacies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC PHARMACIES] Error al listar farmacias:', error.message);
    logger.error('Error fetching all pharmacies', error);
    return internalErrorResponse('Failed to fetch pharmacies', event);
  }
}

