import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { AuthContext, requireAuth } from "../shared/auth";
import { getPrismaClient } from "../shared/prisma";
import { errorResponse, successResponse, paginatedResponse } from "../shared/response";
import { emitToUser } from "../shared/realtime";
import { notifyAppointmentConfirmed, notifyAppointmentCancelled } from "../shared/notifications";

/**
 * GET /api/clinics/doctors/me/info
 * Obtener información básica de la clínica a la que está asociado el médico
 */
export async function getClinicInfo(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) {
      return authResult;
    }
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();
    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
      include: {
        clinics: {
          include: {
            clinic_schedules: {
              orderBy: {
                day_of_week: "asc",
              },
            },
          },
        },
      },
    });

    if (!doctorAssociation || !doctorAssociation.clinics) {
      return successResponse({ data: null });
    }

    const clinic = doctorAssociation.clinics;
    const dayNumberToName = (day: number): string => {
      const days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
      return days[day] || "monday";
    };
    const formatTime = (time: Date | null): string => {
      if (!time) return "09:00";
      const date = new Date(time);
      return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
    };
    const schedule: Record<string, any> = {
      monday: { enabled: false, startTime: "09:00", endTime: "18:00" },
      tuesday: { enabled: false, startTime: "09:00", endTime: "18:00" },
      wednesday: { enabled: false, startTime: "09:00", endTime: "18:00" },
      thursday: { enabled: false, startTime: "09:00", endTime: "18:00" },
      friday: { enabled: false, startTime: "09:00", endTime: "18:00" },
      saturday: { enabled: false, startTime: "09:00", endTime: "13:00" },
      sunday: { enabled: false, startTime: "09:00", endTime: "13:00" },
    };

    clinic.clinic_schedules.forEach((sched: any) => {
      const dayKey = dayNumberToName(sched.day_of_week);
      if (schedule[dayKey]) {
        schedule[dayKey] = {
          enabled: sched.enabled ?? false,
          startTime: formatTime(sched.start_time),
          endTime: formatTime(sched.end_time),
        };
      }
    });

    return successResponse({
      data: {
        id: clinic.id,
        name: clinic.name,
        logoUrl: clinic.logo_url,
        address: clinic.address,
        phone: clinic.phone,
        whatsapp: clinic.whatsapp,
        description: clinic.description,
        latitude: clinic.latitude ? Number(clinic.latitude) : null,
        longitude: clinic.longitude ? Number(clinic.longitude) : null,
        schedule,
      },
    });
  } catch (error: any) {
    console.error("Error getting clinic info:", error);
    return errorResponse(error.message || "Error al obtener información de la clínica");
  }
}

/**
 * GET /api/clinics/doctors/me/profile
 * Obtener perfil del médico dentro de la clínica
 */
export async function getClinicProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      include: {
        clinics: { select: { id: true, name: true, logo_url: true } },
        users: {
          select: {
            id: true,
            email: true,
            profile_picture_url: true,
          },
        },
      },
    });

    if (!doctorAssociation) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    return successResponse({
      data: {
        id: doctorAssociation.id,
        clinicId: doctorAssociation.clinic_id,
        clinicName: doctorAssociation.clinics?.name || "",
        clinicLogo: doctorAssociation.clinics?.logo_url || null,
        userId: doctorAssociation.user_id,
        email: doctorAssociation.users?.email || "",
        profileImageUrl: doctorAssociation.users?.profile_picture_url || null,
        officeNumber: doctorAssociation.office_number || "",
        isActive: doctorAssociation.is_active,
        createdAt: doctorAssociation.created_at?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error getting clinic profile:", error);
    return errorResponse(error.message || "Error al obtener perfil");
  }
}

/**
 * PUT /api/clinics/doctors/me/profile
 * Actualizar perfil del médico dentro de la clínica
 */
export async function updateClinicProfile(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const body = JSON.parse(event.body || "{}");

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
    });

    if (!doctorAssociation) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    const updateData: any = {};
    if (body.officeNumber !== undefined) updateData.office_number = body.officeNumber;
    if (body.specialty !== undefined) updateData.specialty = body.specialty;

    if (Object.keys(updateData).length > 0) {
      await prisma.clinic_doctors.update({
        where: { id: doctorAssociation.id },
        data: updateData,
      });
    }

    if (body.phone !== undefined || body.profileImageUrl !== undefined) {
      const userUpdate: any = {};
      if (body.phone !== undefined) userUpdate.phone = body.phone;
      if (body.profileImageUrl !== undefined) userUpdate.profile_picture_url = body.profileImageUrl;
      await prisma.users.update({
        where: { id: authContext.user.id },
        data: userUpdate,
      });
    }

    return successResponse({ data: { id: doctorAssociation.id, ...body } });
  } catch (error: any) {
    console.error("Error updating clinic profile:", error);
    return errorResponse(error.message || "Error al actualizar perfil");
  }
}

/**
 * GET /api/clinics/doctors/me/appointments
 * Obtener citas del médico asociado a la clínica
 */
export async function getClinicAppointments(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "10", 10);
    const offset = (page - 1) * limit;

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { id: true, clinic_id: true },
    });

    if (!doctorAssociation || !doctorAssociation.clinic_id) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    // Obtener provider_id del doctor desde la tabla providers
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      select: { id: true },
    });

    const where: any = {
      clinic_id: doctorAssociation.clinic_id,
      status: { in: [
        "confirmed", "CONFIRMED",
        "attended", "ATTENDED",
        "completed", "COMPLETED",
        "no_show", "NO_SHOW",
        "pending", "PENDING",
        "pending_confirmation", "PENDING_CONFIRMATION",
        "cancelled", "CANCELLED"
      ] },
    };
    if (provider) {
      where.provider_id = provider.id;
    }

    const [appointments, total] = await Promise.all([
      prisma.appointments.findMany({
        where,
        include: {
          patients: {
            include: {
              users: {
                select: { id: true, email: true, profile_picture_url: true },
              },
            },
          },
          providers: {
            select: { commercial_name: true },
          },
        },
        orderBy: { scheduled_for: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.appointments.count({ where }),
    ]);

    const mapped = appointments.map((apt) => ({
      id: apt.id,
      patientId: apt.patient_id,
      patientName: apt.patients?.full_name || "Paciente",
      patientPhone: apt.patients?.phone || null,
      patientAvatar: apt.patients?.users?.profile_picture_url || null,
      doctorName: apt.providers?.commercial_name || "Médico",
      date: apt.scheduled_for?.toISOString() || "",
      status: apt.status,
      reason: apt.reason || "",
      createdAt: apt.created_at?.toISOString(),
    }));

    return paginatedResponse(mapped, total, page, limit);
  } catch (error: any) {
    console.error("Error getting clinic appointments:", error);
    return errorResponse(error.message || "Error al obtener citas");
  }
}

/**
 * PATCH /api/clinics/doctors/me/appointments/:appointmentId/status
 * Actualizar estado de una cita
 */
export async function updateClinicAppointmentStatus(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();
    const body = JSON.parse(event.body || "{}");
    const path = event.requestContext.http.path;
    const appointmentId = path.split("/").pop()?.replace(/\/status$/, "") || 
      path.substring(path.lastIndexOf("/", path.lastIndexOf("/") - 1) + 1, path.lastIndexOf("/status"));

    if (!appointmentId) {
      return errorResponse("ID de cita no proporcionado", 400);
    }

    const { status } = body;
    if (!status || !["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"].includes(status)) {
      return errorResponse("Estado inválido. Use CONFIRMED, COMPLETED, NO_SHOW o CANCELLED", 400);
    }

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { id: true, clinic_id: true },
    });

    if (!doctorAssociation || !doctorAssociation.clinic_id) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      select: { id: true },
    });

    const where: any = { id: appointmentId, clinic_id: doctorAssociation.clinic_id };
    if (provider) {
      where.provider_id = provider.id;
    }

    const appointment = await prisma.appointments.findFirst({ where });

    if (!appointment) {
      return errorResponse("Cita no encontrada", 404);
    }

    const statusMap: Record<string, string> = {
      CONFIRMED: "CONFIRMED",
      COMPLETED: "COMPLETED",
      NO_SHOW: "NO_SHOW",
      CANCELLED: "CANCELLED",
    };

    const targetStatus = statusMap[status] || status.toUpperCase();

    await prisma.appointments.update({
      where: { id: appointmentId },
      data: { status: targetStatus },
    });

    // Realtime: appointment:updated
    try {
      emitToUser(authContext.user.id, 'appointment:updated', {
        appointmentId,
        status: targetStatus,
      });

      if (appointment.patient_id) {
        const patient = await prisma.patients.findUnique({
          where: { id: appointment.patient_id },
          select: { user_id: true }
        });
        if (patient?.user_id) {
          emitToUser(patient.user_id, 'appointment:updated', {
            appointmentId,
            status: targetStatus,
          });
        }
      }
    } catch (e) {
      // ignore
    }

    // Enviar notificaciones según el estado (no bloquea)
    if (status === 'CONFIRMED' || status === 'CANCELLED') {
      const appointmentWithDetails = await prisma.appointments.findFirst({
        where: { id: appointmentId },
        include: {
          clinics: {
            include: {
              users: true,
            },
          },
          patients: {
            include: {
              users: true,
            },
          },
          providers: {
            select: {
              commercial_name: true,
              user_id: true,
            }
          }
        },
      });

      if (appointmentWithDetails && appointmentWithDetails.clinic_id && appointmentWithDetails.provider_id) {
        const doctor = appointmentWithDetails.providers?.user_id 
          ? await prisma.clinic_doctors.findFirst({
              where: {
                clinic_id: appointmentWithDetails.clinic_id,
                user_id: appointmentWithDetails.providers.user_id,
              },
              include: {
                users: true,
              },
            })
          : null;

        if (status === 'CONFIRMED') {
          notifyAppointmentConfirmed(
            appointmentWithDetails,
            appointmentWithDetails.clinics,
            doctor,
            appointmentWithDetails.patients
          ).catch(err => console.error('Error en notificaciones de confirmación:', err));
        } else if (status === 'CANCELLED') {
          notifyAppointmentCancelled(
            appointmentWithDetails,
            appointmentWithDetails.clinics,
            doctor,
            appointmentWithDetails.patients
          ).catch(err => console.error('Error en notificaciones de cancelación:', err));
        }
      }
    }

    return successResponse({ data: { id: appointmentId, status } });
  } catch (error: any) {
    console.error("Error updating appointment status:", error);
    return errorResponse(error.message || "Error al actualizar estado");
  }
}

/**
 * GET /api/clinics/doctors/me/messages
 * Obtener mensajes de recepción
 */
export async function getReceptionMessages(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "20", 10);
    const offset = (page - 1) * limit;

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { id: true, clinic_id: true },
    });

    if (!doctorAssociation) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    const where = { doctor_id: doctorAssociation.id };

    const [messages, total] = await Promise.all([
      prisma.reception_messages.findMany({
        where,
        include: {
          clinics: { select: { name: true } },
        },
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.reception_messages.count({ where }),
    ]);

    const mapped = messages.map((msg) => ({
      id: msg.id,
      message: msg.message,
      senderType: msg.sender_type,
      isRead: msg.is_read,
      clinicName: msg.clinics?.name || "",
      createdAt: msg.created_at?.toISOString(),
    }));

    return paginatedResponse(mapped, total, page, limit);
  } catch (error: any) {
    console.error("Error getting reception messages:", error);
    return errorResponse(error.message || "Error al obtener mensajes");
  }
}

/**
 * POST /api/clinics/doctors/me/messages
 * Enviar mensaje a recepción
 */
export async function createReceptionMessage(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();
    const body = JSON.parse(event.body || "{}");

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { id: true, clinic_id: true },
    });

    if (!doctorAssociation || !doctorAssociation.clinic_id) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    const message = await prisma.reception_messages.create({
      data: {
        id: randomUUID(),
        clinic_id: doctorAssociation.clinic_id,
        doctor_id: doctorAssociation.id,
        message: body.message || "",
        sender_type: "doctor",
      },
    });

    return successResponse({
      data: {
        id: message.id,
        message: message.message,
        senderType: message.sender_type,
        isRead: message.is_read,
        createdAt: message.created_at?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error creating reception message:", error);
    return errorResponse(error.message || "Error al enviar mensaje");
  }
}

/**
 * PATCH /api/clinics/doctors/me/messages/read
 * Marcar mensajes como leídos
 */
export async function markReceptionMessagesAsRead(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();
    const body = JSON.parse(event.body || "{}");

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { id: true },
    });

    if (!doctorAssociation) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    if (body.messageIds && Array.isArray(body.messageIds)) {
      await prisma.reception_messages.updateMany({
        where: {
          id: { in: body.messageIds },
          doctor_id: doctorAssociation.id,
        },
        data: { is_read: true },
      });
    }

    return successResponse({ data: { success: true } });
  } catch (error: any) {
    console.error("Error marking messages as read:", error);
    return errorResponse(error.message || "Error al marcar mensajes");
  }
}

/**
 * GET /api/clinics/doctors/me/date-blocks
 * Obtener solicitudes de bloqueo de fecha
 */
export async function getDateBlocks(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "10", 10);
    const offset = (page - 1) * limit;

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { id: true },
    });

    if (!doctorAssociation) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    const where = { doctor_id: doctorAssociation.id };

    const [blocks, total] = await Promise.all([
      prisma.date_block_requests.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.date_block_requests.count({ where }),
    ]);

    const mapped = blocks.map((block) => ({
      id: block.id,
      date: block.date?.toISOString(),
      reason: block.reason,
      status: block.status,
      startTime: block.start_time?.toISOString(),
      endTime: block.end_time?.toISOString(),
      createdAt: block.created_at?.toISOString(),
    }));

    return paginatedResponse(mapped, total, page, limit);
  } catch (error: any) {
    console.error("Error getting date blocks:", error);
    return errorResponse(error.message || "Error al obtener bloqueos");
  }
}

/**
 * POST /api/clinics/doctors/me/date-blocks
 * Solicitar bloqueo de fecha
 */
export async function requestDateBlock(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();
    const body = JSON.parse(event.body || "{}");

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { id: true, clinic_id: true },
    });

    if (!doctorAssociation || !doctorAssociation.clinic_id) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    const block = await prisma.date_block_requests.create({
      data: {
        id: randomUUID(),
        clinic_id: doctorAssociation.clinic_id,
        doctor_id: doctorAssociation.id,
        date: new Date(body.date || body.startDate),
        reason: body.reason || "",
        status: "pending",
        start_time: body.startTime ? new Date(body.startTime) : null,
        end_time: body.endTime ? new Date(body.endTime) : null,
      },
    });

    return successResponse({
      data: {
        id: block.id,
        date: block.date?.toISOString(),
        reason: block.reason,
        status: block.status,
        createdAt: block.created_at?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error creating date block:", error);
    return errorResponse(error.message || "Error al solicitar bloqueo");
  }
}

/**
 * GET /api/clinics/doctors/me/notifications
 * Obtener notificaciones de la clínica para el médico
 */
export async function getClinicNotifications(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "20", 10);
    const offset = (page - 1) * limit;

    const doctorAssociation = await prisma.clinic_doctors.findFirst({
      where: { user_id: authContext.user.id, is_active: true },
      select: { clinic_id: true },
    });

    if (!doctorAssociation || !doctorAssociation.clinic_id) {
      return errorResponse("No estás asociado a ninguna clínica", 404);
    }

    const where = { clinic_id: doctorAssociation.clinic_id };

    const [notifications, total] = await Promise.all([
      prisma.clinic_notifications.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.clinic_notifications.count({ where }),
    ]);

    const mapped = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.is_read,
      data: n.data,
      createdAt: n.created_at?.toISOString(),
    }));

    return paginatedResponse(mapped, total, page, limit);
  } catch (error: any) {
    console.error("Error getting clinic notifications:", error);
    return errorResponse(error.message || "Error al obtener notificaciones");
  }
}
