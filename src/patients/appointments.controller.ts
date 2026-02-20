import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { addMinutes } from "date-fns";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from "../shared/response";
import {
  createAppointmentSchema,
  extractIdFromPath,
  parseBody,
} from "../shared/validators";

// Configuración de tiempos (en minutos)
const PAYMENT_TIMEOUT_MINUTES = 15;
const PROCESSING_TIMEOUT_MINUTES = 20;

// --- CREATE APPOINTMENT ---
export async function createAppointment(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("✅ [PATIENTS] POST /api/patients/appointments - Creando cita");

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // 1. Validar Paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse(
        "Patient profile not found. Please complete your profile first.",
        404,
      );
    }

    const body = parseBody(event.body, createAppointmentSchema);

    const doctor = await prisma.providers.findUnique({
      where: { id: body.doctorId },
      include: {
        users: { select: { is_active: true } },
        service_categories: { select: { slug: true } },
        provider_branches: {
          where: { is_main: true, is_active: true },
          take: 1,
        },
      },
    });

    if (!doctor || !doctor.users?.is_active) {
      return errorResponse("Doctor not found or inactive", 404);
    }
    const mainBranch = doctor.provider_branches[0];
    if (!mainBranch) {
      return errorResponse("Doctor has no active branch", 400);
    }

    const appointmentCost = mainBranch.consultation_fee || 0;
    console.log(
      `💰 [DEBUG] Costo de cita capturado de sucursal: ${appointmentCost}`,
    );

    const scheduledFor = new Date(`${body.date}T${body.time}:00`);

    // Validar pasado
    if (scheduledFor < new Date()) {
      return errorResponse("Appointment date cannot be in the past", 400);
    }

    const conflict = await prisma.appointments.findFirst({
      where: {
        provider_id: body.doctorId,
        scheduled_for: scheduledFor,
        status: {
          in: [
            "PENDING",
            "CONFIRMED",
            "COMPLETED",
            "PENDING_PAYMENT",
            "PROCESSING",
          ],
        },
      },
    });

    if (conflict) {
      console.warn(
        `⚠️ [RACE CONDITION] Intento de duplicar cita: Doc ${body.doctorId} @ ${scheduledFor}`,
      );
      return errorResponse(
        "Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.",
        409,
      );
    }

    const isOnlinePayment =
      body.paymentMethod === "CARD" || body.paymentMethod === "TRANSFER";
    const paymentMethod =
      body.paymentMethod === "TRANSFER"
        ? "CARD"
        : (body.paymentMethod as "CASH" | "CARD");

    const initialStatus = isOnlinePayment ? "PENDING_PAYMENT" : "PENDING";

    const appointment = await prisma.appointments.create({
      data: {
        id: randomUUID(),
        patient_id: patient.id,
        provider_id: body.doctorId,
        branch_id: mainBranch.id,
        clinic_id: body.clinicId || null,
        scheduled_for: scheduledFor,
        status: initialStatus,
        reason: body.reason,
        payment_method: paymentMethod,
        is_paid: false,
        cost: appointmentCost,
      },
      include: {
        providers: {
          include: {
            service_categories: { select: { name: true, slug: true } },
          },
        },
        provider_branches: true,
      },
    });

    console.log(
      `✅ [PATIENTS] Cita creada. Estado: ${initialStatus} | Costo: ${appointmentCost}`,
    );

    const appointmentWithRelations = appointment as any;
    const provider = appointmentWithRelations.providers;
    const branch = appointmentWithRelations.provider_branches;

    const expiresAt = isOnlinePayment
      ? addMinutes(new Date(), PAYMENT_TIMEOUT_MINUTES).toISOString()
      : null;

    const creationDate =
      appointmentWithRelations.createdAt ||
      appointmentWithRelations.created_at ||
      new Date();

    return successResponse(
      {
        id: appointment.id,
        scheduledFor: appointment.scheduled_for,
        status: appointment.status,
        reason: appointment.reason,
        isPaid: appointment.is_paid || false,
        createdAt: creationDate,
        paymentRequired: isOnlinePayment,
        expiresAt: expiresAt,
        cost: appointmentCost,
        provider: provider
          ? {
              id: provider.id,
              name: provider.commercial_name,
              logoUrl: provider.logo_url,
              category: provider.service_categories?.name || null,
            }
          : null,
        branch: branch
          ? {
              id: branch.id,
              name: branch.name,
              address: branch.address_text,
              phone: branch.phone_contact,
            }
          : null,
      },
      201,
    );
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al crear cita:", error.message);
    logger.error("Error creating appointment", error);
    if (error.message.includes("Validation error")) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse("Failed to create appointment");
  }
}

// --- LOCK APPOINTMENT (Start Payment Process) ---
export async function startPaymentProcess(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "🔒 [PATIENTS] POST /api/patients/appointments/:id/lock - Iniciando proceso de pago",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) return authResult;

  const prisma = getPrismaClient();
  const appointmentId = extractIdFromPath(
    event.requestContext.http.path,
    "/api/patients/appointments/",
    "/lock",
  );

  try {
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) return notFoundResponse("Appointment not found");

    // Validar estado
    if (appointment.status === "CANCELLED") {
      return errorResponse("El tiempo de reserva ha expirado.", 408);
    }
    if (
      appointment.status === "CONFIRMED" ||
      appointment.status === "PENDING"
    ) {
      return errorResponse(
        "Esta cita no requiere pago o ya fue procesada.",
        400,
      );
    }

    const updated = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        status: "PROCESSING",
        updated_at: new Date(),
      },
    });

    const extendedExpiration = addMinutes(
      new Date(),
      PROCESSING_TIMEOUT_MINUTES,
    );

    return successResponse({
      message: "Payment lock acquired",
      status: updated.status,
      expiresAt: extendedExpiration.toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Error locking appointment:", error);
    return internalErrorResponse("Failed to lock appointment");
  }
}

// --- GET APPOINTMENTS ---
export async function getAppointments(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) return authResult;
  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });
    if (!patient) return successResponse([]);

    const queryParams = event.queryStringParameters || {};
    const status = queryParams.status;
    const limit = parseInt(queryParams.limit || "50", 10);
    const offset = parseInt(queryParams.offset || "0", 10);

    const where: any = { patient_id: patient.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const appointments = await prisma.appointments.findMany({
      where,
      include: {
        providers: {
          include: {
            service_categories: { select: { name: true, slug: true } },
          },
        },
        provider_branches: true,
      },
      orderBy: { scheduled_for: "desc" },
      take: limit,
      skip: offset,
    });

    return successResponse(
      appointments.map((apt) => {
        const aptWithRelations = apt as any;
        const creationDate =
          aptWithRelations.createdAt || aptWithRelations.created_at;

        return {
          id: apt.id,
          scheduledFor: apt.scheduled_for,
          status: apt.status,
          reason: apt.reason,
          isPaid: apt.is_paid || false,
          cost: apt.cost,
          createdAt: creationDate,
          provider: aptWithRelations.providers
            ? {
                id: aptWithRelations.providers.id,
                name: aptWithRelations.providers.commercial_name,
                logoUrl: aptWithRelations.providers.logo_url,
                category:
                  aptWithRelations.providers.service_categories?.name || null,
              }
            : null,
          branch: aptWithRelations.provider_branches
            ? {
                id: aptWithRelations.provider_branches.id,
                name: aptWithRelations.provider_branches.name,
                address: aptWithRelations.provider_branches.address_text,
              }
            : null,
        };
      }),
    );
  } catch (error: any) {
    logger.error("Error getting patient appointments", error);
    return internalErrorResponse("Failed to get appointments");
  }
}

// --- GET APPOINTMENT BY ID ---
export async function getAppointmentById(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] GET /api/patients/appointments/:id - Obteniendo detalle de cita",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const appointmentId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/appointments/",
      "",
    );

    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return notFoundResponse("Patient not found");
    }

    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
      include: {
        providers: {
          include: {
            service_categories: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        provider_branches: true,
      },
    });

    if (!appointment) {
      return notFoundResponse("Appointment not found");
    }

    if (appointment.patient_id !== patient.id) {
      return errorResponse("Access denied", 403);
    }

    const appointmentWithRelations = appointment as any;
    const provider = appointmentWithRelations.providers;
    const branch = appointmentWithRelations.provider_branches;
    const creationDate =
      appointmentWithRelations.createdAt || appointmentWithRelations.created_at;

    return successResponse({
      id: appointment.id,
      scheduledFor: appointment.scheduled_for,
      status: appointment.status,
      reason: appointment.reason,
      isPaid: appointment.is_paid || false,
      cost: appointment.cost,
      createdAt: creationDate,
      provider: provider
        ? {
            id: provider.id,
            name: provider.commercial_name,
            logoUrl: provider.logo_url,
            description: provider.description || null,
            category: provider.service_categories?.name || null,
          }
        : null,
      branch: branch
        ? {
            id: branch.id,
            name: branch.name,
            address: branch.address_text,
            phone: branch.phone_contact,
            email: branch.email_contact || null,
          }
        : null,
    });
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al obtener cita:", error.message);
    logger.error("Error getting appointment", error);
    if (error.message.includes("Invalid path format")) {
      return errorResponse("Invalid appointment ID", 400);
    }
    return internalErrorResponse("Failed to get appointment");
  }
}

// --- CANCEL APPOINTMENT ---
export async function cancelAppointment(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [PATIENTS] DELETE /api/patients/appointments/:id - Cancelando cita y pago",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const appointmentId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/appointments/",
      "",
    );

    // Buscar el paciente
    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return notFoundResponse("Patient not found");
    }

    // Obtener la cita
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return notFoundResponse("Appointment not found");
    }

    if (appointment.patient_id !== patient.id) {
      return errorResponse("Access denied", 403);
    }

    if (
      appointment.scheduled_for &&
      new Date(appointment.scheduled_for) < new Date()
    ) {
      return errorResponse("Cannot cancel past appointments", 400);
    }

    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
      },
    });

    await prisma.payments.updateMany({
      where: {
        appointment_id: appointmentId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "CANCELLED",
      },
    });

    console.log("✅ [PATIENTS] Cita y pago pendientes cancelados exitosamente");
    return successResponse({
      id: updatedAppointment.id,
      status: updatedAppointment.status,
      message: "Appointment and pending payments cancelled successfully",
    });
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al cancelar cita:", error.message);
    logger.error("Error cancelling appointment", error);
    if (error.message.includes("Invalid path format")) {
      return errorResponse("Invalid appointment ID", 400);
    }
    return internalErrorResponse("Failed to cancel appointment");
  }
}
