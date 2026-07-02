import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

async function run() {
  const prisma = getPrismaClient();

  console.log("⚙️ Resetting all initial transaction paid_at values...");

  // 1. Restaurar las transacciones de la tabla payments que no han sido liquidadas explícitamente a paid_at: null
  // En este entorno de desarrollo, queremos que salgan pendientes para simular los pagos.
  const updatedPayments = await prisma.payments.updateMany({
    where: {
      OR: [
        { payout_id: null },
        { payouts: { status: "pending" } }
      ]
    },
    data: {
      paid_at: null,
      status: "PAID" // Estado exitoso de pasarela
    }
  });

  console.log(`✅ Cleared paid_at for ${updatedPayments.count} payments.`);

  // 2. Asegurarse de que todos los payouts vinculados que estén marcados como pendientes tengan paid_at: null
  const updatedPayouts = await prisma.payouts.updateMany({
    where: { status: "pending" },
    data: { paid_at: null }
  });

  console.log(`✅ Cleared paid_at for ${updatedPayouts.count} pending payouts.`);
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
