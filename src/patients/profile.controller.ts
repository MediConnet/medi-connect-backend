import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  successResponse,
} from "../shared/response";
import { parseBody, updatePatientProfileSchema } from "../shared/validators";

// --- GET PROFILE ---
export async function getProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] GET /api/patients/profile - Obteniendo perfil del paciente",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    console.error(
      "❌ [PATIENTS] GET /api/patients/profile - Error de autenticación",
    );
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar el paciente asociado al usuario
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
            created_at: true,
          },
        },
      },
    });

    if (!patient) {
      console.log(
        "⚠️ [PATIENTS] Paciente no encontrado, retornando perfil básico del usuario",
      );
      return successResponse({
        id: authContext.user.id,
        email: authContext.user.email,
        profile_picture_url: authContext.user.profile_picture_url,
        first_name: null,
        last_name: null,
        full_name: null,
        phone: null,
        identification: null,
        birth_date: null,
        address: null,
        is_patient_created: false,
      });
    }

    const nameParts = (patient.full_name || "").trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    console.log("✅ [PATIENTS] Perfil obtenido exitosamente");
    return successResponse({
      id: patient.id,
      email: patient.users?.email || authContext.user.email,
      profile_picture_url: patient.users?.profile_picture_url || null,
      first_name: firstName,
      last_name: lastName,
      full_name: patient.full_name,
      phone: patient.phone,
      identification: patient.identification,
      birth_date: patient.birth_date
        ? new Date(patient.birth_date).toISOString().split("T")[0]
        : null,
      address: patient.address_text,
      is_patient_created: true,
      created_at: patient.users?.created_at,
    });
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al obtener perfil:", error.message);
    logger.error("Error getting patient profile", error);
    return internalErrorResponse("Failed to get patient profile");
  }
}

// --- UPDATE PROFILE ---
export async function updateProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] PUT /api/patients/profile - Actualizando perfil del paciente",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    console.error(
      "❌ [PATIENTS] PUT /api/patients/profile - Error de autenticación",
    );
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, updatePatientProfileSchema);

    const firstName = body.first_name || body.firstName || "";
    const lastName = body.last_name || body.lastName || "";

    let computedFullName = body.full_name;
    if (firstName || lastName) {
      computedFullName = [firstName, lastName].filter(Boolean).join(" ");
    }

    const userUpdateData: any = {};
    if (body.email !== undefined) userUpdateData.email = body.email;
    if (body.profile_picture_url !== undefined)
      userUpdateData.profile_picture_url = body.profile_picture_url;

    if (Object.keys(userUpdateData).length > 0) {
      try {
        await prisma.users.update({
          where: { id: authContext.user.id },
          data: userUpdateData,
        });
        console.log("📝 [USERS] Datos de usuario (email/foto) actualizados");
      } catch (error: any) {
        if (error.code === "P2002") {
          return errorResponse(
            "El correo electrónico ingresado ya está en uso por otra cuenta.",
            400,
          );
        }
        throw error;
      }
    }

    let patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      console.log("📝 [PATIENTS] Creando nuevo registro de paciente");
      const { randomUUID } = await import("crypto");

      patient = await prisma.patients.create({
        data: {
          id: randomUUID(),
          user_id: authContext.user.id,
          full_name: computedFullName || "",
          phone: body.phone || null,
          identification: body.identification || null,
          birth_date: body.birth_date ? new Date(body.birth_date) : null,
          address_text: body.address || null,
        },
      });
    } else {
      // Actualizar paciente existente
      console.log("📝 [PATIENTS] Actualizando registro de paciente existente");
      patient = await prisma.patients.update({
        where: { id: patient.id },
        data: {
          full_name:
            computedFullName !== undefined
              ? computedFullName
              : patient.full_name,
          phone: body.phone !== undefined ? body.phone : patient.phone,
          identification:
            body.identification !== undefined
              ? body.identification
              : patient.identification,
          birth_date:
            body.birth_date !== undefined
              ? body.birth_date
                ? new Date(body.birth_date)
                : null
              : patient.birth_date,
          address_text:
            body.address !== undefined ? body.address : patient.address_text,
        },
      });
    }

    const updatedPatient = await prisma.patients.findFirst({
      where: { id: patient.id },
      include: {
        users: {
          select: {
            email: true,
            profile_picture_url: true,
          },
        },
      },
    });

    const nameParts = (updatedPatient!.full_name || "").trim().split(" ");
    const updatedFirstName = nameParts[0] || "";
    const updatedLastName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    console.log("✅ [PATIENTS] Perfil actualizado exitosamente");
    return successResponse({
      id: updatedPatient!.id,
      email: updatedPatient!.users?.email || authContext.user.email,
      profile_picture_url: updatedPatient!.users?.profile_picture_url || null,
      first_name: updatedFirstName,
      last_name: updatedLastName,
      full_name: updatedPatient!.full_name,
      phone: updatedPatient!.phone,
      identification: updatedPatient!.identification,
      birth_date: updatedPatient!.birth_date
        ? new Date(updatedPatient!.birth_date).toISOString().split("T")[0]
        : null,
      address: updatedPatient!.address_text,
      is_patient_created: true,
    });
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al actualizar perfil:", error.message);
    logger.error("Error updating patient profile", error);
    if (error.message.includes("Validation error")) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse("Failed to update patient profile");
  }
}
