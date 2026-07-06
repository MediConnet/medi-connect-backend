import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

async function run() {
  const prisma = getPrismaClient();

  console.log("🔍 Checking recent payments from Nuvei (Paymentez)...");

  const payments = await prisma.payments.findMany({
    where: {
      payment_source: "NUVEI"
    },
    orderBy: {
      created_at: "desc"
    },
    take: 15,
    include: {
      appointments: {
        select: {
          id: true,
          status: true,
          cost: true,
          scheduled_for: true
        }
      }
    }
  });

  console.log(`Found ${payments.length} Nuvei payments:`);
  payments.forEach((p) => {
    console.log({
      id: p.id,
      created_at: p.created_at,
      external_transaction_id: p.external_transaction_id,
      amount_total: p.amount_total?.toString(),
      status: p.status,
      paid_at: p.paid_at,
      payment_method: p.payment_method,
      appointment_id: p.appointment_id,
      appointment_status: p.appointments?.status,
      scheduled_for: p.appointments?.scheduled_for
    });
  });
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
