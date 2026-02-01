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
    
    // Intentar usar pharmacy_chains si está disponible
    try {
      // Primero verificar si hay cadenas en la tabla
      const chainsCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM pharmacy_chains WHERE is_active = true
      `.catch(() => null);
      
      if (chainsCount && chainsCount[0]?.count > 0) {
        console.log(`✅ [PUBLIC PHARMACIES] Encontradas ${chainsCount[0].count} cadenas activas en pharmacy_chains`);
        
        // Obtener todas las cadenas activas que tengan al menos un provider asociado
        // Usar LEFT JOIN para incluir cadenas aunque no tengan providers todavía
        const chains = await prisma.$queryRaw<Array<{
          id: string;
          name: string;
          logo_url: string | null;
        }>>`
          SELECT DISTINCT pc.id, pc.name, pc.logo_url
          FROM pharmacy_chains pc
          LEFT JOIN providers p ON p.chain_id = pc.id
          LEFT JOIN service_categories sc ON sc.id = p.category_id
          LEFT JOIN users u ON u.id = p.user_id
          LEFT JOIN provider_branches pb ON pb.provider_id = p.id AND pb.is_active = true
          WHERE pc.is_active = true
            AND (
              p.id IS NULL 
              OR (
                sc.slug = 'pharmacy'
                AND p.verification_status = 'APPROVED'
                AND u.is_active = true
                AND pb.id IS NOT NULL
              )
            )
          ORDER BY pc.name ASC
        `;
        
        console.log(`✅ [PUBLIC PHARMACIES] Consulta SQL retornó ${chains.length} cadenas`);
        
        // Si no hay resultados con la consulta compleja, obtener todas las cadenas activas
        let finalChains = chains;
        if (chains.length === 0) {
          console.log('⚠️ [PUBLIC PHARMACIES] No se encontraron cadenas con providers, obteniendo todas las cadenas activas');
          finalChains = await prisma.$queryRaw<Array<{
            id: string;
            name: string;
            logo_url: string | null;
          }>>`
            SELECT id, name, logo_url
            FROM pharmacy_chains
            WHERE is_active = true
            ORDER BY name ASC
          `;
        }
        
        // Transformar a formato de marcas
        const brands = finalChains.map(chain => ({
          id: chain.id,
          nombre: chain.name,
          logo: chain.logo_url || '',
          color: '#002F87', // Color por defecto ya que no existe color_hex en la tabla
        }));
        
        console.log(`✅ [PUBLIC PHARMACIES] Se encontraron ${brands.length} marcas desde pharmacy_chains`);
        return successResponse(brands, 200, event);
      } else {
        console.log('⚠️ [PUBLIC PHARMACIES] No hay cadenas activas en pharmacy_chains, usando fallback');
      }
    } catch (sqlError: any) {
      console.log('⚠️ [PUBLIC PHARMACIES] Error al consultar pharmacy_chains:', sqlError.message);
      console.log('⚠️ [PUBLIC PHARMACIES] Stack:', sqlError.stack);
    }
    
    // Fallback: usar providers
    return await getPharmacyBrandsFallback(prisma, event);
    
  } catch (error: any) {
    console.error('❌ [PUBLIC PHARMACIES] Error al listar marcas:', error.message);
    console.error('❌ [PUBLIC PHARMACIES] Stack:', error.stack);
    logger.error('Error fetching pharmacy brands', error);
    
    // Último intento con fallback
    try {
      const prisma = getPrismaClient();
      return await getPharmacyBrandsFallback(prisma, event);
    } catch (fallbackError: any) {
      return internalErrorResponse('Failed to fetch pharmacy brands', event);
    }
  }
}

// Método fallback usando providers (método anterior)
async function getPharmacyBrandsFallback(prisma: any, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('⚠️ [PUBLIC PHARMACIES] Usando método fallback con providers');
  
  try {
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
    pharmacies.forEach((pharmacy: any) => {
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
      color: '#002F87', // Color por defecto
    }));
    
    console.log(`✅ [PUBLIC PHARMACIES] Fallback: Se encontraron ${brands.length} marcas`);
    return successResponse(brands, 200, event);
  } catch (error: any) {
    console.error('❌ [PUBLIC PHARMACIES] Error en fallback:', error.message);
    throw error;
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
    
    // Construir where - ahora brandId es el chain_id
    const where: any = {
      providers: {
        chain_id: brandId,
        service_categories: {
          slug: 'pharmacy',
        },
        verification_status: 'APPROVED',
        users: {
          is_active: true,
        },
      },
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

