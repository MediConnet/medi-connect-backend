import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { formatSmartSchedule } from "../shared/helpers/scheduleFormatter";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";

// --- HELPERS ---

/**
 * Normaliza el texto: elimina tildes, pasa a minúsculas y elimina espacios extra.
 */
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

/**
 * Función Helper para mapear el objeto de base de datos al formato del frontend.
 */
function mapDoctorData(doctor: any) {
  const mainBranch =
    doctor.provider_branches.find((b: any) => b.is_main) ||
    doctor.provider_branches[0];

  const clinicName = doctor.users?.clinic_doctors?.[0]?.clinics?.name || null;

  // Extraer nombres de especialidades
  const especialidadesList =
    doctor.provider_specialties
      ?.map((ps: any) => ps.specialties?.name)
      .filter(Boolean) || [];

  const tarifasPorEspecialidad: Record<string, number> = {};

  if (
    doctor.provider_specialties &&
    Array.isArray(doctor.provider_specialties)
  ) {
    doctor.provider_specialties.forEach((ps: any) => {
      const specName = ps.specialties?.name;
      if (specName) {
        tarifasPorEspecialidad[specName] = ps.fee ? Number(ps.fee) : 0;
      }
    });
  }

  const primarySpecialtyRecord = doctor.provider_specialties?.[0] || null;
  const tarifaBase = primarySpecialtyRecord?.fee
    ? Number(primarySpecialtyRecord.fee)
    : 0;

  const schedules = mainBranch?.provider_schedules || [];

  return {
    id: doctor.id,
    nombre: doctor.commercial_name || "",
    apellido: "",

    especialidad: especialidadesList[0] || "",
    especialidadId: primarySpecialtyRecord?.specialty_id || "",

    especialidades: especialidadesList,
    clinica: clinicName,

    descripcion: doctor.description || "",
    experiencia: doctor.years_of_experience || 0,
    registro: "",
    telefono: mainBranch?.phone_contact || "",
    email: doctor.users?.email || "",
    direccion: mainBranch?.address_text || "",
    ciudad: mainBranch?.cities?.name || "",
    codigoPostal: "",

    horarioAtencion: formatSmartSchedule(schedules),

    imagen: doctor.logo_url || doctor.users?.profile_picture_url || "",
    calificacion: mainBranch?.rating_cache
      ? Number(mainBranch.rating_cache)
      : 0,
    latitud: mainBranch?.latitude ? Number(mainBranch.latitude) : null,
    longitud: mainBranch?.longitude ? Number(mainBranch.longitude) : null,

    tarifas: {
      consulta: tarifaBase,
      ...tarifasPorEspecialidad,
    },

    formasPago: mainBranch?.payment_methods || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// --- CONTROLLERS ---

/**
 * Listar médicos públicos (sin autenticación)
 * GET /api/public/doctors
 * Soporta filtros:
 * - specialtyId: Filtra por categoría (DB)
 * - q (o search): Búsqueda de texto insensible a tildes (Nombre, ciudad, clinica)
 * - page / limit: Paginación
 */
export async function getAllDoctors(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const searchQuery = queryParams.q || queryParams.search || "";

  console.log(
    `✅ [PUBLIC DOCTORS] Listando. Búsqueda: "${searchQuery}", Filtros:`,
    queryParams,
  );

  try {
    const prisma = getPrismaClient();

    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "20", 10);
    const offset = (page - 1) * limit;

    const specialtyId = queryParams.specialtyId;
    const cityParam = queryParams.city;

    const where: any = {
      verification_status: "APPROVED",
      category_id: 1,
      users: {
        is_active: true,
      },
      provider_branches: {
        some: {
          is_active: true,
        },
      },
    };

    if (specialtyId) {
      where.provider_specialties = {
        some: { specialty_id: specialtyId },
      };
    }

    const allDoctors = await prisma.providers.findMany({
      where,
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
            clinic_doctors: {
              where: { is_active: true },
              take: 1,
              select: {
                clinics: { select: { name: true } },
              },
            },
          },
        },
        provider_specialties: {
          include: {
            specialties: {
              select: { id: true, name: true, color_hex: true },
            },
          },
        },
        provider_branches: {
          where: { is_active: true },
          include: {
            cities: { select: { id: true, name: true } },
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: "asc" },
            },
          },
        },
      },
      orderBy: {
        commercial_name: "asc",
      },
    });

    let filteredDoctors = allDoctors;

    if (searchQuery.trim().length > 0 || cityParam) {
      const term = normalizeText(searchQuery);
      const cityTerm = normalizeText(cityParam);

      filteredDoctors = allDoctors.filter((doc) => {
        const name = normalizeText(doc.commercial_name);
        const description = normalizeText(doc.description);

        const branchesText = doc.provider_branches
          .map((b) => {
            return (
              normalizeText(b.address_text) +
              " " +
              normalizeText(b.cities?.name)
            );
          })
          .join(" ");

        const clinicName = normalizeText(
          doc.users?.clinic_doctors?.[0]?.clinics?.name,
        );

        const matchesSearch =
          term === "" ||
          name.includes(term) ||
          description.includes(term) ||
          branchesText.includes(term) ||
          clinicName.includes(term);

        const matchesCity = cityTerm === "" || branchesText.includes(cityTerm);

        return matchesSearch && matchesCity;
      });
    }

    const total = filteredDoctors.length;
    const paginatedDoctors = filteredDoctors.slice(offset, offset + limit);

    const formattedDoctors = paginatedDoctors.map(mapDoctorData);

    console.log(
      `✅ [PUBLIC DOCTORS] Retornando ${formattedDoctors.length} de ${total} doctores.`,
    );

    return successResponse(
      {
        doctors: formattedDoctors,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      200,
      event,
    );
  } catch (error: any) {
    console.error(
      "❌ [PUBLIC DOCTORS] Error al listar médicos:",
      error.message,
    );
    logger.error("Error fetching public doctors", error);
    return internalErrorResponse("Error al obtener doctores", event);
  }
}

/**
 * Obtener médico público por ID
 * GET /api/public/doctors/{id}
 */
export async function getDoctorById(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PUBLIC DOCTORS] GET /api/public/doctors/{id} - Obteniendo médico",
  );

  try {
    const pathParts = event.requestContext.http.path.split("/");
    const doctorId = pathParts[pathParts.length - 1];

    if (!doctorId) {
      return errorResponse("ID de doctor requerido", 400, undefined, event);
    }

    const prisma = getPrismaClient();

    const doctor = await prisma.providers.findFirst({
      where: {
        id: doctorId,
        verification_status: "APPROVED",
        category_id: 1,
        users: { is_active: true },
        provider_branches: { some: { is_active: true } },
      },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
            clinic_doctors: {
              where: { is_active: true },
              take: 1,
              select: {
                clinics: { select: { name: true } },
              },
            },
          },
        },
        provider_specialties: {
          include: {
            specialties: {
              select: {
                id: true,
                name: true,
                color_hex: true,
                description: true,
              },
            },
          },
        },
        provider_branches: {
          where: { is_active: true },
          include: {
            cities: { select: { id: true, name: true, state: true } },
            provider_schedules: {
              where: { is_active: true },
              orderBy: { day_of_week: "asc" },
            },
          },
        },
      },
    });

    if (!doctor) {
      return errorResponse("Doctor no encontrado", 404, undefined, event);
    }

    const formattedDoctor = mapDoctorData(doctor);

    return successResponse(formattedDoctor, 200, event);
  } catch (error: any) {
    console.error(
      "❌ [PUBLIC DOCTORS] Error al obtener médico:",
      error.message,
    );
    logger.error("Error fetching doctor by id", error);
    return internalErrorResponse("Error al obtener doctor", event);
  }
}
