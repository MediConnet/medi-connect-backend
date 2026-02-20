import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse } from '../shared/response';

/**
 * GET /api/home/content
 * Obtener contenido principal de la página home (público)
 */
export async function getHomeContent(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    // Retornar valores por defecto (las tablas home_content no están implementadas aún)
    const defaultContent = {
      hero: {
        title: 'Tu Salud es Nuestra Prioridad',
        subtitle: 'Encuentra médicos, farmacias, laboratorios y más servicios de salud cerca de ti',
        ctaText: 'Explora Nuestros Servicios',
        ctaLink: '/services',
      },
      features: {
        title: '¿Por Qué Elegirnos?',
        subtitle: 'La mejor plataforma para conectar pacientes con profesionales de la salud',
      },
      featuredServices: {
        title: 'Profesionales Premium',
        subtitle: 'Servicios verificados y de alta calidad',
        rotationInterval: 5,
      },
      joinSection: {
        title: 'Únete a MediConnect',
        subtitle: 'La plataforma que conecta salud y bienestar',
        ctaText: '¡Regístrate ahora!',
        ctaLink: '/register',
      },
      footer: {
        copyright: 'Conectando salud y bienestar | MediConnect © 2025',
        links: [
          { label: 'Política de privacidad', url: '/privacy' },
          { label: 'Términos y condiciones', url: '/terms' },
        ],
      },
    };

    return successResponse(defaultContent);
  } catch (error: any) {
    console.error('Error getting home content:', error);
    return errorResponse(error.message || 'Error al obtener contenido del home', 500);
  }
}

/**
 * GET /api/home/features
 * Obtener características destacadas de la plataforma (público)
 */
export async function getHomeFeatures(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    // Retornar valores por defecto (las tablas home_features no están implementadas aún)
    const defaultFeatures = [
      {
        id: '1',
        icon: 'LocationOn',
        title: 'Encuentra servicios cercanos',
        description: 'Localiza médicos, farmacias, laboratorios y ambulancias cerca de ti',
        order: 1,
      },
      {
        id: '2',
        icon: 'Schedule',
        title: 'Agenda citas fácilmente',
        description: 'Reserva tus consultas médicas en línea de forma rápida y segura',
        order: 2,
      },
      {
        id: '3',
        icon: 'VerifiedUser',
        title: 'Profesionales verificados',
        description: 'Todos nuestros proveedores están certificados y verificados',
        order: 3,
      },
      {
        id: '4',
        icon: 'LocalPharmacy',
        title: 'Farmacias y medicamentos',
        description: 'Encuentra farmacias cercanas y compara precios de medicamentos',
        order: 4,
      },
    ];

    return successResponse(defaultFeatures);
  } catch (error: any) {
    console.error('Error getting home features:', error);
    return errorResponse(error.message || 'Error al obtener características', 500);
  }
}

/**
 * GET /api/home/featured-services
 * Obtener servicios destacados para mostrar en el home (público)
 */
export async function getFeaturedServices(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const prisma = getPrismaClient();

    // Obtener proveedores destacados (con mejor rating)
    const providers = await prisma.providers.findMany({
      where: {
        verification_status: 'APPROVED',
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
            is_main: true,
          },
          select: {
            name: true,
            rating_cache: true,
            image_url: true,
            address_text: true,
            cities: {
              select: {
                name: true,
                country: true,
              },
            },
          },
          take: 1,
        },
        provider_specialties: {
          include: {
            specialties: {
              select: {
                name: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: {
        years_of_experience: 'desc',
      },
      take: 10,
    });

    const formattedServices = providers
      .filter((p) => p.provider_branches.length > 0)
      .map((provider) => {
        const branch = provider.provider_branches[0];
        const specialty = provider.provider_specialties[0]?.specialties;
        const city = branch.cities;

        return {
          id: provider.id,
          name: provider.commercial_name || branch.name || 'Proveedor',
          specialty: specialty?.name || 'Servicio de salud',
          rating: branch.rating_cache || 0,
          imageUrl: provider.logo_url || branch.image_url,
          location: city ? `${city.name}, ${city.country}` : branch.address_text || 'Ubicación no disponible',
        };
      });

    return successResponse(formattedServices);
  } catch (error: any) {
    console.error('Error getting featured services:', error);
    return errorResponse(error.message || 'Error al obtener servicios destacados', 500);
  }
}
