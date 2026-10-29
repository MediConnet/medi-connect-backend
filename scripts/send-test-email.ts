/**
 * Diagnostico y prueba de envio de correo.
 *
 * Usa exactamente el mismo camino que produccion (email-adapter -> proveedor
 * configurado) y una plantilla real, para que lo que se vea aqui sea lo que
 * recibe un usuario.
 *
 * Uso:
 *   npx ts-node scripts/send-test-email.ts                  (solo diagnostico)
 *   npx ts-node scripts/send-test-email.ts correo@dominio   (envia de verdad)
 */
import * as dotenv from "dotenv";
dotenv.config();

import { getAdapterStatus, sendEmail } from "../src/shared/email-adapter";
import { generateWelcomeEmail } from "../src/shared/email";

const mask = (value?: string) =>
  !value ? "NO DEFINIDA" : `${value.slice(0, 4)}... (${value.length} chars)`;

async function main() {
  const to = process.argv[2];

  console.log("=== Configuracion de correo ===");
  console.log("EMAIL_PROVIDER      :", process.env.EMAIL_PROVIDER || "(no definido)");
  console.log("Proveedor efectivo  :", getAdapterStatus().currentProvider);
  console.log("RESEND_API_KEY      :", mask(process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN));
  console.log("RESEND_FROM_EMAIL   :", process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || "(no definido)");
  console.log("SMTP_HOST           :", process.env.SMTP_HOST || "(no definido)");
  console.log("MAILJET_API_KEY     :", mask(process.env.MAILJET_API_KEY));
  console.log("MAILERLITE_API_KEY  :", mask(process.env.MAILERLITE_API_KEY));
  console.log("FRONTEND_URL        :", process.env.FRONTEND_URL || "(no definido)");
  console.log("");

  if (!to) {
    console.log("Sin destinatario: no se envia nada.");
    console.log("Para enviar: npx ts-node scripts/send-test-email.ts correo@dominio");
    return;
  }

  console.log(`Enviando correo de prueba a ${to}...`);

  const html = generateWelcomeEmail({
    userName: "Prueba de configuracion",
    userRole: "Paciente",
  });

  const ok = await sendEmail({
    to,
    subject: "Prueba de envio - DOCALINK",
    html,
  });

  console.log("");
  console.log(ok ? "Resultado: sendEmail devolvio true" : "Resultado: sendEmail devolvio false");
  console.log(
    "Ojo: en modo desarrollo (sin API key) sendEmail tambien devuelve true sin enviar nada.",
  );
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exitCode = 1;
});
