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
 * Acepta string, null o undefined para máxima seguridad en TypeScript.
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

export async function createAdRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('📢 [ADS] Procesando solicitud de nuevo anuncio...');

  // 1. AUTENTICACIÓN
  // Validamos que sea alguno de los roles permitidos para crear anuncios
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
    // 2. OBTENER EL PERFIL DE PROVEEDOR
    // Buscamos el ID del proveedor ligado a este usuario (Provider Profile)
    const provider = await prisma.providers.findFirst({
      where: { user_id: user.id }
    });

    if (!provider) {
      return errorResponse('No se encontró un perfil de proveedor asociado a tu cuenta.', 404);
    }

    // 3. PARSEAR BODY
    const body: CreateAdBody = JSON.parse(event.body || '{}');
    const { 
      badge_text, 
      discount_title, 
      description, 
      button_text, 
      image_url, 
      start_date, 
      end_date 
    } = body;

    // 4. VALIDACIÓN DE CAMPOS OBLIGATORIOS
    if (!badge_text || !discount_title || !description || !button_text || !start_date) {
      return errorResponse('Faltan campos obligatorios en la solicitud.', 400);
    }

    // 5. DETERMINAR COLOR DINÁMICO
    // Usamos el rol del usuario autenticado para definir el color de marca
    const dynamicAccentColor = getAccentColorByRole(user.role);

    // 6. CREAR EN BASE DE DATOS
    const newAd = await prisma.provider_ads.create({
      data: {
        id: randomUUID(), // ID único del anuncio
        provider_id: provider.id,
        
        // Mapeo Frontend -> DB
        badge_text: badge_text,
        title: discount_title,
        subtitle: description,
        action_text: button_text,
        image_url: image_url || null,
        
        // Fechas
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        
        is_active: true,       
        status: 'PENDING',
        
        // Estilos Visuales
        bg_color_hex: '#FFFFFF',              
        accent_color_hex: dynamicAccentColor, 
        
        // Navegación en la App
        target_screen: 'provider_profile',
        target_id: provider.id,
        priority_order: 1
      }
    });

    console.log(`✅ Solicitud de anuncio creada: ${newAd.id} | Rol: ${user.role} | Color: ${dynamicAccentColor}`);

    return successResponse({ 
      message: 'Solicitud enviada correctamente. Pendiente de aprobación.',
      ad: newAd 
    });

  } catch (error) {
    console.error('Error creando solicitud de anuncio:', error);
    return errorResponse('Error interno al procesar la solicitud.', 500);
  }
}