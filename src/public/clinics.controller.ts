import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { getPrismaClient } from "../shared/prisma";
import { errorResponse, internalErrorResponse, paginatedResponse, successResponse } from "../shared/response";
import { logger } from "../shared/logger";
import { formatSmartSchedule } from "../shared/helpers/scheduleFormatter";

const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

export async function getClinics(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const searchQuery = queryParams.q || queryParams.search || "";
  const page = parseInt(queryParams.page || "1", 10);
  const limit = parseInt(queryParams.limit || "20", 10);
  const offset = (page - 1) * limit;

  try {
    const prisma = getPrismaClient();

    const where: any = {
      is_active: true,
      users: { is_active: true }
    };

    if (searchQuery.trim().length > 0) {
      where.OR = [
        { name: { contains: searchQuery.trim(), mode: 'insensitive' } },
        { address: { contains: searchQuery.trim(), mode: 'insensitive' } },
      ];
    }

    const total = await prisma.clinics.count({ where });
    const clinics = await prisma.clinics.findMany({
      where,
      select: {
        id: true,
        name: true,
        logo_url: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
        clinic_specialties: {
          select: { specialty: true }
        }
      },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    });

    const formattedClinics = clinics.map((c: any) => ({
      id: c.id,
      name: c.name,
      logoUrl: c.logo_url,
      address: c.address,
      phone: c.phone,
      latitude: c.latitude ? Number(c.latitude) : null,
      longitude: c.longitude ? Number(c.longitude) : null,
      specialties: c.clinic_specialties.map((cs: any) => cs.specialty)
    }));

    return paginatedResponse(formattedClinics, total, page, limit, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al listar clínicas:", error.message);
    return internalErrorResponse("Error al obtener clínicas", event);
  }
}

export async function getClinicById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const pathParts = event.requestContext.http.path.split("/");
    const clinicId = pathParts[pathParts.length - 1];

    if (!clinicId) return errorResponse("ID de clínica requerido", 400, undefined, event);

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
                provider_branches: true
              }
            }
          }
        }
      }
    });

    if (!clinic) return errorResponse("Clínica no encontrada", 404, undefined, event);

    let gallery: string[] = [];
    const provider = clinic.users?.providers?.[0];
    if (provider) {
        const branch = provider.provider_branches?.[0];
        if (branch && (branch as any).preview_images) {
            gallery = (branch as any).preview_images;
        }
    }

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
      specialties: clinic.clinic_specialties.map((cs: any) => cs.specialty),
      horarioAtencion: formatSmartSchedule(clinic.clinic_schedules as any),
      gallery
    };

    return successResponse(formattedClinic, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al obtener clínica:", error.message);
    return internalErrorResponse("Error al obtener clínica", event);
  }
}

export async function getClinicSpecialties(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const pathParts = event.requestContext.http.path.split("/");
    const idIndex = pathParts.indexOf("clinics") + 1;
    const clinicId = pathParts[idIndex];

    if (!clinicId) return errorResponse("ID de clínica requerido", 400, undefined, event);

    const prisma = getPrismaClient();

    const specialties = await prisma.clinic_specialties.findMany({
      where: { clinic_id: clinicId },
      select: { specialty: true }
    });

    return successResponse(specialties.map((s: any) => s.specialty), 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al obtener especialidades:", error.message);
    return internalErrorResponse("Error al obtener especialidades", event);
  }
}

export async function getClinicDoctors(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const pathParts = event.requestContext.http.path.split("/");
    const idIndex = pathParts.indexOf("clinics") + 1;
    const clinicId = pathParts[idIndex];
    
    if (!clinicId) return errorResponse("ID de clínica requerido", 400, undefined, event);

    const queryParams = event.queryStringParameters || {};
    const specialty = queryParams.specialty; 

    const prisma = getPrismaClient();

    const clinicDoctors = await prisma.clinic_doctors.findMany({
      where: {
        clinic_id: clinicId,
        is_active: true,
        users: {
          is_active: true,
          providers: {
            some: {
              verification_status: 'APPROVED',
            }
          }
        }
      },
      include: {
        users: {
          include: {
            providers: {
              include: {
                provider_specialties: {
                  include: {
                    specialties: true
                  }
                },
                provider_branches: true
              }
            }
          }
        }
      }
    });

    let doctorsList = clinicDoctors.map((cd: any) => {
      const provider = cd.users?.providers?.[0];
      if (!provider) return null;
      
      const branch = provider.provider_branches?.[0];
      const especialidadesList = provider.provider_specialties?.map((ps: any) => ps.specialties?.name).filter(Boolean) || [];
      const primarySpecialtyRecord = provider.provider_specialties?.[0] || null;
      const tarifaBase = primarySpecialtyRecord?.fee ? Number(primarySpecialtyRecord.fee) : 0;

      return {
        id: provider.id,
        nombre: provider.commercial_name || "",
        especialidad: especialidadesList[0] || "",
        especialidades: especialidadesList,
        experiencia: provider.years_of_experience || 0,
        tarifas: { consulta: tarifaBase },
        imagen: provider.logo_url || cd.users?.profile_picture_url || ""
      };
    }).filter((d: any) => d !== null);

    if (specialty) {
        const specNormalized = normalizeText(specialty);
        doctorsList = doctorsList.filter((d: any) => 
            d?.especialidades.some((s: string) => normalizeText(s).includes(specNormalized))
        );
    }

    return paginatedResponse(doctorsList, doctorsList.length, 1, 100, 200, event);
  } catch (error: any) {
    console.error("❌ [PUBLIC CLINICS] Error al obtener médicos:", error.message);
    return internalErrorResponse("Error al obtener médicos de la clínica", event);
  }
}
