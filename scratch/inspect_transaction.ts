import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";
import { randomUUID } from "crypto";

async function inspect() {
  const prisma = getPrismaClient();

  const clinicId = "cd097385-8d85-4147-97aa-4bfc67326f4f";

  console.log("🔍 Testing clinic placeholder in providers table...");
  try {
    // 1. Crear provider placeholder con el ID de la clínica si no existe
    const clinic = await prisma.clinics.findUnique({
      where: { id: clinicId }
    });

    if (!clinic) {
      console.log("Clinic not found");
      return;
    }

    let provider = await prisma.providers.findUnique({
      where: { id: clinicId }
    });

    if (!provider) {
      console.log("Creating provider placeholder for clinic...");
      provider = await prisma.providers.create({
        data: {
          id: clinicId,
          user_id: clinic.user_id,
          commercial_name: clinic.name,
          verification_status: "APPROVED"
        }
      });
      console.log("Provider created:", provider.id);
    } else {
      console.log("Provider already exists with clinicId");
    }

    // 2. Crear payout de prueba
    const payout = await prisma.payouts.create({
      data: {
        id: randomUUID(),
        provider_id: clinicId,
        total_amount: 10,
        currency: "USD",
        status: "PENDING",
        payout_type: "clinic",
      }
    });
    console.log("✅ Success! Payout created:", JSON.stringify(payout, null, 2));
    
    // Limpiar base de datos
    await prisma.payouts.delete({ where: { id: payout.id } });
  } catch (error: any) {
    console.error("❌ FAILED with error:", error.message || error);
  }
}

inspect()
  .catch(console.error)
  .finally(() => process.exit(0));
