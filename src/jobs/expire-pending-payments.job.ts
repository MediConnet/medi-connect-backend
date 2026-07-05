import { getPrismaClient } from "../shared/prisma";
import { logger } from "../shared/logger";

/**
 * Job de limpieza: cancela citas en PENDING_PAYMENT o PROCESSING que llevan
 * más de 15 minutos sin completarse (el usuario abandonó la pantalla de pago).
 *
 * Esto libera el horario del doctor para que otros pacientes puedan reservarlo.
 * Se ejecuta cada 5 minutos desde el scheduler.
 */
export async function expirePendingPayments(): Promise<void> {
  const prisma = getPrismaClient();
  const TIMEOUT_MINUTES = 15;
  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  try {
    // Cancelar citas PENDING_PAYMENT o PROCESSING creadas hace más de 15 minutos
    const expiredAppointments = await prisma.appointments.updateMany({
      where: {
        status: { in: ["PENDING_PAYMENT", "PROCESSING"] },
        created_at: { lt: cutoff },
      },
      data: { status: "CANCELLED" },
    });

    if (expiredAppointments.count > 0) {
      console.log(
        `🧹 [EXPIRE] ${expiredAppointments.count} cita(s) expiradas canceladas (sin pago en más de ${TIMEOUT_MINUTES} min).`,
      );

      // Marcar también los pagos PENDING asociados a esas citas como EXPIRED
      // Necesitamos hacerlo en 2 pasos porque Prisma no soporta subquery directa
      // en updateMany para condición en relación. Usamos raw approach:
      const expiredPayments = await prisma.payments.updateMany({
        where: {
          status: "PENDING",
          appointments: {
            status: "CANCELLED",
            created_at: { lt: cutoff },
          },
        },
        data: { status: "EXPIRED" },
      });

      if (expiredPayments.count > 0) {
        console.log(`🧹 [EXPIRE] ${expiredPayments.count} pago(s) PENDING marcados como EXPIRED.`);
      }
    }
  } catch (error: any) {
    console.error("❌ [EXPIRE] Error en job de expiración de pagos pendientes:", error.message);
    logger.error("Error in expirePendingPayments job", error);
  }
}

// Permite ejecutar el job directamente desde CLI para testing
if (require.main === module) {
  expirePendingPayments()
    .then(() => {
      console.log("✅ [EXPIRE] Job ejecutado manualmente con éxito.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ [EXPIRE] Error al ejecutar el job:", err);
      process.exit(1);
    });
}
