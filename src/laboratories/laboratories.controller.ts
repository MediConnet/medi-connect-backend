import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { AuthContext, requireAuth } from "../shared/auth";
import { formatSmartSchedule } from "../shared/helpers/scheduleFormatter";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";

// --- HELPERS ---

const extractLabId = (path: string): string | null => {
  const match = path.match(/\/api\/laboratories\/([^\/]+)/);
  if (match && match[1] !== "dashboard") {
    return match[1];
  }
  return null;
};

const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

// --- CONTROLLERS ---

/**
 * GET /api/laboratories
 * Listar laboratorios (público)
 * Soporta búsqueda vía query param: /api/laboratories?q=termino
 */
export async function getAllLaboratories(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const searchQuery = queryParams.q || "";

  console.log(`✅ [LABORATORIES] Listando. Búsqueda: "${searchQuery}"`);

  try {
    const prisma = getPrismaClient();

    const laboratoryCategory = await prisma.service_categories.findFirst({
      where: { slug: "laboratory" },
    });

    if (!laboratoryCategory) {
      return errorResponse("Categoría de laboratorios no encontrada", 404);
    }

    const allProviders = await prisma.providers.findMany({
      where: {
        category_id: laboratoryCategory.id,
        verification_status: "APPROVED",
      },
      include: {
        provider_branches: {
          where: { is_active: true, is_main: true },
          take: 1,
          include: {
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: "asc" },
            },
            cities: true,
          },
        },
      },
    });

    let filteredProviders = allProviders;

    if (searchQuery.trim().length > 0) {
      const term = normalizeText(searchQuery);

      filteredProviders = allProviders.filter((p) => {
        const mainBranch = p.provider_branches[0];

        const branchName = normalizeText(mainBranch?.name);
        const commercialName = normalizeText(p.commercial_name);
        const desc = normalizeText(p.description);

        const address = normalizeText(mainBranch?.address_text);
        const city = normalizeText((mainBranch as any).cities?.name);

        return (
          branchName.includes(term) ||
          commercialName.includes(term) ||
          desc.includes(term) ||
          address.includes(term) ||
          city.includes(term)
        );
      });
    }

    const formattedLaboratories = filteredProviders
      .map((provider) => {
        const mainBranch = provider.provider_branches[0];

        if (!mainBranch) return null;

        const schedules = mainBranch.provider_schedules || [];
        const horario = formatSmartSchedule(schedules);
        const cityName = (mainBranch as any).cities?.name || "";

        return {
          id: provider.id,
          branchId: mainBranch.id || "",
          nombre: mainBranch.name || provider.commercial_name || "Laboratorio",
          descripcion: provider.description,
          direccion: mainBranch.address_text || "",
          ciudad: cityName,
          telefono: mainBranch.phone_contact || "",
          imagen: provider.logo_url,
          calificacion: mainBranch.rating_cache
            ? parseFloat(mainBranch.rating_cache.toString())
            : 0,
          horarioAtencion: horario,
          latitud: mainBranch.latitude
            ? Number(mainBranch.latitude)
            : undefined,
          longitud: mainBranch.longitude
            ? Number(mainBranch.longitude)
            : undefined,
          codigoPostal: "",

          servicios: [],
          examenes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      })
      .filter((item) => item !== null);

    return successResponse({ laboratories: formattedLaboratories });
  } catch (error: any) {
    console.error("❌ [LABORATORIES] Error getting laboratories:", error);
    return internalErrorResponse("Error al obtener laboratorios");
  }
}

/**
 * GET /api/laboratories/:id
 * Obtener detalle de un laboratorio (público)
 */
export async function getLaboratoryById(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const path = event.requestContext.http.path;
    const laboratoryId = extractLabId(path);

    if (!laboratoryId) {
      return errorResponse("ID de laboratorio requerido", 400);
    }

    const prisma = getPrismaClient();

    const provider = await prisma.providers.findUnique({
      where: { id: laboratoryId },
      include: {
        provider_branches: {
          where: { is_active: true },
          include: {
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: "asc" },
            },
            cities: true,
          },
        },
        provider_catalog: {
          where: { is_available: true },
        },
      },
    });

    if (!provider) {
      return errorResponse("Laboratorio no encontrado", 404);
    }

    const mainBranch =
      provider.provider_branches.find((b) => b.is_main) ||
      provider.provider_branches[0];

    if (!mainBranch)
      return errorResponse("Laboratorio sin sucursales activas", 404);

    const schedules = mainBranch.provider_schedules || [];
    const horario = formatSmartSchedule(schedules);
    const cityName = (mainBranch as any).cities?.name || "";

    return successResponse({
      id: provider.id,
      branchId: mainBranch.id || "",
      nombre: mainBranch.name || provider.commercial_name || "Laboratorio",
      descripcion: provider.description,
      direccion: mainBranch.address_text || "",
      ciudad: cityName,
      telefono: mainBranch.phone_contact || "",
      whatsapp: mainBranch.phone_contact || "",
      email: mainBranch.email_contact || "",
      codigoPostal: "",
      calificacion: mainBranch.rating_cache
        ? parseFloat(mainBranch.rating_cache.toString())
        : 0,
      imagen: provider.logo_url,
      horarioAtencion: horario,
      latitud: mainBranch.latitude ? Number(mainBranch.latitude) : undefined,
      longitud: mainBranch.longitude ? Number(mainBranch.longitude) : undefined,

      servicios: [],
      examenes: provider.provider_catalog.map((exam) => ({
        id: exam.id,
        nombre: exam.name || "",
        descripcion: exam.description,
        precio: exam.price ? parseFloat(exam.price.toString()) : 0,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error: any) {
    console.error("Error getting laboratory:", error);
    return internalErrorResponse("Error al obtener laboratorio");
  }
}

/**
 * GET /api/laboratories/:userId/dashboard
 * Dashboard (Privado)
 */
export async function getLaboratoryDashboard(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;

    if (
      authContext.user.role !== "lab" &&
      authContext.user.role !== "provider"
    ) {
      return errorResponse(
        "No autorizado. Debe ser proveedor de laboratorio",
        403,
      );
    }

    const prisma = getPrismaClient();
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        provider_branches: {
          where: { is_active: true },
        },
        provider_catalog: { where: { is_available: true }, take: 10 },
        appointments: {
          take: 10,
          orderBy: { scheduled_for: "desc" },
          include: {
            patients: { select: { full_name: true, phone: true } },
          },
        },
      },
    });

    if (!provider) return errorResponse("Laboratorio no encontrado", 404);

    const mainBranch =
      provider.provider_branches.find((b) => b.is_main) ||
      provider.provider_branches[0];

    if (!mainBranch) {
      return errorResponse(
        "El proveedor no tiene sucursales activas configuradas",
        400,
      );
    }

    const totalAppointments = await prisma.appointments.count({
      where: { provider_id: provider.id },
    });
    const pendingAppointments = await prisma.appointments.count({
      where: { provider_id: provider.id, status: "CONFIRMED" },
    });
    const completedAppointments = await prisma.appointments.count({
      where: { provider_id: provider.id, status: "COMPLETED" },
    });

    return successResponse({
      laboratory: {
        id: provider.id,
        name: mainBranch.name || provider.commercial_name || "Laboratorio",
        description: provider.description,
        address: mainBranch?.address_text || "",
        phone: mainBranch?.phone_contact || "",
        whatsapp: mainBranch?.phone_contact || "",
      },
      stats: { totalAppointments, pendingAppointments, completedAppointments },
      recentAppointments: provider.appointments.map((apt) => ({
        id: apt.id,
        patientName: apt.patients?.full_name || "Paciente",
        patientPhone: apt.patients?.phone || "",
        examName: apt.reason || "Examen",
        scheduledFor: apt.scheduled_for,
        status: apt.status,
        createdAt: apt.scheduled_for,
      })),
      availableExams: provider.provider_catalog.map((exam) => ({
        id: exam.id,
        name: exam.name || "",
        description: exam.description,
        price: exam.price ? parseFloat(exam.price.toString()) : 0,
        preparation: exam.description,
      })),
    });
  } catch (error: any) {
    console.error("Error getting laboratory dashboard:", error);
    return errorResponse(error.message || "Error al obtener dashboard", 500);
  }
}
