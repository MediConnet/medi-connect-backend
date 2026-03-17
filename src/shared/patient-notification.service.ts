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
        select: { id: true },
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
    } catch (error: any) {
      console.error("❌ [PATIENT-NOTIF] Error broadcast:", error.message);
      logger.error("Error broadcasting patient notification", error);
    }
  },
};
