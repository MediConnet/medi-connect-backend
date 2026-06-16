import { getPrismaClient } from "../shared/prisma";
import { logger } from "../shared/logger";
import { patientNotificationService } from "../shared/patient-notification.service";
import { emitToUser, emitToClinic } from "../shared/realtime";

/**
 * Job to scan upcoming appointments, send push notifications at 48h, 24h, 2h thresholds,
 * and automatically change cash appointments to PENDING_CONFIRMATION if unconfirmed 12h before.
 */
export async function checkAppointmentReminders(): Promise<void> {
  console.log("🔄 [JOBS] Iniciando job de verificación de recordatorios de citas...");
  const prisma = getPrismaClient();
  const now = new Date();

  try {
    // 1. Obtener todas las citas activas próximas en las siguientes 48 horas (y un buffer en el pasado para no perder citas recientes)
    const minDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // Buffer de 2 horas en el pasado para procesar
    const maxDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const appointments = await prisma.appointments.findMany({
      where: {
        scheduled_for: {
          gt: minDate,
          lte: maxDate,
        },
        status: {
          notIn: ["CANCELLED", "COMPLETED", "NO_SHOW"],
        },
      },
      include: {
        clinics: true,
        providers: {
          select: { commercial_name: true, user_id: true },
        },
        patients: {
          include: {
            users: { select: { email: true, push_token: true } },
          },
        },
      },
    });

    console.log(`📋 [JOBS] Encontradas ${appointments.length} citas activas próximas en la ventana de control.`);

    for (const app of appointments) {
      if (!app.scheduled_for) continue;

      const scheduledTime = app.scheduled_for.getTime();
      const diffMs = scheduledTime - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const doctorName = app.providers?.commercial_name || "Médico";
      const clinicName = app.clinics?.name || doctorName;

      // Usar formateo local
      const formattedDate = app.scheduled_for.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const formattedTime = app.scheduled_for.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // ---- 48H REMINDER ----
      if (diffHours <= 48 && diffHours > 24 && !app.reminder_48h_sent) {
        console.log(`🔔 [JOBS] Recordatorio 48h para cita ${app.id} de paciente ${app.patient_id}`);
        await patientNotificationService.create({
          patientId: app.patient_id!,
          type: "cita",
          title: "Recordatorio de Cita (48h)",
          body: `Te recordamos tu cita con Dr(a). ${doctorName} en ${clinicName} el ${formattedDate} a las ${formattedTime}.`,
          data: {
            targetScreen: "Citas",
            appointmentId: app.id,
          },
        });
        await prisma.appointments.update({
          where: { id: app.id },
          data: { reminder_48h_sent: true },
        });
      }

      // ---- 24H REMINDER ----
      if (diffHours <= 24 && diffHours > 12 && !app.reminder_24h_sent) {
        console.log(`🔔 [JOBS] Recordatorio 24h para cita ${app.id} de paciente ${app.patient_id}`);
        const isCash = app.payment_method === "CASH";
        let bodyMessage = `Recuerda tu cita con Dr(a). ${doctorName} el ${formattedDate} a las ${formattedTime}.`;
        if (isCash && app.status !== "CONFIRMED") {
          bodyMessage += " Por favor, confirma tu asistencia desde la app.";
        }
        await patientNotificationService.create({
          patientId: app.patient_id!,
          type: "cita",
          title: "Recordatorio de Cita (24h)",
          body: bodyMessage,
          data: {
            targetScreen: "Citas",
            appointmentId: app.id,
            requireConfirmation: isCash && app.status !== "CONFIRMED",
          },
        });
        await prisma.appointments.update({
          where: { id: app.id },
          data: { reminder_24h_sent: true },
        });
      }

      // ---- 12H AUTO-DEMOTE TO PENDING_CONFIRMATION ----
      if (diffHours <= 12 && diffHours > 0) {
        const isCash = app.payment_method === "CASH";
        // Si el estado es PENDING y han pasado menos de 12h, demotar a PENDING_CONFIRMATION
        if (isCash && app.status === "PENDING") {
          console.log(`⚠️ [JOBS] Auto-demotando cita ${app.id} a PENDING_CONFIRMATION (faltan < 12h y no ha confirmado)`);
          await prisma.appointments.update({
            where: { id: app.id },
            data: { status: "PENDING_CONFIRMATION" },
          });

          // Notificar al paciente
          await patientNotificationService.create({
            patientId: app.patient_id!,
            type: "cita",
            title: "Confirmación de Asistencia Requerida",
            body: `Tu cita con Dr(a). ${doctorName} es en menos de 12 horas. Por favor confirma tu asistencia para mantener tu espacio reservado.`,
            data: {
              targetScreen: "Citas",
              appointmentId: app.id,
              requireConfirmation: true,
            },
          });

          // Emitir realtime al doctor y clínica
          if (app.providers?.user_id) {
            emitToUser(app.providers.user_id, "appointment:updated", {
              appointmentId: app.id,
              status: "PENDING_CONFIRMATION",
            });
          }
          if (app.clinic_id) {
            emitToClinic(app.clinic_id, "appointment:updated", {
              appointmentId: app.id,
              status: "PENDING_CONFIRMATION",
            });
          }
        }
      }

      // ---- 2H REMINDER ----
      if (diffHours <= 2 && diffHours > 0 && !app.reminder_2h_sent) {
        console.log(`🔔 [JOBS] Recordatorio 2h para cita ${app.id} de paciente ${app.patient_id}`);
        await patientNotificationService.create({
          patientId: app.patient_id!,
          type: "cita",
          title: "Tu cita es en 2 horas",
          body: `Tu cita con Dr(a). ${doctorName} es en 2 horas (${formattedTime}). ¡Te esperamos!`,
          data: {
            targetScreen: "Citas",
            appointmentId: app.id,
          },
        });
        await prisma.appointments.update({
          where: { id: app.id },
          data: { reminder_2h_sent: true },
        });
      }
    }
  } catch (error: any) {
    console.error("❌ [JOBS] Error en job de recordatorios de citas:", error.message);
    logger.error("Error in checkAppointmentReminders job", error);
  }
}

// Si se ejecuta directamente, correr el job
if (require.main === module) {
  checkAppointmentReminders()
    .then(() => {
      console.log("✅ [JOBS] Job ejecutado exitosamente");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ [JOBS] Error al ejecutar job:", error);
      process.exit(1);
    });
}
