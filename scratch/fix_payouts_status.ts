import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";
import { randomUUID } from "crypto";

async function fix() {
  const prisma = getPrismaClient();

  console.log("⚙️ Correcting payouts status to lowercase 'pending'...");

  // 1. Corregir cualquier Payout que esté en mayúscula "PENDING" a minúscula "pending"
  const updatedPayouts = await prisma.payouts.updateMany({
    where: { status: "PENDING" },
    data: { status: "pending" }
  });
  console.log(`Updated ${updatedPayouts.count} payouts to 'pending'.`);

  // 2. Para el pago TX-4D2B5ABABD35 que falló con 500 y no pudo crear el payout:
  const payment = await prisma.payments.findFirst({
    where: { external_transaction_id: "TX-4D2B5ABABD35" },
    include: { appointments: true }
  });

  if (payment) {
    console.log(`Found payment ${payment.external_transaction_id}. Checking associated payout...`);
    
    // Buscar si ya tiene un payout
    let payout = await prisma.payouts.findFirst({
      where: {
        payments: {
          some: { id: payment.id }
        }
      }
    });

    if (!payout) {
      console.log("No payout associated. Creating payout and correcting appointment status...");
      const payoutId = randomUUID();
      
      // Asegurarse de que el provider placeholder existe
      const clinicId = payment.clinic_id;
      if (clinicId) {
        const existingProvider = await prisma.providers.findUnique({ where: { id: clinicId } });
        if (!existingProvider) {
          const clinic = await prisma.clinics.findUnique({ where: { id: clinicId } });
          await prisma.providers.create({
            data: {
              id: clinicId,
              user_id: clinic?.user_id || null,
              commercial_name: clinic?.name || "Clínica",
              verification_status: "APPROVED"
            }
          });
          console.log("Created clinic provider placeholder.");
        }

        // Crear payout
        payout = await prisma.payouts.create({
          data: {
            id: payoutId,
            provider_id: clinicId,
            total_amount: Number(payment.provider_amount || 8.5),
            currency: "USD",
            status: "pending",
            payout_type: "clinic",
            payments: { connect: { id: payment.id } }
          }
        });
        console.log(`Created payout: ${payout.id}`);

        // Corregir cita de CANCELLED a CONFIRMED
        if (payment.appointment_id) {
          await prisma.appointments.update({
            where: { id: payment.appointment_id },
            data: { status: "CONFIRMED", is_paid: true }
          });
          console.log("Appointment status corrected to CONFIRMED.");
        }
      }
    }
  }

  console.log("✅ Fix migration completed!");
}

fix()
  .catch(console.error)
  .finally(() => process.exit(0));
