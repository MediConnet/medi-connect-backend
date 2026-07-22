import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";
import { sendPaymentConfirmationEmailHelper } from "../src/payments/payments.controller";

async function run() {
  const prisma = getPrismaClient();

  const paymentId = "2cb1cc49-9d07-4191-8441-ec65bbd0087d";
  const nuveiTransactionId = "DF-37615443";
  const authCode = "366988";
  const amount = 1.0;

  console.log(`⏳ Triggering email resend for payment UUID: ${paymentId}...`);

  const payment = await prisma.payments.findUnique({
    where: { id: paymentId }
  });

  if (!payment) {
    throw new Error(`Payment with UUID ${paymentId} not found!`);
  }

  if (payment.appointment_id) {
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
