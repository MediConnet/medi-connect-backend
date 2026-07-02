import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

async function run() {
  const prisma = getPrismaClient();

  console.log("🔍 Diagnosing Brandon's payments...");

  const payments = await prisma.payments.findMany({
    where: {
      appointments: {
        providers: {
          commercial_name: { contains: "Brandon" }
        }
      }
    },
    include: {
      appointments: {
        select: {
          id: true,
          status: true,
          cost: true,
          payment_method: true
        }
      }
    }
  });

  console.log(`Found ${payments.length} payments for Brandon:`);
  payments.forEach((p) => {
    console.log({
      id: p.id,
      external_transaction_id: p.external_transaction_id,
      amount_total: p.amount_total?.toString(),
      status: p.status,
      paid_at: p.paid_at,
      payment_method: p.payment_method,
      appointment_id: p.appointment_id,
      appointment_status: p.appointments?.status,
      appointment_cost: p.appointments?.cost?.toString(),
      appointment_payment_method: p.appointments?.payment_method
    });
  });
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
