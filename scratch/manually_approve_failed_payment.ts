import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";
import { sendPaymentConfirmationEmailHelper } from "../src/payments/payments.controller";

async function run() {
  const prisma = getPrismaClient();

  const devReference = "TX-04134AC3AD20";
  const nuveiTransactionId = "DF-37615443";
  const authCode = "366988";
  const amount = 1.0;

  console.log(`⏳ Starting manual reparation for payment of dev_reference: ${devReference}...`);

  const payment = await prisma.payments.findFirst({
    where: { external_transaction_id: devReference }
  });

  if (!payment) {
    throw new Error(`Payment with dev_reference ${devReference} not found!`);
  }

  // 1. Update payment status to PAID, and set the actual Nuvei transaction ID as external_transaction_id
  await prisma.payments.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      paid_at: new Date(),
      external_transaction_id: nuveiTransactionId
    }
  });
  console.log("✅ Payment status updated to PAID in database.");

  // 2. Update appointment status to CONFIRMED and is_paid to true
  if (payment.appointment_id) {
    await prisma.appointments.update({
      where: { id: payment.appointment_id },
      data: {
        status: "CONFIRMED",
        is_paid: true
      }
    });
    console.log(`✅ Appointment ${payment.appointment_id} updated to CONFIRMED and is_paid=true.`);

    // 3. Send confirmation email using Nuvei's exact transaction and authorization codes
    console.log("📡 Sending confirmation email...");
    await sendPaymentConfirmationEmailHelper(
      payment.appointment_id,
      amount,
      nuveiTransactionId,
      authCode
    );
    console.log("✅ Confirmation email sent successfully!");
  } else {
    console.log("⚠️ No appointment associated with this payment.");
  }
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
