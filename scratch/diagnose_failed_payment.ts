import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";

async function run() {
  const prisma = getPrismaClient();

  const payment = await prisma.payments.findFirst({
    where: {
      external_transaction_id: "TX-04134AC3AD20"
    },
    include: {
      appointments: true
    }
  });

  console.log("🔍 Detailed payment data in DB:");
  console.log(JSON.stringify(payment, null, 2));
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
