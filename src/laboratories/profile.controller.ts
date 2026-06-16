import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { enum_roles } from "../generated/prisma/client";
import { AuthContext, requireRole } from "../shared/auth";
import { getPrismaClient } from "../shared/prisma";
import { uploadImageToCloudinary, isBase64Image } from "../shared/cloudinary";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from "../shared/response";
import { parseBody, updateLaboratoryProfileSchema } from "../shared/validators";
import { LAB_CATEGORY_SLUGS } from "../shared/constants";

function dayIdToSlug(dayId: number): string {
  // IMPORTANT: frontend expects lowercase english slugs
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[dayId] ?? "monday";
}

function formatTimeHHmm(time: Date | null): string {
  if (!time) return "09:00";
  const d = new Date(time);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function getDayIdFromString(day: string): number {
  const map: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6,
  };
  return map[day.toLowerCase()] ?? 1;
}

async function getLaboratoryCategoryId(prisma: ReturnType<typeof getPrismaClient>): Promise<number | null> {
  const cat = await prisma.service_categories.findFirst({
    where: {
      OR: [
        { slug: "laboratory" },
        { slug: "laboratorio" },
        { name: { contains: "laboratorio", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return cat?.id ?? null;
}

function getPublicBaseUrlFromEvent(event: APIGatewayProxyEventV2): string {
  const envBase = (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || "").replace(/\/$/, "");
  if (envBase) return envBase;

  const headers = event.headers ?? {};
  const proto =
    headers["x-forwarded-proto"] ||
    headers["X-Forwarded-Proto"] ||
    (headers["origin"] ? new URL(headers["origin"]).protocol.replace(":", "") : "") ||
    "https";
  const host =
    headers["x-forwarded-host"] ||
    headers["X-Forwarded-Host"] ||
    headers["host"] ||
    headers["Host"] ||
    "";
  if (!host) return "";
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** So the frontend can use logo_url in <img src>; relative /uploads/ path becomes full API URL */
function toAbsoluteLogoUrl(event: APIGatewayProxyEventV2, logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) return logoUrl;
  const base = getPublicBaseUrlFromEvent(event);
  if (!base) return logoUrl;
  return logoUrl.startsWith("/") ? `${base}${logoUrl}` : `${base}/${logoUrl}`;
}

/**
 * GET /api/laboratories/profile
 */
export async function getProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const categoryId = await getLaboratoryCategoryId(prisma);
    if (!categoryId) return notFoundResponse("Laboratory category not found");

    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        category_id: categoryId,
      },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
        provider_branches: {
          where: { is_active: true },
          orderBy: [{ is_main: "desc" }],
          include: {
            provider_schedules: { orderBy: { day_of_week: "asc" } },
          },
        },
        provider_catalog: true,
      },
    });

    if (!provider) return notFoundResponse("Laboratory profile not found");

    const mainBranch = provider.provider_branches[0] ?? null;

    const response = {
      id: provider.id,
      full_name: provider.commercial_name ?? "",
      description: provider.description ?? "",
      logo_url: toAbsoluteLogoUrl(event, provider.logo_url) ?? null,
      profile_picture_url: provider.users?.profile_picture_url || provider.logo_url || null,
      imageUrl: mainBranch?.image_url || provider.logo_url || null,
      preview_images: mainBranch?.preview_images || [],
      address: mainBranch?.address_text ?? "",
      phone: mainBranch?.phone_contact ?? "",
      whatsapp: mainBranch?.phone_contact ?? "",
      latitude: mainBranch?.latitude != null ? Number(mainBranch.latitude) : null,
      longitude: mainBranch?.longitude != null ? Number(mainBranch.longitude) : null,
      google_maps_url: mainBranch?.google_maps_url ?? null,
      is_published: mainBranch?.is_active ?? false,
      branch_id: mainBranch?.id ?? null,
      // Return ONLY enabled/open days (frontend will mark rest as closed)
      schedules: (mainBranch?.provider_schedules ?? [])
        .filter((s) => (s.is_active ?? true) && s.day_of_week != null)
        .map((s) => ({
          day_id: s.day_of_week,
          day: dayIdToSlug(s.day_of_week ?? 1),
          start: formatTimeHHmm(s.start_time),
          end: formatTimeHHmm(s.end_time),
        })),
      exams: (provider.provider_catalog ?? []).map((e) => ({
        id: e.id,
        name: e.name ?? "",
        description: e.description ?? "",
        price: e.price != null ? Number(e.price) : 0,
        is_available: e.is_available ?? true,
      })),
    };

    return successResponse(response);
  } catch (err: any) {
    console.error("❌ [LABORATORIES] getProfile error:", err.message);
    return internalErrorResponse("Failed to get laboratory profile");
  }
}

/**
 * PUT /api/laboratories/profile
 */
export async function updateProfile(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body ?? null, updateLaboratoryProfileSchema);
    const categoryId = await getLaboratoryCategoryId(prisma);
    if (!categoryId) return notFoundResponse("Laboratory category not found");

    const provider = await prisma.providers.findFirst({
      where: {
        user_id: authContext.user.id,
        category_id: categoryId,
      },
      include: {
        provider_branches: {
          where: { is_active: true },
          orderBy: [{ is_main: "desc" }],
          take: 1,
        },
      },
    });

    if (!provider) return notFoundResponse("Laboratory profile not found");

    const mainBranch = provider.provider_branches[0];
    if (!mainBranch) return notFoundResponse("Laboratory branch not found");

    await prisma.$transaction(async (tx) => {
      const providerData: Record<string, unknown> = {};
      if (body.full_name !== undefined) providerData.commercial_name = body.full_name;
      if (body.description !== undefined) providerData.description = body.description;

      // Procesar imagen — subir a Cloudinary si es base64
      let resolvedImageUrl: string | null | undefined;
      if (body.logo_url !== undefined || body.imageUrl !== undefined) {
        const raw = body.imageUrl || body.logo_url;
        if (!raw || raw === "") {
          resolvedImageUrl = null;
        } else if (isBase64Image(raw)) {
          resolvedImageUrl = await uploadImageToCloudinary(raw, 'providers/laboratories');
          console.log('✅ [LABORATORIES] Imagen subida a Cloudinary:', resolvedImageUrl);
        } else {
          resolvedImageUrl = raw;
        }
        providerData.logo_url = resolvedImageUrl;
      }

      // Procesar avatar de perfil (profile_picture_url)
      let uploadedProfilePictureUrl: string | null | undefined;
      if (body.profile_picture_url !== undefined) {
        if (body.profile_picture_url && isBase64Image(body.profile_picture_url)) {
          try {
            uploadedProfilePictureUrl = await uploadImageToCloudinary(body.profile_picture_url, 'providers/laboratories/avatars');
            console.log('✅ [LABORATORIES] Avatar subido a Cloudinary:', uploadedProfilePictureUrl);
          } catch (imgErr: any) {
            console.error('❌ [LABORATORIES] Error subiendo avatar a Cloudinary:', imgErr.message);
            return errorResponse('Error al subir la imagen de perfil. Intenta de nuevo.', 500);
          }
        } else if (body.profile_picture_url && !isBase64Image(body.profile_picture_url) && !body.profile_picture_url.startsWith('blob:')) {
          uploadedProfilePictureUrl = body.profile_picture_url;
        } else if (body.profile_picture_url === null || body.profile_picture_url === "") {
          uploadedProfilePictureUrl = null;
        }
      }

      // Procesar galería de vista previa (preview_images)
      let uploadedPreviewImages: string[] | undefined;
      if (body.preview_images && body.preview_images.length > 0) {
        uploadedPreviewImages = [];
        for (const img of body.preview_images) {
          if (isBase64Image(img)) {
            try {
              const url = await uploadImageToCloudinary(img, 'providers/laboratories/previews');
              uploadedPreviewImages.push(url);
            } catch (imgErr: any) {
              console.error('❌ [LABORATORIES] Error subiendo imagen de galería a Cloudinary:', imgErr.message);
              return errorResponse('Error al subir imagen de galería. Intenta de nuevo.', 500);
            }
          } else if (!img.startsWith('blob:')) {
            uploadedPreviewImages.push(img);
          }
        }
      } else if (body.preview_images && body.preview_images.length === 0) {
        uploadedPreviewImages = [];
      }

      if (Object.keys(providerData).length > 0) {
        await tx.providers.update({ where: { id: provider.id }, data: providerData });
      }

      // Actualizar profile_picture_url en users
      if (uploadedProfilePictureUrl !== undefined) {
        await tx.users.update({
          where: { id: authContext.user.id },
          data: { profile_picture_url: uploadedProfilePictureUrl },
        });
        console.log('✅ [LABORATORIES] profile_picture_url guardado en users:', uploadedProfilePictureUrl);
      }

      const branchData: Record<string, unknown> = {};
      // Si se subió imagen, guardarla también en image_url de la sucursal
      if (resolvedImageUrl !== undefined) branchData.image_url = resolvedImageUrl;
      if (uploadedPreviewImages !== undefined) branchData.preview_images = uploadedPreviewImages;
      if (body.address !== undefined) branchData.address_text = body.address;
      if (body.phone !== undefined) branchData.phone_contact = body.phone;
      if (body.whatsapp !== undefined) branchData.phone_contact = body.whatsapp;
      if (body.latitude !== undefined) branchData.latitude = body.latitude;
      if (body.longitude !== undefined) branchData.longitude = body.longitude;
      if (body.google_maps_url !== undefined) branchData.google_maps_url = body.google_maps_url === "" ? null : body.google_maps_url;
      if (body.is_published !== undefined) branchData.is_active = body.is_published;
      if (Object.keys(branchData).length > 0) {
        await tx.provider_branches.update({ where: { id: mainBranch.id }, data: branchData });
      }

      if (body.workSchedule && Array.isArray(body.workSchedule)) {
        await tx.provider_schedules.deleteMany({ where: { branch_id: mainBranch.id } });
        for (const item of body.workSchedule) {
          if (item.enabled) {
            const baseDate = "1970-01-01";
            const [startH, startM] = item.startTime.split(":").map(Number);
            const [endH, endM] = item.endTime.split(":").map(Number);
            await tx.provider_schedules.create({
              data: {
                id: randomUUID(),
                branch_id: mainBranch.id,
                day_of_week: getDayIdFromString(item.day),
                start_time: new Date(Date.UTC(1970, 0, 1, startH, startM, 0, 0)),
                end_time: new Date(Date.UTC(1970, 0, 1, endH, endM, 0, 0)),
                is_active: true,
              },
            });
          }
        }
      }
    });

    const updated = await prisma.providers.findFirst({
      where: { id: provider.id },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
        provider_branches: {
          where: { is_active: true },
          orderBy: [{ is_main: "desc" }],
          take: 1,
          include: { provider_schedules: { orderBy: { day_of_week: "asc" } } },
        },
        provider_catalog: true,
      },
    });

    const upBranch = updated?.provider_branches[0];
    const out = {
      id: updated?.id,
      full_name: updated?.commercial_name ?? "",
      description: updated?.description ?? "",
      logo_url: toAbsoluteLogoUrl(event, updated?.logo_url ?? null) ?? null,
      profile_picture_url: updated?.users?.profile_picture_url || updated?.logo_url || null,
      imageUrl: upBranch?.image_url || updated?.logo_url || null,
      preview_images: upBranch?.preview_images || [],
      address: upBranch?.address_text ?? "",
      phone: upBranch?.phone_contact ?? "",
      whatsapp: upBranch?.phone_contact ?? "",
      latitude: upBranch?.latitude != null ? Number(upBranch.latitude) : null,
      longitude: upBranch?.longitude != null ? Number(upBranch.longitude) : null,
      google_maps_url: upBranch?.google_maps_url ?? null,
      is_published: upBranch?.is_active ?? false,
      branch_id: upBranch?.id ?? null,
      schedules: (upBranch?.provider_schedules ?? [])
        .filter((s) => (s.is_active ?? true) && s.day_of_week != null)
        .map((s) => ({
          day_id: s.day_of_week,
          day: dayIdToSlug(s.day_of_week ?? 1),
          start: formatTimeHHmm(s.start_time),
          end: formatTimeHHmm(s.end_time),
        })),
      exams: (updated?.provider_catalog ?? []).map((e) => ({
        id: e.id,
        name: e.name ?? "",
        description: e.description ?? "",
        price: e.price != null ? Number(e.price) : 0,
        is_available: e.is_available ?? true,
      })),
    };

    return successResponse(out);
  } catch (err: any) {
    console.error("❌ [LABORATORIES] updateProfile error:", err.message);
    if (err.message?.includes("Validation")) return errorResponse(err.message, 400);
    return internalErrorResponse("Failed to update laboratory profile");
  }
}
