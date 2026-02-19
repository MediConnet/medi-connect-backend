import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { removeInvalidPushToken } from "./helpers/token-cleanup.helper";
import { logger } from "./logger";

const expo = new Expo();

export const pushNotificationService = {
  /**
   * Envía una notificación Push a uno o varios tokens
   */
  async send(pushTokens: string[], title: string, body: string, data?: any) {
    const messages: ExpoPushMessage[] = [];

    for (const token of pushTokens) {
      if (!Expo.isExpoPushToken(token)) {
        console.error(
          `❌ [PUSH] Token inválido omitido (formato incorrecto): ${token}`,
        );
        continue;
      }

      messages.push({
        to: token,
        sound: "default",
        title: title,
        body: body,
        data: data || {},
        priority: "high",
        channelId: "default",
      });
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        ticketChunk.forEach(async (ticket, index) => {
          const tokenThatFailed = chunk[index].to as string;

          if (ticket.status === "error") {
            console.error(
              `❌ [PUSH] Error enviando a ${tokenThatFailed}:`,
              ticket.message,
            );

            if (
              ticket.details &&
              ticket.details.error === "DeviceNotRegistered"
            ) {
              console.warn(`⚠️ Token vencido detectado. Iniciando limpieza...`);

              await removeInvalidPushToken(tokenThatFailed);
            }
          }
        });

        console.log(
          `✅ [PUSH] Lote procesado (${ticketChunk.length} notificaciones).`,
        );
      } catch (error) {
        console.error("❌ [PUSH] Error crítico enviando lote:", error);
        logger.error("Error sending push notifications chunk", error as Error);
      }
    }
  },
};
