import { logger } from "../logger";
import { getPrismaClient } from "../prisma";

/**
 * Elimina un Push Token inválido de la base de datos.
 * Se usa cuando Expo nos informa que un dispositivo ya no está registrado (App desinstalada).
 */
export async function removeInvalidPushToken(token: string): Promise<void> {
  const prisma = getPrismaClient();

  try {
    const result = await prisma.users.updateMany({
      where: {
        push_token: token,
      },
      data: {
        push_token: null,
      },
    });

    if (result.count > 0) {
      console.log(
        `🧹 [TOKEN-CLEANUP] Token inválido eliminado de ${result.count} usuario(s). Token: ${token}`,
      );
    } else {
      console.warn(
        `⚠️ [TOKEN-CLEANUP] Se intentó borrar un token que no existía en BD: ${token}`,
      );
    }
  } catch (error: any) {
    console.error(`❌ [TOKEN-CLEANUP] Error al eliminar token:`, error.message);
    logger.error("Error removing invalid push token", error);
  }
}
