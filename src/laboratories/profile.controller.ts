import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { enum_roles } from "../generated/prisma/client";
import { AuthContext, requireRole } from "../shared/auth";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from "../shared/response";
import { parseBody, updateLaboratoryProfileSchema } from "../shared/validators";

const LAB_CATEGORY_SLUGS = ["laboratory", "laboratorio"];

function dayNumberToString(day: number): string {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return days[day] ?? "Desconocido";
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
        provider_branches: {
          where: { is_main: true },
          take: 1,
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
      logo_url: provider.logo_url ?? null,
      address: mainBranch?.address_text ?? "",
      phone: mainBranch?.phone_contact ?? "",
      whatsapp: mainBranch?.phone_contact ?? "",
      latitude: mainBranch?.latitude != null ? Number(mainBranch.latitude) : null,
      longitude: mainBranch?.longitude != null ? Number(mainBranch.longitude) : null,
      google_maps_url: mainBranch?.google_maps_url ?? null,
      is_published: mainBranch?.is_active ?? false,
      branch_id: mainBranch?.id ?? null,
      schedules: (mainBranch?.provider_schedules ?? []).map((s) => ({
        day_id: s.day_of_week,
        day: dayNumberToString(s.day_of_week ?? 0),
        start: s.start_time,
        end: s.end_time,
        is_active: true,
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
        provider_branches: { where: { is_main: true }, take: 1 },
      },
    });

    if (!provider) return notFoundResponse("Laboratory profile not found");

    const mainBranch = provider.provider_branches[0];
    if (!mainBranch) return notFoundResponse("Laboratory branch not found");

    await prisma.$transaction(async (tx) => {
      const providerData: Record<string, unknown> = {};
      if (body.full_name !== undefined) providerData.commercial_name = body.full_name;
      if (body.description !== undefined) providerData.description = body.description;
      if (body.logo_url !== undefined) providerData.logo_url = body.logo_url === "" ? null : body.logo_url;
      if (Object.keys(providerData).length > 0) {
        await tx.providers.update({ where: { id: provider.id }, data: providerData });
      }

      const branchData: Record<string, unknown> = {};
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
            await tx.provider_schedules.create({
              data: {
                id: randomUUID(),
                branch_id: mainBranch.id,
                day_of_week: getDayIdFromString(item.day),
                start_time: new Date(`${baseDate}T${item.startTime}:00Z`),
                end_time: new Date(`${baseDate}T${item.endTime}:00Z`),
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
        provider_branches: {
          where: { is_main: true },
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
      logo_url: updated?.logo_url ?? null,
      address: upBranch?.address_text ?? "",
      phone: upBranch?.phone_contact ?? "",
      whatsapp: upBranch?.phone_contact ?? "",
      latitude: upBranch?.latitude != null ? Number(upBranch.latitude) : null,
      longitude: upBranch?.longitude != null ? Number(upBranch.longitude) : null,
      google_maps_url: upBranch?.google_maps_url ?? null,
      is_published: upBranch?.is_active ?? false,
      branch_id: upBranch?.id ?? null,
      schedules: (upBranch?.provider_schedules ?? []).map((s) => ({
        day_id: s.day_of_week,
        day: dayNumberToString(s.day_of_week ?? 0),
        start: s.start_time,
        end: s.end_time,
        is_active: true,
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
