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

  const clinicData = doctor.users?.clinic_doctors?.[0]?.clinics;
  const clinicName = clinicData?.name || null;
  const clinicSchedules = clinicData?.clinic_schedules || [];

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

  const schedules =
    clinicSchedules.length > 0
      ? clinicSchedules
      : mainBranch?.provider_schedules || [];

  return {
    id: doctor.id,
    branchId: mainBranch?.id || "",
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
                clinics: {
                  select: {
                    name: true,
                    clinic_schedules: {
                      where: { enabled: true },
                      orderBy: { day_of_week: "asc" },
                    },
                  },
                },
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
                clinics: {
                  select: {
                    name: true,
                    clinic_schedules: {
                      where: { enabled: true },
                      orderBy: { day_of_week: "asc" },
                    },
                  },
                },
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

/**
 * Obtener tipos de consulta de un médico (endpoint público)
 * GET /api/public/doctors/{doctorId}/consultation-prices
 * 
 * Este endpoint es público y puede ser accedido por pacientes
 * para ver los tipos de consulta disponibles de un médico.
 */
export async function getDoctorConsultationPrices(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PUBLIC DOCTORS] GET /api/public/doctors/{doctorId}/consultation-prices - Obteniendo tipos de consulta",
  );

  try {
    const pathParts = event.requestContext.http.path.split("/");
    // Path: /api/public/doctors/{doctorId}/consultation-prices
    const doctorIdIndex = pathParts.indexOf("doctors") + 1;
    const doctorId = pathParts[doctorIdIndex];

    console.log(`🔍 [PUBLIC DOCTORS] Doctor ID recibido: ${doctorId}`);

    if (!doctorId || doctorId === "consultation-prices") {
      console.error("❌ [PUBLIC DOCTORS] ID de doctor no proporcionado o inválido");
      return errorResponse("ID de doctor requerido", 400, undefined, event);
    }

    const prisma = getPrismaClient();

    // Verificar que el doctor existe y está activo
    const doctor = await prisma.providers.findFirst({
      where: {
        id: doctorId,
        verification_status: "APPROVED",
        category_id: 1,
        users: { is_active: true },
      },
      select: { id: true, commercial_name: true },
    });

    if (!doctor) {
      console.log(`⚠️ [PUBLIC DOCTORS] Doctor ${doctorId} no encontrado o no activo`);
      return errorResponse("Doctor no encontrado", 404, undefined, event);
    }

    console.log(`✅ [PUBLIC DOCTORS] Doctor encontrado: ${doctor.commercial_name}`);

    // Obtener tipos de consulta activos del médico
    const consultationPrices = await prisma.consultation_prices.findMany({
      where: {
        provider_id: doctorId,
        is_active: true,
      },
      include: {
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { specialty_id: "asc" },
        { price: "asc" },
      ],
    });

    console.log(`📊 [PUBLIC DOCTORS] Encontrados ${consultationPrices.length} tipos de consulta`);

    // Si no hay datos, verificar si existen pero están inactivos
    if (consultationPrices.length === 0) {
      const inactiveCount = await prisma.consultation_prices.count({
        where: {
          provider_id: doctorId,
          is_active: false,
        },
      });
      
      const totalCount = await prisma.consultation_prices.count({
        where: {
          provider_id: doctorId,
        },
      });
      
      console.log(`ℹ️ [PUBLIC DOCTORS] Tipos inactivos: ${inactiveCount}, Total en BD: ${totalCount}`);
    }

    // Formatear respuesta según especificación del frontend
    const formattedPrices = consultationPrices.map((cp) => ({
      id: cp.id,
      specialtyId: cp.specialty_id,
      specialtyName: cp.specialties?.name || null,
      consultationType: cp.consultation_type,
      price: parseFloat(cp.price.toString()),
      isActive: cp.is_active,
    }));

    console.log(`✅ [PUBLIC DOCTORS] Retornando ${formattedPrices.length} tipos de consulta`);
    
    // Log de los datos para debugging
    if (formattedPrices.length > 0) {
      console.log(`📋 [PUBLIC DOCTORS] Datos:`, JSON.stringify(formattedPrices, null, 2));
    }

    return successResponse(formattedPrices, 200, event);
  } catch (error: any) {
    console.error(
      "❌ [PUBLIC DOCTORS] Error al obtener tipos de consulta:",
      error.message,
    );
    console.error("❌ [PUBLIC DOCTORS] Stack:", error.stack);
    logger.error("Error fetching doctor consultation prices", error);
    return internalErrorResponse("Error al obtener tipos de consulta", event);
  }
}
