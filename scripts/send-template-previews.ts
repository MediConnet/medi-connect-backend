/**
 * Envia una muestra de cada plantilla de correo a un solo destinatario,
 * para revisar como se ven maquetadas.
 *
 * Renderiza las plantillas reales con datos de ejemplo y las manda por el
 * mismo camino que produccion (email-adapter). NO toca la base de datos ni
 * dispara ningun flujo de negocio: no crea citas, pagos ni usuarios.
 *
 * Uso:
 *   npx ts-node scripts/send-template-previews.ts correo@dominio.com [otro@dominio.com ...]
 */
import * as dotenv from "dotenv";
dotenv.config();

import { sendEmail } from "../src/shared/email-adapter";
import {
  generateClinicNewAppointmentEmail,
  generateDoctorCancellationEmail,
  generateDoctorNewAppointmentEmail,
  generatePasswordResetEmail,
  generatePasswordUpdatedEmail,
  generatePatientCancellationEmail,
  generatePatientNewAppointmentEmail,
  generatePatientReminderEmail,
  generatePaymentConfirmationEmail,
  generateRefundCompletedEmail,
  generateProviderRequestSubmittedEmail,
  generateRequestAcceptedEmail,
  generateWelcomeEmail,
} from "../src/shared/email";

// Datos de ejemplo compartidos, para que todos los correos cuenten la misma
// historia y se puedan comparar entre si.
const PACIENTE = "Brandon Pesantez";
const MEDICO = "Ana Maria Suarez";
const ESPECIALIDAD = "Cardiologia";
const CLINICA = "Clinica Metropolitana";
const DIRECCION = "Av. Quito 123 y Ambato, Santo Domingo";
const FECHA = "lunes 10 de noviembre de 2025";
const HORA = "10:30";
const MOTIVO = "Control de presion arterial";

interface Preview {
  proceso: string;
  para: string;
  subject: string;
  html: string;
}

const previews: Preview[] = [
  {
    proceso: "Cita confirmada",
    para: "Paciente",
    subject: "Tu cita ha sido confirmada - DOCALINK",
    html: generatePatientNewAppointmentEmail({
      patientName: PACIENTE,
      doctorName: MEDICO,
      doctorSpecialty: ESPECIALIDAD,
      clinicName: CLINICA,
      clinicAddress: DIRECCION,
      date: FECHA,
      time: HORA,
      reason: MOTIVO,
      amount: 55,
    }),
  },
  {
    proceso: "Nueva cita agendada",
    para: "Medico",
    subject: `Nueva cita agendada - ${CLINICA}`,
    html: generateDoctorNewAppointmentEmail({
      doctorName: MEDICO,
      clinicName: CLINICA,
      patientName: PACIENTE,
      patientPhone: "0999999999",
      patientEmail: "paciente@ejemplo.com",
      date: FECHA,
      time: HORA,
      reason: MOTIVO,
      clinicAddress: DIRECCION,
      amount: 55,
      isPaid: true,
    }),
  },
  {
    proceso: "Nueva cita agendada",
    para: "Clinica",
    subject: `Nueva cita agendada - ${CLINICA}`,
    html: generateClinicNewAppointmentEmail({
      doctorName: MEDICO,
      doctorSpecialty: ESPECIALIDAD,
      patientName: PACIENTE,
      date: FECHA,
      time: HORA,
      reason: MOTIVO,
    }),
  },
  {
    proceso: "Cita cancelada",
    para: "Paciente",
    subject: "Tu cita ha sido cancelada - DOCALINK",
    html: generatePatientCancellationEmail({
      patientName: PACIENTE,
      date: FECHA,
      time: HORA,
      doctorName: MEDICO,
      clinicName: CLINICA,
    }),
  },
  {
    proceso: "Cita cancelada",
    para: "Medico / clinica",
    subject: `Cita cancelada - ${CLINICA}`,
    html: generateDoctorCancellationEmail({
      doctorName: MEDICO,
      patientName: PACIENTE,
      date: FECHA,
      time: HORA,
    }),
  },
  {
    proceso: "Recordatorio de cita",
    para: "Paciente",
    subject: `Recordatorio de tu cita - ${CLINICA}`,
    html: generatePatientReminderEmail({
      patientName: PACIENTE,
      doctorName: MEDICO,
      clinicName: CLINICA,
      clinicAddress: DIRECCION,
      date: FECHA,
      time: HORA,
    }),
  },
  {
    proceso: "Comprobante de pago",
    para: "Paciente",
    subject: `Comprobante de Pago - Cita con Dr(a). ${MEDICO}`,
    html: generatePaymentConfirmationEmail({
      patientName: PACIENTE,
      doctorName: MEDICO,
      doctorSpecialty: ESPECIALIDAD,
      clinicName: CLINICA,
      clinicAddress: DIRECCION,
      date: FECHA,
      time: HORA,
      amount: 55,
      transactionId: "TRX-DEMO-000123",
      authorizationCode: "AUTH-DEMO-4455",
    }),
  },
  {
    proceso: "Confirmacion de reembolso",
    para: "Paciente",
    subject: "Confirmacion de Reembolso - DOCALINK",
    html: generateRefundCompletedEmail({
      patientName: PACIENTE,
      doctorName: MEDICO,
      clinicName: CLINICA,
      date: FECHA,
      time: HORA,
      amount: 55,
      transactionId: "TRX-DEMO-000123",
    }),
  },
  {
    proceso: "Bienvenida al registrarse",
    para: "Paciente",
    subject: "Bienvenido a DOCALINK",
    html: generateWelcomeEmail({
      userName: PACIENTE,
      userRole: "paciente",
    }),
  },
  {
    proceso: "Bienvenida + solicitud enviada",
    para: "Proveedor",
    subject: "¡Bienvenido a DOCALINK! Tu solicitud fue enviada 🎉",
    html: generateProviderRequestSubmittedEmail({
      userName: CLINICA,
      userRole: "Clínica",
    }),
  },
  {
    proceso: "Bienvenida al aprobar solicitud",
    para: "Proveedor",
    subject: "¡Tu solicitud fue aprobada! Bienvenido a DOCALINK 🎉",
    html: generateRequestAcceptedEmail({
      userName: MEDICO,
      userRole: "doctor",
    }),
  },
  {
    proceso: "Recuperacion de contrasena",
    para: "Cualquier usuario",
    subject: "Recuperacion de Contrasena - DOCALINK",
    html: generatePasswordResetEmail({
      userName: PACIENTE,
      resetToken: "token-de-ejemplo-no-funcional",
    }),
  },
  {
    proceso: "Contrasena actualizada",
    para: "Cualquier usuario",
    subject: "Tu contrasena ha sido actualizada - DOCALINK",
    html: generatePasswordUpdatedEmail({
      userName: PACIENTE,
      date: FECHA,
      time: HORA,
      location: "Santo Domingo, Ecuador",
      device: "Chrome en Windows",
    }),
  },
];

// Resend limita a 2 envios por segundo en el plan gratuito.
const DELAY_MS = 700;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const destinatarios = process.argv.slice(2).filter((arg) => arg.includes("@"));

  if (destinatarios.length === 0) {
    console.error("Falta el destinatario.");
    console.error("Uso: npx ts-node scripts/send-template-previews.ts correo@dominio.com [otro@dominio.com ...]");
    process.exit(1);
  }

  const total = previews.length * destinatarios.length;
  console.log(`Enviando ${previews.length} plantillas a ${destinatarios.length} destinatario(s): ${destinatarios.join(", ")}`);
  console.log(`Total de correos: ${total}`);
  console.log("");

  const results: { proceso: string; para: string; to: string; ok: boolean }[] = [];
  let n = 0;

  for (const to of destinatarios) {
    console.log(`--- ${to} ---`);

    for (let i = 0; i < previews.length; i++) {
      const preview = previews[i];
      const numbered = `[PRUEBA ${i + 1}/${previews.length}] ${preview.subject}`;
      n++;

      const ok = await sendEmail({
        to,
        subject: numbered,
        html: preview.html,
      });

      results.push({ proceso: preview.proceso, para: preview.para, to, ok });
      console.log(`${ok ? "OK  " : "FALLO"} ${n}/${total}  ${preview.proceso} -> ${preview.para}`);

      if (n < total) await wait(DELAY_MS);
    }

    console.log("");
  }

  const enviados = results.filter((r) => r.ok).length;
  console.log(`=== Resultado: ${enviados}/${results.length} enviados ===`);

  const fallidos = results.filter((r) => !r.ok);
  if (fallidos.length > 0) {
    console.log("Fallaron:");
    for (const f of fallidos) console.log(`  - ${f.proceso} (${f.para}) -> ${f.to}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error inesperado:", error);
  process.exit(1);
});
