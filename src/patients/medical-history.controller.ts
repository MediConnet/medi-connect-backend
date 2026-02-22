import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from "../shared/response";
import { extractIdFromPath } from "../shared/validators";

// --- GET MEDICAL HISTORY ---
export async function getMedicalHistory(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] GET /api/patients/medical-history - Obteniendo historial médico",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      console.log(
        "⚠️ [PATIENTS] Paciente no encontrado, retornando array vacío",
      );
      return successResponse([]);
    }

    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit || "50", 10);
    const offset = parseInt(queryParams.offset || "0", 10);
    const search = queryParams.search?.trim();

    const whereClause: any = { patient_id: patient.id };

    if (search) {
      whereClause.OR = [
        { diagnosis: { contains: search, mode: "insensitive" } },
        { doctor_name_snapshot: { contains: search, mode: "insensitive" } },
        { specialty_snapshot: { contains: search, mode: "insensitive" } },
        { treatment: { contains: search, mode: "insensitive" } },
        { indications: { contains: search, mode: "insensitive" } },
        { observations: { contains: search, mode: "insensitive" } },
      ];

      const isYear = /^\d{4}$/.test(search);
      if (isYear) {
        const searchYear = parseInt(search, 10);

        whereClause.OR.push({
          date: {
            gte: new Date(`${searchYear}-01-01T00:00:00.000Z`),
            lt: new Date(`${searchYear + 1}-01-01T00:00:00.000Z`),
          },
        });
      }
    }

    // Obtener historial médico
    const history = await prisma.medical_history.findMany({
      where: whereClause,
      include: {
        providers: {
          select: {
            id: true,
            commercial_name: true,
            logo_url: true,
            service_categories: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: limit,
      skip: offset,
    });

    console.log(
      `✅ [PATIENTS] Se encontraron ${history.length} registros de historial`,
    );
    return successResponse(
      history.map((record) => ({
        id: record.id,
        date: record.date,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        indications: record.indications,
        observations: record.observations,
        doctorName: record.doctor_name_snapshot,
        specialty: record.specialty_snapshot,
        provider: record.providers
          ? {
              id: record.providers.id,
              name: record.providers.commercial_name,
              logoUrl: record.providers.logo_url,
              category: record.providers.service_categories?.name || null,
            }
          : null,
        createdAt: record.created_at,
      })),
    );
  } catch (error: any) {
    console.error(
      "❌ [PATIENTS] Error al obtener historial médico:",
      error.message,
    );
    logger.error("Error getting medical history", error);
    return internalErrorResponse("Failed to get medical history");
  }
}

// --- GET MEDICAL HISTORY BY ID ---
export async function getMedicalHistoryById(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] GET /api/patients/medical-history/:id - Obteniendo detalle de registro",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const recordId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/medical-history/",
      "",
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return notFoundResponse("Patient not found");
    }

    const record = await prisma.medical_history.findUnique({
      where: { id: recordId },
      include: {
        providers: {
          select: {
            id: true,
            commercial_name: true,
            logo_url: true,
            description: true,
            service_categories: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      return notFoundResponse("Medical history record not found");
    }

    if (record.patient_id !== patient.id) {
      return errorResponse("Access denied", 403);
    }

    console.log("✅ [PATIENTS] Registro obtenido exitosamente");
    return successResponse({
      id: record.id,
      date: record.date,
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      indications: record.indications,
      observations: record.observations,
      doctorName: record.doctor_name_snapshot,
      specialty: record.specialty_snapshot,
      provider: record.providers
        ? {
            id: record.providers.id,
            name: record.providers.commercial_name,
            logoUrl: record.providers.logo_url,
            description: record.providers.description,
            category: record.providers.service_categories?.name || null,
          }
        : null,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al obtener registro:", error.message);
    logger.error("Error getting medical history record", error);
    if (error.message.includes("Invalid path format")) {
      return errorResponse("Invalid record ID", 400);
    }
    return internalErrorResponse("Failed to get medical history record");
  }
}
