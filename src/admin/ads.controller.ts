import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { requireRole } from '../shared/auth';
import { isBase64Image, uploadImageToCloudinary } from '../shared/cloudinary';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, successResponse } from '../shared/response';

function extractId(path: string, prefix: string): string {
  const after = path.slice(path.indexOf(prefix) + prefix.length);
  return after.split('/')[0];
}

/**
 * GET /api/admin/ads
 * Lista todos los anuncios APPROVED (propios del admin y de proveedores)
 */
export async function getAdminAds(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const ads = await prisma.provider_ads.findMany({
      where: { status: 'APPROVED' },
      include: {
        providers: { select: { commercial_name: true } },
      },
      orderBy: { priority_order: 'asc' },
    });

    const result = ads.map((ad) => ({
      id: ad.id,
      badgeText: ad.badge_text,
      title: ad.title,
      subtitle: ad.subtitle,
      actionText: ad.action_text,
      imageUrl: ad.image_url,
      bgColorHex: ad.bg_color_hex,
      accentColorHex: ad.accent_color_hex,
      targetScreen: ad.target_screen,
      targetId: ad.target_id,
      startDate: ad.start_date ? new Date(ad.start_date).toISOString().split('T')[0] : null,
      endDate: ad.end_date ? new Date(ad.end_date).toISOString().split('T')[0] : null,
      isActive: ad.is_active,
      priorityOrder: ad.priority_order,
      isAdminAd: ad.provider_id === null,
      providerName: ad.providers?.commercial_name ?? 'Admin',
    }));

    return successResponse(result);
  } catch (error: any) {
    console.error('Error getAdminAds:', error);
    return internalErrorResponse('Error al obtener anuncios');
  }
}

/**
 * POST /api/admin/ads
 * Crea un anuncio del admin (status=APPROVED, is_active=true, provider_id=null)
 */
export async function createAdminAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  try {
    const body = JSON.parse(event.body || '{}');
    const {
      badge_text, title, subtitle, action_text,
      image_url, start_date, end_date,
      target_screen, target_id,
      bg_color_hex, accent_color_hex, priority_order,
    } = body;

    if (!badge_text || !title || !action_text || !start_date || !target_screen) {
      return errorResponse('Faltan campos obligatorios: badge_text, title, action_text, start_date, target_screen', 400);
    }

    let finalImageUrl: string | null = image_url || null;
    if (image_url && isBase64Image(image_url)) {
      finalImageUrl = await uploadImageToCloudinary(image_url, 'ads');
    }

    const ad = await prisma.provider_ads.create({
      data: {
        id: randomUUID(),
        provider_id: null,
        badge_text,
        title,
        subtitle: subtitle || null,
        action_text,
        image_url: finalImageUrl,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        status: 'APPROVED',
        is_active: true,
        target_screen,
        target_id: target_id || null,
        bg_color_hex: bg_color_hex || '#FFFFFF',
        accent_color_hex: accent_color_hex || '#009688',
        priority_order: priority_order ?? 1,
      },
    });

    return successResponse({ message: 'Anuncio creado exitosamente', ad }, 201);
  } catch (error: any) {
    console.error('Error createAdminAd:', error);
    return internalErrorResponse('Error al crear anuncio');
  }
}

/**
 * PUT /api/admin/ads/:id
 * Edita un anuncio del admin (solo si provider_id = null)
 */
export async function updateAdminAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const id = extractId(event.requestContext.http.path, '/api/admin/ads/');
  const prisma = getPrismaClient();

  try {
    const existing = await prisma.provider_ads.findUnique({ where: { id } });
    if (!existing) return errorResponse('Anuncio no encontrado', 404);
    if (existing.provider_id !== null) return errorResponse('No puedes editar anuncios de proveedores', 403);

    const body = JSON.parse(event.body || '{}');
    const {
      badge_text, title, subtitle, action_text,
      image_url, start_date, end_date,
      target_screen, target_id,
      bg_color_hex, accent_color_hex, priority_order,
    } = body;

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
        ...(title !== undefined && { title }),
        ...(subtitle !== undefined && { subtitle }),
        ...(action_text !== undefined && { action_text }),
        ...(finalImageUrl !== existing.image_url && { image_url: finalImageUrl }),
        ...(start_date !== undefined && { start_date: new Date(start_date) }),
        ...(end_date !== undefined && { end_date: end_date ? new Date(end_date) : null }),
        ...(target_screen !== undefined && { target_screen }),
        ...(target_id !== undefined && { target_id }),
        ...(bg_color_hex !== undefined && { bg_color_hex }),
        ...(accent_color_hex !== undefined && { accent_color_hex }),
        ...(priority_order !== undefined && { priority_order }),
      },
    });

    return successResponse({ message: 'Anuncio actualizado', ad: updated });
  } catch (error: any) {
    console.error('Error updateAdminAd:', error);
    return internalErrorResponse('Error al actualizar anuncio');
  }
}

/**
 * DELETE /api/admin/ads/:id
 * Elimina un anuncio del admin (solo si provider_id = null)
 */
export async function deleteAdminAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  const id = extractId(event.requestContext.http.path, '/api/admin/ads/');
  const prisma = getPrismaClient();

  try {
    const existing = await prisma.provider_ads.findUnique({ where: { id } });
    if (!existing) return errorResponse('Anuncio no encontrado', 404);
    if (existing.provider_id !== null) return errorResponse('No puedes eliminar anuncios de proveedores', 403);

    await prisma.provider_ads.delete({ where: { id } });
    return successResponse({ message: 'Anuncio eliminado' });
  } catch (error: any) {
    console.error('Error deleteAdminAd:', error);
    return internalErrorResponse('Error al eliminar anuncio');
  }
}

/**
 * PATCH /api/admin/ads/:id/toggle
 * Activa/desactiva cualquier anuncio (propio o de proveedor)
 */
export async function toggleAdminAd(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) return authResult;

  // path: /api/admin/ads/:id/toggle
  const pathParts = event.requestContext.http.path.split('/');
  const id = pathParts[pathParts.length - 2]; // antes de /toggle

  const prisma = getPrismaClient();
  try {
    const existing = await prisma.provider_ads.findUnique({ where: { id } });
    if (!existing) return errorResponse('Anuncio no encontrado', 404);

    const updated = await prisma.provider_ads.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });

    return successResponse({ message: `Anuncio ${updated.is_active ? 'activado' : 'desactivado'}`, isActive: updated.is_active });
  } catch (error: any) {
    console.error('Error toggleAdminAd:', error);
    return internalErrorResponse('Error al cambiar estado del anuncio');
  }
}
