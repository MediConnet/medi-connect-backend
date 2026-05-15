import { ReminderType } from "../shared/enums";
import { patientNotificationService } from "../shared/patient-notification.service";
import { getPrismaClient } from "../shared/prisma";
import { pushNotificationService } from "../shared/push-notification.service";

export async function checkReminders() {
  const prisma = getPrismaClient();

  // --- 1. OBTENER HORA ACTUAL EN ECUADOR ---
  const nowInEcuador = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Guayaquil",
    }),
  );

  const currentHour = nowInEcuador.getHours();
  const currentMinute = nowInEcuador.getMinutes();

  const todayString = nowInEcuador.toISOString().split("T")[0];

  console.log(
    `\n⏰ [CRON] Iniciando (Hora Ecuador: ${currentHour}:${currentMinute})`,
  );

  try {
    const potentialReminders: any[] = await prisma.$queryRaw`
      SELECT r.*, u.push_token 
      FROM patient_reminders r
      JOIN patients p ON r.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE r.is_active = true
      AND EXTRACT(MINUTE FROM r.time) = ${currentMinute}
      AND (
        (r.type = ${ReminderType.MEDICAMENTO} AND r.start_date::date <= ${todayString}::date)
        OR
        (r.type IN (${ReminderType.CITA}, ${ReminderType.GENERAL}) AND r.start_date::date = ${todayString}::date)
      )
    `;

    if (potentialReminders.length === 0) {
      console.log("ℹ️ [CRON] Sin recordatorios para este minuto.");
      return;
    }

    console.log(
      `📊 [CRON] Procesando ${potentialReminders.length} candidatos...`,
    );

    let sentCount = 0;

    for (const record of potentialReminders) {
      const { patient_id, title, note, push_token, id, type, frequency, time } =
        record;

      // El tiempo se guarda como digits UTC (ej: 10:00 AM -> 1970-01-01 10:00:00 UTC)
      // Extraemos las horas y minutos directamente de la parte UTC para que coincidan con lo que el usuario guardó
      const recordDate = new Date(time);
      const recordHour = recordDate.getUTCHours();
      const recordMinute = recordDate.getUTCMinutes();

      console.log(
        `   🔎 ID ${id} | Hora Recordatorio: ${recordHour}:${recordMinute} vs Hora Actual: ${currentHour}:${currentMinute}`,
      );

      let shouldNotify = false;
      let notifTitle = "";
      let notifBody = "";

      // Solo procesar si el minuto coincide exactamente (el query ya lo filtra, pero por seguridad)
      if (recordMinute !== currentMinute) continue;

      // === LÓGICA MEDICAMENTOS ===
      if (type === ReminderType.MEDICAMENTO) {
        const freq = frequency || 8;
        // Calculamos la diferencia de horas
        let diffHours = currentHour - recordHour;
        if (diffHours < 0) diffHours += 24;

        // Suena si la diferencia es múltiplo de la frecuencia
        if (diffHours % freq === 0) {
          shouldNotify = true;
          notifTitle = "💊 Hora de tu medicamento";
          notifBody = note ? `${title}\n${note}` : title;
        }
      }

      // === LÓGICA CITAS / GENERAL ===
      else if (type === ReminderType.CITA || type === ReminderType.GENERAL) {
        const hoursBefore = frequency || 0;
        
        // El recordatorio de cita suena 'hoursBefore' horas antes de la hora de la cita (recordHour)
        let targetNotificationHour = recordHour - hoursBefore;
        if (targetNotificationHour < 0) targetNotificationHour += 24;

        if (currentHour === targetNotificationHour) {
          shouldNotify = true;

          const timeText =
            hoursBefore > 0 ? `en ${hoursBefore} horas` : "ahora";

          notifTitle = `📅 Recordatorio de Cita (${timeText})`;
          notifBody = note ? `${title}\n${note}` : title;
        }
      }

      // === ENVIAR ===
      if (shouldNotify) {
        const notificationType =
          type === ReminderType.MEDICAMENTO ? "farmacia" : "cita";

        // 1. Crear Notificación Interna para el historial del App
        await patientNotificationService.create({
          patientId: patient_id,
          type: notificationType,
          title: notifTitle,
          body: notifBody,
          data: { 
            targetScreen: "Reminders", 
            reminderId: id,
            type: "recordatorio" 
          },
        });

        // 2. Enviar Push Notification (Firebase/Expo)
        if (push_token) {
          try {
            if (push_token.startsWith("ExponentPushToken")) {
              await pushNotificationService.send(
                [push_token],
                notifTitle,
                notifBody,
                { 
                  type: "recordatorio", // Identificador clave para que el app active la alarma visual/vibratoria
                  targetScreen: "Reminders", 
                  reminderId: id 
                }
              );
              console.log(
                `      📲 Push enviado a ${push_token.substring(0, 15)}...`,
              );
            } else {
              console.log(`      ⚠️ Token inválido: ${push_token}`);
            }
          } catch (pushError) {
            console.error("      ❌ Error enviando push:", pushError);
          }
        }

        // Si es una cita o general, desactivar tras el primer aviso (a menos que se quiera recurrencia, que no es el caso aquí)
        if (type === ReminderType.CITA || type === ReminderType.GENERAL) {
          await prisma.patient_reminders.update({
            where: { id },
            data: { is_active: false },
          });
          console.log("      🔄 Recordatorio de cita completado y desactivado.");
        }

        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(`✅ [CRON] Éxito: ${sentCount} notificaciones enviadas.`);
    }
  } catch (error) {
    console.error("❌ [CRON] Error crítico:", error);
  }
}
