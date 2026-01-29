import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, successResponse } from '../shared/response';

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

/**
 * Helper para determinar el color del anuncio según el rol del usuario.
 */
const getAccentColorByRole = (role?: string | null): string => {
  if (!role) return '#009688';

  switch (role) {
    case enum_roles.pharmacy:
      return '#1E88E5'; // Azul (Farmacias)
    case enum_roles.lab:
      return '#8E24AA'; // Violeta (Laboratorios)
    case enum_roles.ambulance:
      return '#D84315'; // Naranja Rojizo (Ambulancias)
    case enum_roles.provider:
    default:
      return '#009688'; // Teal (Médicos / Default)
  }
};

// --- FUNCIÓN DE CREACIÓN (POST) ---
export async function createAdRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📢 [ADS] Procesando solicitud de nuevo anuncio...');

  const authResult = await requireRole(event, [
      enum_roles.provider, enum_roles.pharmacy, enum_roles.lab, enum_roles.ambulance
  ]);
  
  if ('statusCode' in authResult) return authResult;
  const { user } = authResult as AuthContext;

  const prisma = getPrismaClient();

  try {
    const provider = await prisma.providers.findFirst({
      where: { user_id: user.id }
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
        ? 'Ya tienes una solicitud pendiente. Espera a que sea revisada.' 
        : 'Ya tienes un anuncio activo vigente. Debes esperar a que termine.';
      return errorResponse(msg, 409); 
    }

    // --- CONTINÚA EL PROCESO NORMAL ---
    const body: CreateAdBody = JSON.parse(event.body || '{}');
    const { badge_text, discount_title, description, button_text, image_url, start_date, end_date } = body;

    if (!badge_text || !discount_title || !description || !button_text || !start_date) {
      return errorResponse('Faltan campos obligatorios.', 400);
    }

    const dynamicAccentColor = getAccentColorByRole(user.role);

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
        bg_color_hex: '#FFFFFF',              
        accent_color_hex: dynamicAccentColor, 
        target_screen: 'provider_profile',
        target_id: provider.id,
        priority_order: 1
      }
    });

    console.log(`✅ Solicitud creada: ${newAd.id}`);
    return successResponse({ message: 'Solicitud enviada exitosamente.', ad: newAd });

  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Error interno al procesar la solicitud.', 500);
  }
}

// --- FUNCIÓN DE CONSULTA (GET) ---
export async function getMyAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📢 [ADS] Obteniendo anuncio del usuario...');

  // Validar autenticación
  const authResult = await requireRole(event, [
    enum_roles.provider, 
    enum_roles.pharmacy, 
    enum_roles.lab,
    enum_roles.ambulance
  ]);

  if ('statusCode' in authResult) return authResult;
  const { user } = authResult as AuthContext;

  const prisma = getPrismaClient();

  try {
    const provider = await prisma.providers.findFirst({
      where: { user_id: user.id }
    });

    if (!provider) {
      return successResponse(null);
    }

    const latestAd = await prisma.provider_ads.findFirst({
      where: { provider_id: provider.id },
      orderBy: { start_date: 'desc' } 
    });

    return successResponse(latestAd);

  } catch (error) {
    console.error('Error obteniendo anuncio:', error);
    return errorResponse('Error al consultar el anuncio', 500);
  }
}