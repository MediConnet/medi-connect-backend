import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { addMinutes } from "date-fns";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import { emitToUser, emitToClinic } from "../shared/realtime";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  paginatedResponse,
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
    const body = parseBody(event.body, createAppointmentSchema);

    // 1. Validar / Crear Paciente de manera perezosa (lazy profile creation)
    const patientDb = await prisma.patients.findFirst({
      where: { user_id: authContext.user.id },
      include: { users: { select: { email: true } } },
    });

    const patient = patientDb
      ? patientDb
      : await prisma.patients.create({
          data: {
            id: randomUUID(),
            user_id: authContext.user.id,
            full_name: body.fullName || authContext.user.email?.split('@')[0] || "Usuario Paciente",
            phone: body.phone || null,
          },
          include: { users: { select: { email: true } } },
        });

    if (!body.specialtyId) {
      return errorResponse("El campo specialtyId es requerido", 400);
    }

    const doctor = await prisma.providers.findUnique({
      where: { id: body.doctorId },
      include: {
        users: { select: { is_active: true } },
        service_categories: { select: { slug: true } },
        provider_branches: {
          where: { is_main: true, is_active: true },
          take: 1,
        },
        provider_specialties: {
          where: { specialty_id: body.specialtyId },
          take: 1,
        },
      },
    });

    if (!doctor || !doctor.users?.is_active) {
      return errorResponse("Doctor not found or inactive", 404);
    }
    let branchId: string | null = null;
    let finalClinicId = body.clinicId || null;

    if (!finalClinicId && doctor.user_id) {
      const clinicDoc = await prisma.clinic_doctors.findFirst({
        where: { user_id: doctor.user_id, is_active: true },
        select: { clinic_id: true }
      });
      if (clinicDoc?.clinic_id) {
        finalClinicId = clinicDoc.clinic_id;
      }
    }

    if (finalClinicId) {
      const clinic = await prisma.clinics.findUnique({
        where: { id: finalClinicId },
        include: {
          users: {
            include: {
              providers: {
                include: {
                  provider_branches: {
                    where: { is_active: true },
                    orderBy: { is_main: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });
      const clinicBranch = clinic?.users?.providers?.[0]?.provider_branches?.[0];
      if (clinicBranch) {
        branchId = clinicBranch.id;
      }
    }

    if (!branchId) {
      const mainBranch = doctor.provider_branches[0];
      if (!mainBranch) {
        return errorResponse("Doctor has no active branch", 400);
      }
      branchId = mainBranch.id;
    }

    const specialtyRecord = doctor.provider_specialties[0];
    if (!specialtyRecord) {
      return errorResponse(
        "El doctor no ofrece la especialidad seleccionada o no tiene tarifa configurada",
        400,
      );
    }

    let appointmentCost = specialtyRecord.fee ? Number(specialtyRecord.fee) : 0;

    // Si se envía consultationPriceId, usar el precio del servicio en lugar de la tarifa de especialidad
    if (body.consultationPriceId) {
      const consultationPrice = await prisma.consultation_prices.findUnique({
        where: { id: body.consultationPriceId },
      });
      if (consultationPrice && consultationPrice.is_active) {
        appointmentCost = Number(consultationPrice.price);
        console.log(
          `💰 [DEBUG] Usando precio de servicio (consultationPriceId=${body.consultationPriceId}): ${appointmentCost}`,
        );
      } else {
        console.warn(
          `⚠️ [DEBUG] consultationPriceId=${body.consultationPriceId} no encontrado o inactivo, usando tarifa de especialidad: ${appointmentCost}`,
        );
      }
    } else {
      console.log(
        `💰 [DEBUG] Costo de cita capturado de la especialidad: ${appointmentCost}`,
      );
    }

    if (body.discount) {
      let discountPercentage = 0;
      if (typeof body.discount === "number") {
        discountPercentage = body.discount;
      } else if (typeof body.discount === "string") {
        const match = body.discount.match(/(\d+)/);
        if (match) {
          discountPercentage = parseFloat(match[1]);
        }
      }

      if (discountPercentage > 0 && discountPercentage <= 100) {
        const discountAmount = (appointmentCost * discountPercentage) / 100;
        appointmentCost = Number((appointmentCost - discountAmount).toFixed(2));
        console.log(
          `🏷️ [DEBUG] Aplicando descuento de anuncio: ${discountPercentage}% (-$${discountAmount}). Nuevo costo: $${appointmentCost}`,
        );
      }
    }

    const scheduledFor = new Date(`${body.date}T${body.time}:00-05:00`);

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
        branch_id: branchId,
        clinic_id: finalClinicId,
        specialty_id: body.specialtyId,
        scheduled_for: scheduledFor,
        status: initialStatus,
        reason: body.reason,
        reception_notes: body.notes || null,
        payment_method: paymentMethod,
        is_paid: false,
        cost: appointmentCost,
      },
      include: {
        providers: {
          include: {
            service_categories: { select: { name: true, slug: true } },
            users: { select: { profile_picture_url: true } },
          },
        },
        provider_branches: true,
        specialties: true,
      },
    });

    console.log(
      `✅ [PATIENTS] Cita creada. Estado: ${initialStatus} | Costo: ${appointmentCost} | Especialidad: ${body.specialtyId}`,
    );

    // Actualizar datos base del paciente desde el formulario de cita cuando aplique.
    // Esto asegura que el doctor vea nombre/teléfono consistentes en el detalle.
    const patientProfilePatch: any = {};
    if (body.phone && body.phone.trim()) {
      patientProfilePatch.phone = body.phone.trim();
    }
    if (body.fullName && body.fullName.trim()) {
      patientProfilePatch.full_name = body.fullName.trim();
    }
    if (body.identificacion && body.identificacion.trim()) {
      patientProfilePatch.identification = body.identificacion.trim();
    }
    if (Object.keys(patientProfilePatch).length > 0) {
      await prisma.patients.update({
        where: { id: patient.id },
        data: patientProfilePatch,
      }).catch(() => {}); // no bloquear si falla
    }

    // Email de confirmación al paciente (asíncrono, no bloquea)
    if (patient.users?.email && initialStatus !== "PENDING_PAYMENT") {
      const { sendEmail } = await import("../shared/email-adapter");
      const { generatePatientNewAppointmentEmail } = await import("../shared/email");
      const providerName = (appointment as any).providers?.commercial_name || "Médico";
      const specialtyName = (appointment as any).specialties?.name || "Especialidad";
      const branchAddress = (appointment as any).provider_branches?.address_text || "Dirección no especificada";
      sendEmail({
        to: patient.users.email,
        subject: "Tu cita ha sido confirmada - DOCALINK",
        html: generatePatientNewAppointmentEmail({
          patientName: patient.full_name || "Paciente",
          doctorName: providerName,
          doctorSpecialty: specialtyName,
          clinicName: providerName,
          clinicAddress: branchAddress,
          date: body.date,
          time: body.time,
          reason: body.reason,
        }),
      }).catch((err: any) => console.error("❌ [APPOINTMENTS] Error enviando email confirmación:", err.message));

      // Notificación push/in-app
      const formattedDate = appointment.scheduled_for ? appointment.scheduled_for.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }) : "";
      const formattedTime = appointment.scheduled_for ? appointment.scheduled_for.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }) : "";

      const { patientNotificationService } = await import("../shared/patient-notification.service");
      patientNotificationService.create({
        patientId: patient.id,
        type: "cita",
        title: "Cita Agendada",
        body: `Tu cita con Dr(a). ${providerName} ha sido registrada para el ${formattedDate} a las ${formattedTime}.`,
        data: {
          targetScreen: "Citas",
          appointmentId: appointment.id,
        },
      }).catch((err: any) => console.error("❌ [APPOINTMENTS] Error enviando push confirmación:", err.message));
    }

    // Realtime: appointment:created (to doctor, optionally clinic)
    if ((doctor as any).user_id) {
      emitToUser((doctor as any).user_id, "appointment:created", {
        appointmentId: appointment.id,
        patientName: patient.full_name || "Paciente",
        date: body.date,
        time: body.time,
        reason: body.reason || null,
        status: appointment.status,
      });
    }

    const appointmentWithRelations = appointment as any;
    const provider = appointmentWithRelations.providers;
    const branch = appointmentWithRelations.provider_branches;
    const specialtyInfo = appointmentWithRelations.specialties;

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
        notes: appointment.reception_notes || null,
        isPaid: appointment.is_paid || false,
        createdAt: creationDate,
        paymentRequired: isOnlinePayment,
        paymentMethod: appointment.payment_method,
        expiresAt: expiresAt,
        cost: appointmentCost,
        specialty: specialtyInfo
          ? {
              id: specialtyInfo.id,
              name: specialtyInfo.name,
            }
          : null,
        provider: provider
          ? {
              id: provider.id,
              name: provider.commercial_name,
              logoUrl: provider.users?.profile_picture_url || provider.logo_url,
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
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '20', 10);
    const offset = (page - 1) * limit;

    const where: any = { patient_id: patient.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const [appointments, total] = await Promise.all([
      prisma.appointments.findMany({
        where,
        include: {
          providers: {
            include: {
              service_categories: { select: { name: true, slug: true } },
              users: { select: { profile_picture_url: true } },
            },
          },
          provider_branches: {
            include: {
              cities: { select: { name: true } },
            },
          },
          specialties: true,
        },
        orderBy: { scheduled_for: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.appointments.count({ where }),
    ]);

    const formattedAppointments = appointments.map((apt) => {
      const aptWithRelations = apt as any;
      const creationDate =
        aptWithRelations.createdAt || aptWithRelations.created_at;

      return {
        id: apt.id,
        scheduledFor: apt.scheduled_for,
        status: apt.status,
        reason: apt.reason,
        notes: apt.reception_notes || null,
        isPaid: apt.is_paid || false,
        cost: apt.cost,
        createdAt: creationDate,
        paymentMethod: aptWithRelations.payment_method,
        specialty: aptWithRelations.specialties
          ? {
              id: aptWithRelations.specialties.id,
              name: aptWithRelations.specialties.name,
            }
          : null,
        provider: aptWithRelations.providers
          ? {
              id: aptWithRelations.providers.id,
              name: aptWithRelations.providers.commercial_name,
              logoUrl: aptWithRelations.providers.users?.profile_picture_url || aptWithRelations.providers.logo_url,
              category:
                aptWithRelations.providers.service_categories?.name || null,
            }
          : null,
        branch: aptWithRelations.provider_branches
          ? {
              id: aptWithRelations.provider_branches.id,
              name: aptWithRelations.provider_branches.name,
              address: aptWithRelations.provider_branches.address_text,
              city: aptWithRelations.provider_branches.cities?.name,
              phone: aptWithRelations.provider_branches.phone_contact,
              email: aptWithRelations.provider_branches.email_contact,
              google_maps_url: aptWithRelations.provider_branches.google_maps_url || null,
              latitude: aptWithRelations.provider_branches.latitude ? Number(aptWithRelations.provider_branches.latitude) : null,
              longitude: aptWithRelations.provider_branches.longitude ? Number(aptWithRelations.provider_branches.longitude) : null,
            }
          : null,
      };
    });

    return paginatedResponse(formattedAppointments, total, page, limit);
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
            users: { select: { profile_picture_url: true } },
          },
        },
        provider_branches: {
          include: {
            cities: { select: { name: true } },
          },
        },
        specialties: true,
      },
    });

    if (!appointment) {
      return notFoundResponse("Appointment not found");
    }

    if (appointment.patient_id !== patient.id) {
      return errorResponse("Access denied", 403);
    }

    // Buscar si existe un pago asociado en la tabla payments
    const payment = await prisma.payments.findFirst({
      where: { appointment_id: appointment.id },
      select: {
        id: true,
        amount_total: true,
        status: true,
        created_at: true,
        payment_method: true,
        payment_source: true,
        external_transaction_id: true,
      },
    });

    const appointmentWithRelations = appointment as any;
    const provider = appointmentWithRelations.providers;
    const branch = appointmentWithRelations.provider_branches;
    const specialtyInfo = appointmentWithRelations.specialties;
    const creationDate =
      appointmentWithRelations.createdAt || appointmentWithRelations.created_at;

    return successResponse({
      id: appointment.id,
      scheduledFor: appointment.scheduled_for,
      status: appointment.status,
      reason: appointment.reason,
      notes: appointment.reception_notes || null,
      isPaid: appointment.is_paid || false,
      cost: appointment.cost,
      paymentMethod: appointment.payment_method,
      createdAt: creationDate,
      paymentDetail: payment ? {
        transactionId: payment.external_transaction_id || payment.id,
        amount: Number(payment.amount_total || appointment.cost || 0),
        status: payment.status || 'PAID',
        method: payment.payment_method || 'CARD',
        source: payment.payment_source || 'NUVEI',
        date: payment.created_at?.toISOString() || creationDate?.toISOString() || new Date().toISOString(),
      } : null,
      specialty: specialtyInfo
        ? {
            id: specialtyInfo.id,
            name: specialtyInfo.name,
          }
        : null,
      provider: provider
        ? {
            id: provider.id,
            name: provider.commercial_name,
            logoUrl: provider.users?.profile_picture_url || provider.logo_url,
            description: provider.description || null,
            category: provider.service_categories?.name || null,
          }
        : null,
      branch: branch
        ? {
            id: branch.id,
            name: branch.name,
            address: branch.address_text,
            city: branch.cities?.name,
            phone: branch.phone_contact,
            email: branch.email_contact || null,
            google_maps_url: branch.google_maps_url || null,
            latitude: branch.latitude ? Number(branch.latitude) : null,
            longitude: branch.longitude ? Number(branch.longitude) : null,
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
      include: {
        patients: { include: { users: { select: { email: true } } } },
        providers: { select: { commercial_name: true } },
        clinics: { select: { name: true } },
      },
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

    // Regla de Negocio: Validar plazo de 12 horas si la cita ya fue pagada
    if (appointment.is_paid) {
      const scheduledTime = appointment.scheduled_for ? new Date(appointment.scheduled_for).getTime() : 0;
      const limitTime = scheduledTime - (12 * 60 * 60 * 1000); // 12 horas antes
      const now = Date.now();
      if (now > limitTime) {
        return errorResponse(
          "No se puede cancelar ni solicitar reembolso para citas con menos de 12 horas de anticipación.",
          400
        );
      }

      // Iniciar reembolso en Nuvei
      const paidPayment = await prisma.payments.findFirst({
        where: {
          appointment_id: appointmentId,
          status: "PAID",
        },
      });

      if (paidPayment && paidPayment.external_transaction_id) {
        console.log(`📡 [REFUND] Reembolsando transacción de Nuvei: ${paidPayment.external_transaction_id}`);
        const { nuveiService } = await import("../payments/nuvei.service");
        
        try {
          const refundResult = await nuveiService.refund({
            transactionId: paidPayment.external_transaction_id,
            amount: Number(paidPayment.amount_total) || undefined,
          });

          console.log("📡 [REFUND] Respuesta de Nuvei:", JSON.stringify(refundResult));

          if (refundResult?.transaction?.status === "error" || refundResult?.error) {
            console.error("❌ [REFUND] Falló el reembolso en Nuvei:", refundResult);
            return errorResponse("No se pudo procesar el reembolso en la pasarela de pagos. Por favor contacta a soporte.", 400);
          }

          // Actualizar estado del pago a REFUNDED en la base de datos
          await prisma.payments.update({
            where: { id: paidPayment.id },
            data: {
              status: "REFUNDED",
            },
          });

          // Cancelar el payout asociado si existe
          if (paidPayment.payout_id) {
            await prisma.payouts.update({
              where: { id: paidPayment.payout_id },
              data: {
                status: "cancelled",
              },
            }).catch((err: any) => console.error("❌ [REFUND] Error al cancelar payout:", err.message));
          }

          // Enviar correo de reembolso completado (asíncrono)
          const aptPatient = (appointment as any).patients;
          if (aptPatient?.users?.email) {
            const { sendEmail } = await import("../shared/email-adapter");
            const { generateRefundCompletedEmail } = await import("../shared/email");
            const scheduledDate = appointment.scheduled_for ? new Date(appointment.scheduled_for) : new Date();
            const dateStr = scheduledDate.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
            const timeStr = scheduledDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

            sendEmail({
              to: aptPatient.users.email,
              subject: "Confirmación de Reembolso - DOCALINK",
              html: generateRefundCompletedEmail({
                patientName: aptPatient.full_name || "Paciente",
                doctorName: (appointment as any).providers?.commercial_name || "Médico",
                clinicName: (appointment as any).clinics?.name || "Docalink",
                date: dateStr,
                time: timeStr,
                amount: Number(paidPayment.amount_total) || 0,
                transactionId: paidPayment.external_transaction_id || "N/A",
              }),
            }).then(() => console.log(`✉️ [REFUND] Correo de reembolso enviado a: ${aptPatient.users.email}`))
              .catch((err: any) => console.error("❌ [REFUND] Error enviando email de reembolso:", err.message));
          }
        } catch (refundError: any) {
          console.error("❌ [REFUND] Error de conexión al reembolsar:", refundError.message);
          return errorResponse("Error de conexión al procesar el reembolso. Intente más tarde.", 500);
        }
      }
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

    console.log("✅ [PATIENTS] Cita y pagos cancelados/reembolsados exitosamente");

    // Email de cancelación al paciente (asíncrono)
    const aptPatient = (appointment as any).patients;
    if (aptPatient?.users?.email) {
      const { sendEmail } = await import("../shared/email-adapter");
      const { generatePatientCancellationEmail } = await import("../shared/email");
      const scheduledDate = appointment.scheduled_for ? new Date(appointment.scheduled_for) : new Date();
      const dateStr = scheduledDate.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
      const timeStr = scheduledDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
      sendEmail({
        to: aptPatient.users.email,
        subject: "Tu cita ha sido cancelada - DOCALINK",
        html: generatePatientCancellationEmail({
          patientName: aptPatient.full_name || "Paciente",
          date: dateStr,
          time: timeStr,
          doctorName: (appointment as any).providers?.commercial_name || "Médico",
          clinicName: (appointment as any).providers?.commercial_name || "Docalink",
        }),
      }).catch((err: any) => console.error("❌ [APPOINTMENTS] Error enviando email cancelación:", err.message));
    }

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

// --- CONFIRM APPOINTMENT ATTENDANCE ---
export async function confirmAppointmentAttendance(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("✅ [PATIENTS] PUT /api/patients/appointments/:id/confirm - Confirmando asistencia");

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
      "/confirm",
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
      include: {
        providers: { select: { user_id: true } },
      },
    });

    if (!appointment) {
      return notFoundResponse("Appointment not found");
    }

    // Validar que la cita pertenezca al paciente
    if (appointment.patient_id !== patient.id) {
      return errorResponse("Access denied", 403);
    }

    // Cambiar estado a CONFIRMED
    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        status: "CONFIRMED",
      },
    });

    console.log(`✅ [PATIENTS] Cita ${appointmentId} confirmada por el paciente`);

    // Emitir realtime al médico y clínica
    if (appointment.providers?.user_id) {
      emitToUser(appointment.providers.user_id, "appointment:updated", {
        appointmentId: appointment.id,
        status: "CONFIRMED",
      });
    }
    if (appointment.clinic_id) {
      emitToClinic(appointment.clinic_id, "appointment:updated", {
        appointmentId: appointment.id,
        status: "CONFIRMED",
      });
    }

    return successResponse({
      id: updatedAppointment.id,
      status: updatedAppointment.status,
      message: "Cita confirmada exitosamente por el paciente",
    });
  } catch (error: any) {
    console.error("❌ [PATIENTS] Error al confirmar cita:", error.message);
    logger.error("Error confirming appointment", error);
    if (error.message.includes("Invalid path format")) {
      return errorResponse("Invalid appointment ID", 400);
    }
    return internalErrorResponse("Failed to confirm appointment");
  }
}
