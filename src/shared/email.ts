import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Configuración del transporter de email
let transporter: nodemailer.Transporter | null = null;

/**
 * Inicializa el servicio de email
 */
function initializeEmailService(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter;
  }

  // Configuración desde variables de entorno
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  // Si no hay configuración, retornar null (modo desarrollo)
  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.log('⚠️ [EMAIL] Servicio de email no configurado. Usando modo desarrollo (solo logs)');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true para 465, false para otros puertos
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    console.log('✅ [EMAIL] Servicio de email inicializado');
    return transporter;
  } catch (error: any) {
    console.error('❌ [EMAIL] Error al inicializar servicio de email:', error.message);
    logger.error('Error initializing email service', error);
    return null;
  }
}

/**
 * Envía un email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const emailTransporter = initializeEmailService();

    // Si no hay transporter configurado, solo log (modo desarrollo)
    if (!emailTransporter) {
      console.log('📧 [EMAIL] (Modo desarrollo) Email no enviado:');
      console.log(`   To: ${options.to}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Body: ${options.text || options.html.substring(0, 100)}...`);
      return true; // Retornar true para no bloquear el flujo
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Texto plano sin HTML
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL] Email enviado a ${options.to}:`, info.messageId);
    return true;
  } catch (error: any) {
    console.error(`❌ [EMAIL] Error al enviar email a ${options.to}:`, error.message);
    logger.error('Error sending email', error, { to: options.to, subject: options.subject });
    return false; // Retornar false pero no lanzar error
  }
}

/**
 * Genera el HTML del email para nueva cita al médico
 */
export function generateDoctorNewAppointmentEmail(data: {
  doctorName: string;
  clinicName: string;
  patientName: string;
  date: string;
  time: string;
  reason?: string;
  clinicAddress: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #14b8a6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-item { margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nueva Cita Agendada</h1>
    </div>
    <div class="content">
      <p>Hola Dr./Dra. <strong>${data.doctorName}</strong>,</p>
      <p>Tienes una nueva cita agendada:</p>
      <div class="info-item">
        <strong>📅 Fecha:</strong> ${data.date}
      </div>
      <div class="info-item">
        <strong>🕐 Hora:</strong> ${data.time}
      </div>
      <div class="info-item">
        <strong>👤 Paciente:</strong> ${data.patientName}
      </div>
      ${data.reason ? `<div class="info-item"><strong>📋 Motivo:</strong> ${data.reason}</div>` : ''}
      <div class="info-item">
        <strong>🏥 Clínica:</strong> ${data.clinicName}
      </div>
      <div class="info-item">
        <strong>📍 Dirección:</strong> ${data.clinicAddress}
      </div>
      <p>Por favor, confirma tu disponibilidad.</p>
    </div>
    <div class="footer">
      <p>Saludos,<br>Equipo MediConnet</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Genera el HTML del email para nueva cita a la clínica
 */
export function generateClinicNewAppointmentEmail(data: {
  doctorName: string;
  doctorSpecialty: string;
  patientName: string;
  date: string;
  time: string;
  reason?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #14b8a6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-item { margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nueva Cita Agendada</h1>
    </div>
    <div class="content">
      <p>Hola Administrador,</p>
      <p>Se ha agendado una nueva cita en tu clínica:</p>
      <div class="info-item">
        <strong>👨‍⚕️ Médico:</strong> Dr./Dra. ${data.doctorName} - ${data.doctorSpecialty}
      </div>
      <div class="info-item">
        <strong>👤 Paciente:</strong> ${data.patientName}
      </div>
      <div class="info-item">
        <strong>📅 Fecha:</strong> ${data.date}
      </div>
      <div class="info-item">
        <strong>🕐 Hora:</strong> ${data.time}
      </div>
      ${data.reason ? `<div class="info-item"><strong>📋 Motivo:</strong> ${data.reason}</div>` : ''}
      <p>Puedes ver todos los detalles en tu panel de administración.</p>
    </div>
    <div class="footer">
      <p>Saludos,<br>Equipo MediConnet</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Genera el HTML del email para nueva cita al paciente
 */
export function generatePatientNewAppointmentEmail(data: {
  patientName: string;
  doctorName: string;
  doctorSpecialty: string;
  clinicName: string;
  clinicAddress: string;
  date: string;
  time: string;
  reason?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #14b8a6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-item { margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tu Cita Ha Sido Confirmada</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Tu cita ha sido confirmada:</p>
      <div class="info-item">
        <strong>👨‍⚕️ Médico:</strong> Dr./Dra. ${data.doctorName} - ${data.doctorSpecialty}
      </div>
      <div class="info-item">
        <strong>🏥 Clínica:</strong> ${data.clinicName}
      </div>
      <div class="info-item">
        <strong>📍 Dirección:</strong> ${data.clinicAddress}
      </div>
      <div class="info-item">
        <strong>📅 Fecha:</strong> ${data.date}
      </div>
      <div class="info-item">
        <strong>🕐 Hora:</strong> ${data.time}
      </div>
      ${data.reason ? `<div class="info-item"><strong>📋 Motivo:</strong> ${data.reason}</div>` : ''}
      <p><strong>Recuerda llegar 10 minutos antes de tu cita.</strong></p>
    </div>
    <div class="footer">
      <p>Saludos,<br>Equipo MediConnet</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Genera el HTML del email de recordatorio al paciente
 */
export function generatePatientReminderEmail(data: {
  patientName: string;
  doctorName: string;
  clinicName: string;
  clinicAddress: string;
  date: string;
  time: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-item { margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Recordatorio: Tu Cita es Mañana</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Este es un recordatorio de tu cita:</p>
      <div class="info-item">
        <strong>👨‍⚕️ Médico:</strong> Dr./Dra. ${data.doctorName}
      </div>
      <div class="info-item">
        <strong>🏥 Clínica:</strong> ${data.clinicName}
      </div>
      <div class="info-item">
        <strong>📅 Fecha:</strong> ${data.date} (mañana)
      </div>
      <div class="info-item">
        <strong>🕐 Hora:</strong> ${data.time}
      </div>
      <div class="info-item">
        <strong>📍 Dirección:</strong> ${data.clinicAddress}
      </div>
      <p>Por favor, confirma tu asistencia o cancela con anticipación si no puedes asistir.</p>
    </div>
    <div class="footer">
      <p>Saludos,<br>Equipo MediConnet</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Genera el HTML del email de cancelación al médico
 */
export function generateDoctorCancellationEmail(data: {
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-item { margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Cita Cancelada</h1>
    </div>
    <div class="content">
      <p>Hola Dr./Dra. <strong>${data.doctorName}</strong>,</p>
      <p>Se ha cancelado la siguiente cita:</p>
      <div class="info-item">
        <strong>👤 Paciente:</strong> ${data.patientName}
      </div>
      <div class="info-item">
        <strong>📅 Fecha:</strong> ${data.date}
      </div>
      <div class="info-item">
        <strong>🕐 Hora:</strong> ${data.time}
      </div>
      <div class="info-item">
        <strong>❌ Estado:</strong> Cancelada
      </div>
      <p>Puedes ver más detalles en tu panel.</p>
    </div>
    <div class="footer">
      <p>Saludos,<br>Equipo MediConnet</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Genera el HTML del email de cancelación al paciente
 */
export function generatePatientCancellationEmail(data: {
  patientName: string;
  date: string;
  time: string;
  doctorName: string;
  clinicName: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-item { margin: 10px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Tu Cita Ha Sido Cancelada</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Lamentamos informarte que tu cita ha sido cancelada:</p>
      <div class="info-item">
        <strong>📅 Fecha:</strong> ${data.date}
      </div>
      <div class="info-item">
        <strong>🕐 Hora:</strong> ${data.time}
      </div>
      <div class="info-item">
        <strong>👨‍⚕️ Médico:</strong> Dr./Dra. ${data.doctorName}
      </div>
      <div class="info-item">
        <strong>🏥 Clínica:</strong> ${data.clinicName}
      </div>
      <p>Si deseas reagendar, por favor contacta a la clínica o agenda una nueva cita desde la app.</p>
    </div>
    <div class="footer">
      <p>Saludos,<br>Equipo MediConnet</p>
    </div>
  </div>
</body>
</html>
  `;
}
