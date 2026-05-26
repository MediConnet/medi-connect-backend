import { randomUUID } from "crypto";
import { logger } from "./logger";
import { getPrismaClient } from "./prisma";
import { emitToPatient } from "./realtime";

// Tipos(enum_notif_types)
export type PatientNotificationType =
  | "cita"
  | "laboratorio"
  | "farmacia"
  | "ambulancia"
  | "sistema"
  | "insumo"
  | "general";

interface CreatePatientNotificationDTO {
  patientId: string;
  type: PatientNotificationType;
  title: string;
  body: string;
  data?: any;
}

interface BroadcastNotificationDTO {
  type: PatientNotificationType;
  title: string;
  body: string;
  data?: any;
  city?: string;
}

export const patientNotificationService = {
  /**
   * CASO 1: Notificación INDIVIDUAL (Recordatorios, Citas personales)
   */
  async create(payload: CreatePatientNotificationDTO) {
    const prisma = getPrismaClient();

    try {
      const notification = await prisma.notifications.create({
        data: {
          id: randomUUID(),
          patient_id: payload.patientId,
          type: payload.type as any,
          title: payload.title,
          body: payload.body,
          data: payload.data || {},
          is_read: false,
          created_at: new Date(),
        },
      });

      console.log(
        `🔔 [PATIENT-NOTIF] Individual para ${payload.patientId}: ${payload.title}`,
      );

      // Realtime: notification:new (patient room)
      emitToPatient(payload.patientId, "notification:new", {
        scope: "patient",
        patientId: payload.patientId,
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          is_read: notification.is_read,
          data: notification.data,
          created_at: notification.created_at,
        },
      });

      // ---- ENVIAR PUSH NOTIFICATION NATIVA AL MÓVIL ----
      try {
        const patient = await prisma.patients.findUnique({
          where: { id: payload.patientId },
          include: {
            users: {
              select: {
                push_token: true,
              },
            },
          },
        });

        const token = patient?.users?.push_token;
        if (token && token.startsWith("ExponentPushToken")) {
          const { pushNotificationService } = await import("./push-notification.service");
          await pushNotificationService.send([token], payload.title, payload.body, payload.data);
          console.log(`📲 [PATIENT-NOTIF] Push individual enviado con éxito a paciente: ${payload.patientId}`);
        }
      } catch (pushErr: any) {
        console.error("❌ [PATIENT-NOTIF] Error enviando push individual:", pushErr.message);
      }

      return notification;
    } catch (error: any) {
      console.error("❌ [PATIENT-NOTIF] Error create:", error.message);
      logger.error("Error creating patient notification", error);
    }
  },

  /**
   * CASO 2: DIFUSIÓN MASIVA (Nuevo Doctor, Nueva Farmacia, Promociones)
   * Crea la notificación para TODOS los pacientes activos de una sola vez.
   */
  async broadcast(payload: BroadcastNotificationDTO) {
    const prisma = getPrismaClient();

    try {
      const whereCondition: any = {
        // user: { is_active: true } // Ejemplo: solo activos
      };

      if (payload.city) {
        whereCondition.city = payload.city;
      }

      const patients = await prisma.patients.findMany({
        where: whereCondition,
        select: { 
          id: true,
          users: {
            select: {
              push_token: true,
            },
          },
        },
      });

      if (patients.length === 0) return;

      // 2. Preparar datos para inserción masiva
      const notificationsData = patients.map((p) => ({
        id: randomUUID(),
        patient_id: p.id,
        type: payload.type as any,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        is_read: false,
        created_at: new Date(),
      }));

      // 3. Inserción masiva
      await prisma.notifications.createMany({
        data: notificationsData,
      });

      console.log(
        `📢 [PATIENT-NOTIF] Broadcast enviado a ${patients.length} pacientes: ${payload.title}`,
      );

      // ---- ENVIAR PUSH NOTIFICATION NATIVA EN LOTE ----
      try {
        const tokens = patients
          .map((p) => p.users?.push_token)
          .filter((t): t is string => !!t && t.startsWith("ExponentPushToken"));

        if (tokens.length > 0) {
          const { pushNotificationService } = await import("./push-notification.service");
          await pushNotificationService.send(tokens, payload.title, payload.body, payload.data);
          console.log(`📲 [PATIENT-NOTIF] Push broadcast enviado con éxito a ${tokens.length} dispositivos`);
        }
      } catch (pushErr: any) {
        console.error("❌ [PATIENT-NOTIF] Error enviando push broadcast:", pushErr.message);
      }
    } catch (error: any) {
      console.error("❌ [PATIENT-NOTIF] Error broadcast:", error.message);
      logger.error("Error broadcasting patient notification", error);
    }
  },
};
