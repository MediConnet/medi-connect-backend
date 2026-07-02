import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

async function run() {
  const prisma = getPrismaClient();

  console.log("🔄 Resetting Brandon's payment to pending status...");

  // 1. Encontrar el pago de Brandon de 25.00 USD (TX-09460CB41CBE)
  const payment = await prisma.payments.findFirst({
    where: { external_transaction_id: "TX-09460CB41CBE" }
  });

  if (payment) {
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        status: "pending",
        paid_at: null
      }
    });
    console.log(`✅ Reset payment ${payment.external_transaction_id} to status='pending' and paid_at=null.`);
  } else {
    console.log("❌ Payment TX-09460CB41CBE not found.");
  }
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
