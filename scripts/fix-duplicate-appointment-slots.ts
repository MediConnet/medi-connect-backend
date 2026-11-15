/**
 * Resuelve los horarios que tienen mas de una cita activa, para poder crear el
 * indice unico parcial `appointments_slot_activo_unico`. Postgres rechaza crear
 * el indice mientras existan filas que lo violen.
 *
 * Criterio: se conserva la cita mas antigua (la reserva original) y se cancelan
 * las posteriores del mismo horario. No toca los pagos: si alguna de las citas
 * canceladas tenia un cobro real, hay que revisarlo aparte desde el panel.
 *
 * Uso:
 *   npx ts-node scripts/fix-duplicate-appointment-slots.ts           (simulacion)
 *   npx ts-node scripts/fix-duplicate-appointment-slots.ts --apply   (aplica)
 */
import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

const ESTADOS_ACTIVOS = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "PENDING_PAYMENT",
  "PROCESSING",
];

async function main() {
  const aplicar = process.argv.includes("--apply");
  const prisma = getPrismaClient();

  console.log(aplicar ? "=== APLICANDO CAMBIOS ===" : "=== SIMULACION (sin --apply no se escribe nada) ===");
  console.log("");

  const grupos = await prisma.appointments.groupBy({
    by: ["provider_id", "scheduled_for"],
    where: { status: { in: ESTADOS_ACTIVOS } },
    _count: { _all: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (grupos.length === 0) {
    console.log("No hay horarios con mas de una cita activa. Nada que hacer.");
    return;
  }

  let aCancelar = 0;

  for (const grupo of grupos) {
    const citas = await prisma.appointments.findMany({
      where: {
        provider_id: grupo.provider_id,
        scheduled_for: grupo.scheduled_for,
        status: { in: ESTADOS_ACTIVOS },
      },
      orderBy: { created_at: "asc" },
      include: {
        patients: { select: { full_name: true } },
        providers: { select: { commercial_name: true } },
        payments: { select: { id: true, status: true, amount_total: true } },
      },
    });

    const [conservar, ...duplicadas] = citas;

    console.log(
      `Horario ${grupo.scheduled_for?.toISOString()} de ${conservar.providers?.commercial_name}: ${citas.length} citas`,
    );
    console.log(
      `  CONSERVA  ${conservar.id} [${conservar.status}] ${conservar.patients?.full_name} (creada ${conservar.created_at?.toISOString()})`,
    );

    for (const dup of duplicadas) {
      const pagos = dup.payments
        .map((p) => `${p.status} $${Number(p.amount_total)}`)
        .join(", ");
      console.log(
        `  CANCELA   ${dup.id} [${dup.status}] ${dup.patients?.full_name} (creada ${dup.created_at?.toISOString()})${pagos ? ` | pagos: ${pagos}` : ""}`,
      );
      aCancelar++;

      if (aplicar) {
        await prisma.appointments.update({
          where: { id: dup.id },
          data: {
            status: "CANCELLED",
            reason: "Cancelada por duplicado en el mismo horario",
          },
        });
      }
    }
    console.log("");
  }

  console.log(
    aplicar
      ? `Listo: ${aCancelar} cita(s) duplicada(s) canceladas.`
      : `Se cancelarian ${aCancelar} cita(s). Vuelve a ejecutar con --apply para aplicarlo.`,
  );
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
