import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { AuthContext, requireAuth } from "../shared/auth";
import { ReminderType } from "../shared/enums";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from "../shared/response";
import { extractIdFromPath, parseBody } from "../shared/validators";

// --- HELPERS PARA FECHAS ---
const timeStringToDate = (timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// --- SCHEMAS DE VALIDACIÓN ---
const createReminderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  type: z.nativeEnum(ReminderType).optional().default(ReminderType.GENERAL),
  note: z.string().optional(),
  active: z.boolean().optional().default(true),
  frequency: z.number().int().nonnegative().optional(),
});

const updateReminderSchema = z.object({
  title: z.string().min(1).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  type: z.nativeEnum(ReminderType).optional(),
  note: z.string().optional(),
  active: z.boolean().optional(),
  frequency: z.number().int().nonnegative().optional(),
});

/**
 * Listar recordatorios del paciente
 * GET /api/patients/reminders
 */
export async function getReminders(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [REMINDERS] GET /api/patients/reminders - Listando recordatorios",
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
      return successResponse([], 200, event);
    }

    const queryParams = event.queryStringParameters || {};
    const active = queryParams.active;
    const type = queryParams.type;
    const date = queryParams.date;

    const where: any = {
      patient_id: patient.id,
    };

    if (active !== undefined) {
      where.is_active = active === "true";
    }

    if (type) {
      where.type = type;
    }

    if (date) {
      where.start_date = new Date(date);
    }

    const reminders = await prisma.patient_reminders.findMany({
      where,
      orderBy: [{ start_date: "asc" }, { time: "asc" }],
    });

    return successResponse(reminders, 200, event);
  } catch (error: any) {
    console.error(
      "❌ [REMINDERS] Error al listar recordatorios:",
      error.message,
    );
    logger.error("Error fetching reminders", error);
    return internalErrorResponse("Failed to fetch reminders", event);
  }
}

/**
 * Crear recordatorio
 * POST /api/patients/reminders
 */
export async function createReminder(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [REMINDERS] POST /api/patients/reminders - Creando recordatorio",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body, createReminderSchema);

    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse("Patient not found", 404, undefined, event);
    }

    let finalFrequency = body.frequency;
    if (finalFrequency === undefined || finalFrequency === null) {
      if (body.type === ReminderType.MEDICAMENTO) {
        finalFrequency = 8;
      } else if (body.type === ReminderType.CITA) {
        finalFrequency = 2;
      } else {
        finalFrequency = 0;
      }
    }

    // Crear en BD
    const reminder = await prisma.patient_reminders.create({
      data: {
        patient_id: patient.id,
        title: body.title,
        type: body.type,
        note: body.note || null,

        // Mapeos importantes:
        start_date: new Date(body.date),
        time: timeStringToDate(body.time),
        is_active: body.active !== undefined ? body.active : true,
        frequency: finalFrequency,
      },
    });

    return successResponse(reminder, 201, event);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse("Validation error", 400, error.errors, event);
    }
    console.error("❌ [REMINDERS] Error al crear recordatorio:", error.message);
    logger.error("Error creating reminder", error);
    return internalErrorResponse("Failed to create reminder", event);
  }
}

/**
 * Actualizar recordatorio
 * PATCH /api/patients/reminders/{id}
 */
export async function updateReminder(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [REMINDERS] PATCH /api/patients/reminders/{id} - Actualizando recordatorio",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const reminderId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/reminders/",
    );

    if (!reminderId) {
      return errorResponse("Reminder ID is required", 400, undefined, event);
    }

    const body = parseBody(event.body, updateReminderSchema);

    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse("Patient not found", 404, undefined, event);
    }

    // Preparar datos de actualización
    const updateData: any = {};
    if (body.title) updateData.title = body.title;
    if (body.type) updateData.type = body.type;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.frequency !== undefined) updateData.frequency = body.frequency;

    // Mapeos de fechas/estados
    if (body.date) updateData.start_date = new Date(body.date);
    if (body.time) updateData.time = timeStringToDate(body.time);
    if (body.active !== undefined) updateData.is_active = body.active;

    updateData.updated_at = new Date();

    // Actualizar usando updateMany para asegurar propiedad
    const result = await prisma.patient_reminders.updateMany({
      where: {
        id: reminderId,
        patient_id: patient.id,
      },
      data: updateData,
    });

    if (result.count === 0) {
      return notFoundResponse("Reminder not found or access denied", event);
    }

    // Retornar el objeto actualizado
    const updatedReminder = await prisma.patient_reminders.findUnique({
      where: { id: reminderId },
    });

    return successResponse(updatedReminder, 200, event);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return errorResponse("Validation error", 400, error.errors, event);
    }
    console.error(
      "❌ [REMINDERS] Error al actualizar recordatorio:",
      error.message,
    );
    logger.error("Error updating reminder", error);
    return internalErrorResponse("Failed to update reminder", event);
  }
}

/**
 * Eliminar recordatorio
 * DELETE /api/patients/reminders/{id}
 */
export async function deleteReminder(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [REMINDERS] DELETE /api/patients/reminders/{id} - Eliminando recordatorio",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const reminderId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/reminders/",
    );

    if (!reminderId) {
      return errorResponse("Reminder ID is required", 400, undefined, event);
    }

    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse("Patient not found", 404, undefined, event);
    }

    const [deletedNotifications, deletedReminder] = await prisma.$transaction([
      prisma.notifications.deleteMany({
        where: {
          patient_id: patient.id,
          data: {
            path: ["reminderId"],
            equals: reminderId,
          },
        },
      }),

      prisma.patient_reminders.deleteMany({
        where: {
          id: reminderId,
          patient_id: patient.id,
        },
      }),
    ]);

    if (deletedReminder.count === 0) {
      return notFoundResponse("Reminder not found", event);
    }

    console.log(
      `🗑️ Recordatorio eliminado. También se borraron ${deletedNotifications.count} notificaciones asociadas.`,
    );

    return successResponse(
      {
        message: "Reminder deleted successfully",
        meta: {
          notificationsCleaned: deletedNotifications.count,
        },
      },
      200,
      event,
    );
  } catch (error: any) {
    console.error(
      "❌ [REMINDERS] Error al eliminar recordatorio:",
      error.message,
    );
    logger.error("Error deleting reminder", error);
    return internalErrorResponse("Failed to delete reminder", event);
  }
}

/**
 * Activar/desactivar recordatorio
 * PATCH /api/patients/reminders/{id}/toggle
 */
export async function toggleReminder(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log(
    "✅ [REMINDERS] PATCH /api/patients/reminders/{id}/toggle - Toggle recordatorio",
  );

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const reminderId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/patients/reminders/",
      "/toggle",
    );

    if (!reminderId) {
      return errorResponse("Reminder ID is required", 400, undefined, event);
    }

    const patient = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!patient) {
      return errorResponse("Patient not found", 404, undefined, event);
    }

    const currentReminder = await prisma.patient_reminders.findFirst({
      where: {
        id: reminderId,
        patient_id: patient.id,
      },
    });

    if (!currentReminder) {
      return notFoundResponse("Reminder not found", event);
    }

    const updatedReminder = await prisma.patient_reminders.update({
      where: { id: reminderId },
      data: {
        is_active: !currentReminder.is_active,
        updated_at: new Date(),
      },
    });

    return successResponse(updatedReminder, 200, event);
  } catch (error: any) {
    console.error(
      "❌ [REMINDERS] Error al toggle recordatorio:",
      error.message,
    );
    logger.error("Error toggling reminder", error);
    return internalErrorResponse("Failed to toggle reminder", event);
  }
}
