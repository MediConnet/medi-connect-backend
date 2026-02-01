import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse } from '../shared/response';

// GET /api/home/content
export async function getHomeContent(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [HOME] GET /api/home/content - Obteniendo contenido principal');
  
  return successResponse({
    hero: {
      title: "Tu Salud es Nuestra Prioridad",
      subtitle: "Encuentra médicos, farmacias, laboratorios y servicios de salud cerca de ti",
      ctaText: "Explora Nuestros Servicios",
      ctaLink: "/services"
    },
    features: {
      title: "¿Por Qué Elegirnos?",
      subtitle: "La mejor plataforma para conectar con servicios de salud"
    },
    featuredServices: {
      title: "Profesionales Premium",
      subtitle: "Servicios verificados con la mejor calidad y atención",
      rotationInterval: 5
    },
    joinSection: {
      title: "Únete a Medify",
      subtitle: "La plataforma que conecta a pacientes y profesionales de la salud",
      ctaText: "¡Regístrate ahora!",
      ctaLink: "/register"
    },
    footer: {
      copyright: "Conectando salud y bienestar | Medify © 2025",
      links: [
        { label: "Política de privacidad", url: "/privacy" },
        { label: "Términos y condiciones", url: "/terms" }
      ]
    }
  });
}

// GET /api/home/features
export async function getHomeFeatures(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [HOME] GET /api/home/features - Obteniendo características');
  
  return successResponse([
    {
      id: "1",
      icon: "LocationOn",
      title: "Encuentra servicios cercanos",
      description: "Localiza médicos, farmacias y laboratorios en tu zona",
      order: 1
    },
    {
      id: "2",
      icon: "Schedule",
      title: "Reserva citas en línea",
      description: "Agenda tus citas médicas de forma rápida y sencilla",
      order: 2
    },
    {
      id: "3",
      icon: "Verified",
      title: "Profesionales verificados",
      description: "Todos nuestros profesionales están verificados y certificados",
      order: 3
    },
    {
      id: "4",
      icon: "Star",
      title: "Calificaciones y reseñas",
      description: "Lee las opiniones de otros pacientes antes de elegir",
      order: 4
    }
  ]);
}

// GET /api/home/featured-services
export async function getFeaturedServices(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [HOME] GET /api/home/featured-services - Obteniendo servicios destacados');
  
  const prisma = (await import('../shared/prisma')).getPrismaClient();
  
  try {
    // Obtener providers destacados (con mejor rating y verificados)
    const providers = await prisma.providers.findMany({
      where: {
        verification_status: 'APPROVED',
      },
      include: {
        provider_branches: {
          where: { is_active: true },
          take: 1,
          orderBy: { rating_cache: 'desc' },
        },
        service_categories: {
          select: { name: true, slug: true },
        },
        specialties: {
          take: 1,
          select: { name: true },
        },
      },
      take: 10,
    });

    // Mapear a formato esperado
    const featuredServices = providers
      .filter(p => p.provider_branches.length > 0)
      .map(provider => {
        const branch = provider.provider_branches[0];
        const specialty = provider.specialties[0];
        
        return {
          id: provider.id,
          name: provider.commercial_name || 'Servicio',
          specialty: specialty?.name || provider.service_categories?.name || null,
          rating: Number(branch?.rating_cache || 0),
          imageUrl: branch?.image_url || provider.logo_url || null,
          location: branch?.address_text || 'Ubicación no disponible',
        };
      });

    return successResponse(featuredServices);
  } catch (error: any) {
    console.error(`❌ [HOME] Error al obtener servicios destacados:`, error.message);
    // Retornar array vacío en caso de error
    return successResponse([]);
  }
}
