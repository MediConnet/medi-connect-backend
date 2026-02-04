import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';

// Interface del formulario Frontend
interface CreateAdBody {
  badge_text: string;
  discount_title: string;
  description: string;
  button_text: string;
  image_url?: string;
  start_date: string;
  end_date?: string;
}

// --- CONFIGURACIÓN DE TEMA ---
const SERVICE_THEME: Record<string, { bg: string, accent: string }> = {
  doctor:      { bg: '#E0F2F1', accent: '#009688' }, 
  pharmacy:    { bg: '#E3F2FD', accent: '#1E88E5' }, 
  laboratory:  { bg: '#F3E5F5', accent: '#8E24AA' }, 
  ambulance:   { bg: '#FBE9E7', accent: '#D84315' }, 
  supplies:    { bg: '#FFF3E0', accent: '#F57C00' }, 
  clinic:      { bg: '#E0F7FA', accent: '#006064' }, 
  default:     { bg: '#FFFFFF', accent: '#009688' }
};

/**
 * Helper: Mapea el SLUG a la pantalla de DETALLE del proveedor
 */
const getTargetScreenBySlug = (slug?: string): string => {
  switch (slug) {
    case 'doctor':
      return 'DoctorDetail';
    case 'pharmacy':
      return 'FarmaciaDetail'; 
    case 'laboratory':
      return 'LaboratorioDetail';
    case 'ambulance':
      return 'AmbulanciaDetail';
    case 'supplies':
      return 'InsumoDetail';
    case 'clinic':
      return 'Home'; // Fallback si no hay ClinicDetail
    default:
      return 'Home';
  }
};

/**
 * HELPER: Genera los parámetros correctos según la pantalla.
 */
const getNavigationParams = (screen: string, id: string) => {
  switch (screen) {
    case 'DoctorDetail':
      return { doctorId: id };
    case 'FarmaciaDetail':
      return { farmaciaId: id };
    case 'LaboratorioDetail':
      return { laboratorioId: id };
    case 'AmbulanciaDetail':
      return { ambulanciaId: id };
    case 'InsumoDetail':
      return { tiendaId: id }; 
    default:
      return { providerId: id };
  }
};

const getAdColors = (slug: string, dbAccentColor?: string | null) => {
  const theme = SERVICE_THEME[slug] || SERVICE_THEME['default'];
  return {
    bg: theme.bg,
    accent: dbAccentColor || theme.accent
  };
};

// --- 1. FUNCIÓN DE CREACIÓN (POST) ---
export async function createAdRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📢 [ADS] Procesando solicitud de nuevo anuncio...');

  const authResult = await requireRole(event, [
      enum_roles.provider, enum_roles.pharmacy, enum_roles.lab, enum_roles.ambulance, enum_roles.supplies
  ]);
  
  if ('statusCode' in authResult) return authResult;
  const { user } = authResult as AuthContext;

  const prisma = getPrismaClient();

  try {
    const provider = await prisma.providers.findFirst({
      where: { user_id: user.id },
      include: {
        service_categories: true 
      }
    });

    if (!provider) {
      return errorResponse('No se encontró un perfil de proveedor asociado a tu cuenta.', 404);
    }

    const existingAd = await prisma.provider_ads.findFirst({
      where: {
        provider_id: provider.id,
        OR: [
          { status: 'PENDING' },
          { 
            status: 'APPROVED',
            is_active: true,
            end_date: { gt: new Date() } 
          }
        ]
      }
    });

    if (existingAd) {
      const msg = existingAd.status === 'PENDING' 
        ? 'Ya tienes una solicitud pendiente.' 
        : 'Ya tienes un anuncio activo vigente.';
      return errorResponse(msg, 409); 
    }

    const body: CreateAdBody = JSON.parse(event.body || '{}');
    const { badge_text, discount_title, description, button_text, image_url, start_date, end_date } = body;

    if (!badge_text || !discount_title || !description || !button_text || !start_date) {
      return errorResponse('Faltan campos obligatorios.', 400);
    }

    const slug = provider.service_categories?.slug || 'default';
    const dbAccentColor = provider.service_categories?.default_color_hex;
    const colors = getAdColors(slug, dbAccentColor);
    const targetScreen = getTargetScreenBySlug(slug);

    const newAd = await prisma.provider_ads.create({
      data: {
        id: randomUUID(),
        provider_id: provider.id,
        badge_text,
        title: discount_title,
        subtitle: description,
        action_text: button_text,
        image_url: image_url || null,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        is_active: true,       
        status: 'PENDING', 
        bg_color_hex: colors.bg, 
        accent_color_hex: colors.accent, 
        
        target_screen: targetScreen,
        target_id: provider.id, 
        
        priority_order: 10 
      }
    });

    return successResponse({ message: 'Solicitud enviada exitosamente.', ad: newAd });

  } catch (error) {
    console.error('Error createAdRequest:', error);
    return internalErrorResponse('Error interno al procesar la solicitud.');
  }
}

// --- 2. FUNCIÓN PÚBLICA PARA EL CARRUSEL (GET) ---
// Endpoint: GET /api/public/ads
export async function getPublicAds(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📢 [ADS] Obteniendo carrusel de anuncios públicos...');
  const prisma = getPrismaClient();

  try {
    const now = new Date();

    const ads = await prisma.provider_ads.findMany({
      where: {
        status: 'APPROVED',
        is_active: true,
        start_date: { lte: now },
        OR: [
          { end_date: null },
          { end_date: { gt: now } }
        ]
      },
      orderBy: [
        { priority_order: 'asc' }, 
        { start_date: 'desc' } 
      ],
      select: {
        id: true,
        badge_text: true,
        title: true,
        subtitle: true,
        image_url: true,
        action_text: true,
        bg_color_hex: true,
        accent_color_hex: true,
        target_screen: true,
        target_id: true,
        providers: {
          select: {
            logo_url: true,
            commercial_name: true 
          }
        }
      },
      take: 10 
    });

    // Mapeo para el Frontend (React Native)
    const formattedAds = ads.map(ad => {
        const screenName = ad.target_screen || 'Home';
        const providerId = ad.target_id || '';
        const navParams = getNavigationParams(screenName, providerId);

        return {
            id: ad.id,
            badge: ad.badge_text,
            title: ad.title,
            subtitle: ad.subtitle,
            image: ad.image_url,
            actionText: ad.action_text,
            color: ad.bg_color_hex, 
            accent: ad.accent_color_hex,
            
            navigation: {
                screen: screenName,
                params: navParams 
            },
            
            providerName: ad.providers?.commercial_name,
            providerLogo: ad.providers?.logo_url
        };
    });

    return successResponse(formattedAds);

  } catch (error: any) {
    console.error('❌ [ADS] Error fetching public ads:', error);
    return internalErrorResponse('Failed to fetch ads');
  }
}

// --- 3. FUNCIÓN DE CONSULTA PROPIA (GET) ---
export async function getMyAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [
    enum_roles.provider, enum_roles.pharmacy, enum_roles.lab, enum_roles.ambulance, enum_roles.supplies
  ]);
  if ('statusCode' in authResult) return authResult;
  const { user } = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const provider = await prisma.providers.findFirst({ where: { user_id: user.id } });
    if (!provider) return successResponse(null);

    const latestAd = await prisma.provider_ads.findFirst({
      where: { provider_id: provider.id },
      orderBy: { start_date: 'desc' } 
    });

    return successResponse(latestAd);
  } catch (error) {
    console.error('Error getMyAd:', error);
    return internalErrorResponse('Error fetching my ad');
  }
}