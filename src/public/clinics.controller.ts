import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { getPrismaClient } from "../shared/prisma";
import { errorResponse, internalErrorResponse, paginatedResponse, successResponse } from "../shared/response";
import { logger } from "../shared/logger";
import { formatSmartSchedule } from "../shared/helpers/scheduleFormatter";

const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

/**
 * GET /api/public/clinics
 * Listar clínicas activas con paginación, búsqueda y filtros
 */
export async function getClinics(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC CLINICS] GET /api/public/clinics - Listando clínicas');

  const queryParams = event.queryStringParameters || {};
  const searchQuery = queryParams.q || queryParams.search || "";
  const page = Math.max(1, parseInt(queryParams.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || "20", 10)));
  const offset = (page - 1) * limit;
  const specialty = queryParams.specialty || queryParams.especialidad || "";
  const city = queryParams.city || queryParams.ciudad || "";

  try {
    const prisma = getPrismaClient();

    const where: any = {
      is_active: true,
      users: { is_active: true }
    };

    const AND: any[] = [];

    if (searchQuery.trim().length > 0) {
      AND.push({
        OR: [
          { name: { contains: searchQuery.trim(), mode: 'insensitive' } },
          { address: { contains: searchQuery.trim(), mode: 'insensitive' } },
          { phone: { contains: searchQuery.trim() } },
        ],
      });
    }

    if (specialty.trim().length > 0) {
      AND.push({
        clinic_specialties: {
          some: {
            specialty: { contains: specialty.trim(), mode: 'insensitive' },
          },
        },
      });
    }

    if (city.trim().length > 0) {
      AND.push({
        address: { contains: city.trim(), mode: 'insensitive' },
      });
    }

    if (AND.length > 0) {
      where.AND = AND;
    }

    console.log(`🔍 [PUBLIC CLINICS] Query params: page=${page}, limit=${limit}, search="${searchQuery}", specialty="${specialty}", city="${city}"`);

    const [clinics, total] = await Promise.all([
      prisma.clinics.findMany({
        where,
        select: {
          id: true,
          name: true,
          logo_url: true,
          address: true,
          phone: true,
          whatsapp: true,
          latitude: true,
          longitude: true,
          clinic_specialties: {
            select: { specialty: true }
          }
        },
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.clinics.count({ where }),
    ]);

    const formattedClinics = (clinics || []).map((c) => ({
      id: c.id,
      name: c.name,
      logoUrl: c.logo_url,
      address: c.address,
      phone: c.phone,
      whatsapp: c.whatsapp,
      latitude: c.latitude ? Number(c.latitude) : null,
      longitude: c.longitude ? Number(c.longitude) : null,
      specialties: (c.clinic_specialties || []).map((cs) => cs.specialty),
    }));

    console.log(`✅ [PUBLIC CLINICS] ${formattedClinics.length} clínicas devueltas (total: ${total})`);
    return paginatedResponse(formattedClinics, total, page, limit, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al listar clínicas:", error.message);
    logger.error("Error listing clinics", error);
    return internalErrorResponse("Error al obtener clínicas", event);
  }
}

/**
 * GET /api/public/clinics/:id
 * Obtener detalle completo de una clínica
 */
export async function getClinicById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC CLINICS] GET /api/public/clinics/:id - Obteniendo detalle');

  try {
    const pathParts = event.requestContext.http.path.split("/");
    const clinicId = pathParts[pathParts.length - 1];

    if (!clinicId) {
      return errorResponse("ID de clínica requerido", 400, undefined, event);
    }

    const prisma = getPrismaClient();

    const clinic = await prisma.clinics.findFirst({
      where: {
        id: clinicId,
        is_active: true,
        users: { is_active: true }
      },
      include: {
        clinic_specialties: true,
        clinic_schedules: {
          where: { enabled: true },
          orderBy: { day_of_week: 'asc' }
        },
        users: {
          include: {
            providers: {
              include: {
                provider_branches: {
                  select: {
                    preview_images: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!clinic) {
      return errorResponse("Clínica no encontrada", 404, undefined, event);
    }

    let gallery: string[] = [];
    const provider = clinic.users?.providers?.[0];
    if (provider) {
      const branch = provider.provider_branches?.[0];
      if (branch && Array.isArray((branch as any).preview_images)) {
        gallery = (branch as any).preview_images;
      }
    }

    const specialties = (clinic.clinic_specialties || []).map((cs) => cs.specialty);

    const formattedClinic = {
      id: clinic.id,
      name: clinic.name,
      logoUrl: clinic.logo_url,
      address: clinic.address,
      phone: clinic.phone,
      whatsapp: clinic.whatsapp,
      description: clinic.description || "",
      latitude: clinic.latitude ? Number(clinic.latitude) : null,
      longitude: clinic.longitude ? Number(clinic.longitude) : null,
      googleMapsUrl: clinic.google_maps_url,
      specialties,
      horarioAtencion: formatSmartSchedule(clinic.clinic_schedules as any),
      gallery,
    };

    console.log(`✅ [PUBLIC CLINICS] Clínica encontrada: ${clinic.name}`);
    return successResponse(formattedClinic, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al obtener clínica:", error.message);
    logger.error("Error getting clinic by id", error);
    return internalErrorResponse("Error al obtener clínica", event);
  }
}

/**
 * GET /api/public/clinics/:id/specialties
 * Obtener especialidades de una clínica
 */
export async function getClinicSpecialties(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC CLINICS] GET /api/public/clinics/:id/specialties');

  try {
    const pathParts = event.requestContext.http.path.split("/");
    const idIndex = pathParts.indexOf("clinics") + 1;
    const clinicId = pathParts[idIndex];

    if (!clinicId) {
      return errorResponse("ID de clínica requerido", 400, undefined, event);
    }

    const prisma = getPrismaClient();

    const specialties = await prisma.clinic_specialties.findMany({
      where: { clinic_id: clinicId },
      select: { specialty: true }
    });

    const specialtyList = (specialties || []).map((s) => s.specialty);

    console.log(`✅ [PUBLIC CLINICS] ${specialtyList.length} especialidades encontradas`);
    return successResponse(specialtyList, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al obtener especialidades:", error.message);
    logger.error("Error getting clinic specialties", error);
    return internalErrorResponse("Error al obtener especialidades", event);
  }
}

/**
 * GET /api/public/clinics/:id/doctors
 * Obtener médicos de una clínica con paginación y filtro por especialidad
 */
export async function getClinicDoctors(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PUBLIC CLINICS] GET /api/public/clinics/:id/doctors');

  try {
    const pathParts = event.requestContext.http.path.split("/");
    const idIndex = pathParts.indexOf("clinics") + 1;
    const clinicId = pathParts[idIndex];

    if (!clinicId) {
      return errorResponse("ID de clínica requerido", 400, undefined, event);
    }

    const queryParams = event.queryStringParameters || {};
    const specialty = queryParams.specialty || "";
    const page = Math.max(1, parseInt(queryParams.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || "20", 10)));
    const offset = (page - 1) * limit;

    console.log(`🔍 [PUBLIC CLINICS] Doctors query: clinicId=${clinicId}, specialty="${specialty}", page=${page}, limit=${limit}`);

    const prisma = getPrismaClient();

    const whereDoctors: any = {
      clinic_id: clinicId,
      is_active: true,
      is_invited: false,
      users: {
        is_active: true,
        providers: {
          some: {
            verification_status: 'APPROVED',
          },
        },
      },
    };

    const [total, clinicDoctors] = await Promise.all([
      prisma.clinic_doctors.count({ where: whereDoctors }),
      prisma.clinic_doctors.findMany({
        where: whereDoctors,
        include: {
          users: {
            include: {
              providers: {
                include: {
                  provider_specialties: {
                    include: {
                      specialties: true,
                    },
                  },
                  provider_branches: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    let doctorsList = (clinicDoctors || []).map((cd) => {
      const provider = cd.users?.providers?.[0];
      if (!provider) return null;

      const providerSpecialties = provider.provider_specialties || [];
      const especialidadesList = providerSpecialties
        .map((ps) => ps.specialties?.name)
        .filter((name): name is string => Boolean(name));
      const primarySpecialtyRecord = providerSpecialties[0];
      const tarifaBase = primarySpecialtyRecord?.fee ? Number(primarySpecialtyRecord.fee) : 0;

      return {
        id: provider.id,
        nombre: provider.commercial_name || "",
        especialidad: especialidadesList[0] || "",
        especialidades: especialidadesList,
        experiencia: provider.years_of_experience || 0,
        tarifas: { consulta: tarifaBase },
        imagen: provider.logo_url || cd.users?.profile_picture_url || "",
      };
    }).filter((d): d is NonNullable<typeof d> => d !== null);

    if (specialty.trim().length > 0) {
      const specNormalized = normalizeText(specialty);
      doctorsList = doctorsList.filter((d) =>
        d.especialidades.some((s) => normalizeText(s).includes(specNormalized))
      );
    }

    console.log(`✅ [PUBLIC CLINICS] ${doctorsList.length} médicos devueltos (total: ${total})`);
    return paginatedResponse(doctorsList, total, page, limit, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al obtener médicos:", error.message);
    logger.error("Error getting clinic doctors", error);
    return internalErrorResponse("Error al obtener médicos de la clínica", event);
  }
}
