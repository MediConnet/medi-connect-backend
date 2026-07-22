import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

async function run() {
  const prisma = getPrismaClient();

  console.log("Inspecting recent payments in the database...");
  const payments = await prisma.payments.findMany({
    take: 10,
    orderBy: { created_at: "desc" },
    include: {
      appointments: {
        select: {
          status: true
        }
      }
    }
  });

  console.log("Recent Payments:");
  payments.forEach((p) => {
    console.log(`- UUID: ${p.id}`);
    console.log(`  Dev/Nuvei ID: ${p.external_transaction_id}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Appointment Status: ${p.appointments?.status}`);
    console.log(`  Paid At: ${p.paid_at}`);
    console.log("-----------------------------------------");
  });
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
