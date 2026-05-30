import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, paginatedResponse, successResponse } from '../shared/response';
import { uploadImageToCloudinary, isBase64Image } from '../shared/cloudinary';

async function autoExpireAds() {
  try {
    const prisma = getPrismaClient();
    const now = new Date();
    await prisma.provider_ads.updateMany({
      where: {
        is_active: true,
        end_date: { lte: now },
      },
      data: { is_active: false },
    });
  } catch (e) {
    console.error('Error auto-expiring ads:', e);
  }
}

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
    case 'clinica':
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

    // --- SUBIR IMAGEN A CLOUDINARY si es base64 ---
    let finalImageUrl: string | null = image_url || null;
    if (image_url && isBase64Image(image_url)) {
      try {
        finalImageUrl = await uploadImageToCloudinary(image_url, 'ads');
        console.log('✅ [ADS] Imagen subida a Cloudinary:', finalImageUrl);
      } catch (imgErr: any) {
        console.error('❌ [ADS] Error subiendo imagen a Cloudinary:', imgErr.message);
        return errorResponse('Error al subir la imagen del anuncio. Intenta de nuevo.', 500);
      }
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
        image_url: finalImageUrl,
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
  await autoExpireAds();
  console.log('📢 [ADS] Obteniendo carrusel de anuncios públicos...');
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '10', 10);
  const offset = (page - 1) * limit;

  try {
    const now = new Date();

    const where = {
      status: 'APPROVED' as const,
      is_active: true,
      start_date: { lte: now },
      OR: [
        { end_date: null },
        { end_date: { gt: now } }
      ],
    };

    const [ads, total] = await Promise.all([
      prisma.provider_ads.findMany({
        where,
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
          start_date: true,
          end_date: true,
          providers: {
            select: {
              logo_url: true,
              commercial_name: true 
            }
          }
        },
        skip: offset,
        take: limit,
      }),
      prisma.provider_ads.count({ where }),
    ]);

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
            startDate: ad.start_date ? new Date(ad.start_date).toISOString().split('T')[0] : null,
            endDate: ad.end_date ? new Date(ad.end_date).toISOString().split('T')[0] : null,
            isAdminAd: !ad.providers,
            
            navigation: {
                screen: screenName,
                params: navParams 
            },
            
            providerName: ad.providers?.commercial_name,
            providerLogo: ad.providers?.logo_url
        };
    });

    return paginatedResponse(formattedAds, total, page, limit);

  } catch (error: any) {
    console.error('❌ [ADS] Error fetching public ads:', error);
    return internalErrorResponse('Failed to fetch ads');
  }
}

// --- 2b. GET /api/ads/active o /api/public/ads - Estructura para app de pacientes ---
export async function getActiveAds(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const now = new Date();

    const where = {
      status: 'APPROVED' as const,
      is_active: true,
      start_date: { lte: now },
      OR: [{ end_date: null }, { end_date: { gt: now } }],
    };

    const [ads, total] = await Promise.all([
      prisma.provider_ads.findMany({
        where,
        include: {
          providers: {
            include: {
              service_categories: { select: { slug: true } },
            },
          },
        },
        orderBy: [{ priority_order: 'asc' }, { start_date: 'desc' }],
        skip: offset,
        take: limit,
      }),
      prisma.provider_ads.count({ where }),
    ]);

    const data = ads.map(ad => ({
      id: ad.id,
      label: ad.badge_text || '',
      discount: ad.title || '',
      description: ad.subtitle || '',
      buttonText: ad.action_text || '',
      imageUrl: ad.image_url || null,
      startDate: ad.start_date ? new Date(ad.start_date).toISOString().split('T')[0] : null,
      endDate: ad.end_date ? new Date(ad.end_date).toISOString().split('T')[0] : null,
      providerName: ad.providers?.commercial_name || '',
      serviceType: ad.providers?.service_categories?.slug || 'doctor',
    }));

    return paginatedResponse(data, total, page, limit);
  } catch (error: any) {
    console.error('Error getActiveAds:', error);
    return internalErrorResponse('Error fetching active ads');
  }
}

// --- 3. FUNCIÓN DE LISTADO COMPLETO CON FILTROS (GET /api/ads?mode=all) ---
export async function getMyAds(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  await autoExpireAds();
  const authResult = await requireRole(event, [
    enum_roles.provider, enum_roles.pharmacy, enum_roles.lab, enum_roles.ambulance, enum_roles.supplies
  ]);
  if ('statusCode' in authResult) return authResult;
  const { user } = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const provider = await prisma.providers.findFirst({ where: { user_id: user.id } });
    if (!provider) return successResponse([]);

    const queryParams = event.queryStringParameters || {};
    const statusFilter = queryParams.status && queryParams.status !== 'all'
      ? { status: queryParams.status as any }
      : {};
    const dateFrom = queryParams.dateFrom ? new Date(queryParams.dateFrom) : null;
    const dateTo = queryParams.dateTo ? new Date(queryParams.dateTo + 'T23:59:59.999Z') : null;

    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = dateFrom;
    if (dateTo) dateFilter.lte = dateTo;

    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;

    const where: any = {
      provider_id: provider.id,
      ...statusFilter,
    };
    if (dateFrom || dateTo) {
      where.start_date = dateFilter;
    }

    const [ads, total] = await Promise.all([
      prisma.provider_ads.findMany({
        where,
        orderBy: { start_date: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.provider_ads.count({ where }),
    ]);

    return paginatedResponse(ads, total, page, limit);
  } catch (error) {
    console.error('Error getMyAds:', error);
    return internalErrorResponse('Error fetching my ads');
  }
}

// --- 4. FUNCIÓN DE ACTUALIZACIÓN PROPIA (PUT /api/ads/:id) ---
export async function updateMyAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [
    enum_roles.provider, enum_roles.pharmacy, enum_roles.lab, enum_roles.ambulance, enum_roles.supplies
  ]);
  if ('statusCode' in authResult) return authResult;
  const { user } = authResult as AuthContext;

  const path = event.requestContext.http.path;
  const id = path.split('/').pop() || '';
  if (!id) return errorResponse('ID de anuncio no proporcionado', 400);

  const prisma = getPrismaClient();

  try {
    const provider = await prisma.providers.findFirst({ where: { user_id: user.id } });
    if (!provider) return errorResponse('Perfil de proveedor no encontrado', 404);

    const existing = await prisma.provider_ads.findUnique({ where: { id } });
    if (!existing) return errorResponse('Anuncio no encontrado', 404);
    if (existing.provider_id !== provider.id) return errorResponse('No tienes permiso para editar este anuncio', 403);
    if (existing.status !== 'PENDING') return errorResponse('Solo puedes editar anuncios con estado Pendiente', 400);

    const body = JSON.parse(event.body || '{}');
    const { badge_text, discount_title, description, button_text, image_url, start_date, end_date } = body;

    let finalImageUrl = existing.image_url;
    if (image_url && isBase64Image(image_url)) {
      finalImageUrl = await uploadImageToCloudinary(image_url, 'ads');
    } else if (image_url !== undefined) {
      finalImageUrl = image_url;
    }

    const updated = await prisma.provider_ads.update({
      where: { id },
      data: {
        ...(badge_text !== undefined && { badge_text }),
        ...(discount_title !== undefined && { title: discount_title }),
        ...(description !== undefined && { subtitle: description }),
        ...(button_text !== undefined && { action_text: button_text }),
        ...(finalImageUrl !== existing.image_url && { image_url: finalImageUrl }),
        ...(start_date !== undefined && { start_date: new Date(start_date) }),
        ...(end_date !== undefined && { end_date: end_date ? new Date(end_date) : null }),
      },
    });

    return successResponse({ message: 'Anuncio actualizado correctamente', ad: updated });
  } catch (error) {
    console.error('Error updateMyAd:', error);
    return internalErrorResponse('Error al actualizar el anuncio');
  }
}

// --- 5. FUNCIÓN DE CONSULTA PROPIA (GET /api/ads) ---
export async function getMyAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  await autoExpireAds();
  const authResult = await requireRole(event, [
    enum_roles.provider, enum_roles.pharmacy, enum_roles.lab, enum_roles.ambulance, enum_roles.supplies
  ]);
  if ('statusCode' in authResult) return authResult;
  const { user } = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const provider = await prisma.providers.findFirst({ where: { user_id: user.id } });
    if (!provider) return successResponse(null);

    const now = new Date();

    // Obtener el anuncio más reciente que esté activo o pendiente
    const latestAd = await prisma.provider_ads.findFirst({
      where: { 
        provider_id: provider.id,
        OR: [
          { status: 'PENDING' },
          { 
            status: 'APPROVED',
            is_active: true,
            start_date: { lte: now },
            OR: [
              { end_date: null },
              { end_date: { gte: now } }
            ]
          }
        ]
      },
      orderBy: { start_date: 'desc' } 
    });

    return successResponse(latestAd);
  } catch (error) {
    console.error('Error getMyAd:', error);
    return internalErrorResponse('Error fetching my ad');
  }
}