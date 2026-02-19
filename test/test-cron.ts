import "dotenv/config";

import { checkReminders } from "../src/jobs/check-reminders.job";
import { getPrismaClient } from "../src/shared/prisma";

// Este archivo es para ejecutar manualmente el cron job de recordatorios(que crea notificaciones del sistema y notificaciones push) y verificar su funcionamiento en un entorno real
async function runManualTest() {
  console.log("🚀 Iniciando prueba manual del Cron Job...");

  try {
    await checkReminders();
    console.log("✅ Prueba finalizada.");
  } catch (error) {
    console.error("❌ Error en la prueba:", error);
  } finally {
    await getPrismaClient().$disconnect();
  }
}

runManualTest();
