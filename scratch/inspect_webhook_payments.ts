import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

async function run() {
  const prisma = getPrismaClient();

  console.log("🔍 Checking if any Nuvei payments have paid_at set (processed by webhook)...");

  const payments = await prisma.payments.findMany({
    where: {
      payment_source: "NUVEI",
      paid_at: {
        not: null
      }
    },
    orderBy: {
      paid_at: "desc"
    }
  });

  console.log(`Found ${payments.length} payments processed via webhook:`);
  payments.forEach((p) => {
    console.log({
      id: p.id,
      created_at: p.created_at,
      external_transaction_id: p.external_transaction_id,
      amount_total: p.amount_total?.toString(),
      status: p.status,
      paid_at: p.paid_at,
      payment_method: p.payment_method,
      appointment_id: p.appointment_id
    });
  });
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
