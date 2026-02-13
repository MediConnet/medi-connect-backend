import { Resend } from 'resend';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string; // Opcional: si no se proporciona, se usa el valor por defecto
}

// Cliente de Resend (singleton)
let resendClient: Resend | null = null;

/**
 * Inicializa el servicio de email con Resend
 */
function initializeEmailService(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  // API Key de Resend desde variables de entorno (soporta ambos nombres por compatibilidad)
  const resendApiToken = process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN || 're_SSG1TwXf_7c58f9HHEiPPaHbAverY4DKb';
  
  // Email desde el que se enviarán los correos (debe estar verificado en Resend)
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || 'noreply@mediconnect.com';

  // Si no hay API key, retornar null (modo desarrollo)
  if (!resendApiToken) {
    console.log('⚠️ [EMAIL] API Key de Resend no configurada (RESEND_API_KEY). Usando modo desarrollo (solo logs)');
    return null;
  }

  try {
    resendClient = new Resend(resendApiToken);
    console.log('✅ [EMAIL] Servicio de email Resend inicializado');
    console.log(`📧 [EMAIL] Email remitente: ${fromEmail}`);
    return resendClient;
  } catch (error: any) {
    console.error('❌ [EMAIL] Error al inicializar servicio de email Resend:', error.message);
    logger.error('Error initializing Resend email service', error);
    return null;
  }
}

/**
 * Envía un email usando Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const client = initializeEmailService();
    const fromEmail = options.from || process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || 'noreply@mediconnect.com';

    // Si no hay cliente configurado, solo log (modo desarrollo)
    if (!client) {
      console.log('📧 [EMAIL] (Modo desarrollo) Email no enviado:');
      console.log(`   From: ${fromEmail}`);
      console.log(`   To: ${options.to}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Body: ${options.text || options.html.substring(0, 100)}...`);
      return true; // Retornar true para no bloquear el flujo
    }

    // Enviar email usando Resend
    const response = await client.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Texto plano sin HTML
    });

    console.log(`✅ [EMAIL] Email enviado a ${options.to} usando Resend. ID: ${response.data?.id || 'N/A'}`);
    return true;
  } catch (error: any) {
    console.error(`❌ [EMAIL] Error al enviar email a ${options.to}:`, error.message);
    logger.error('Error sending email with Resend', error, { to: options.to, subject: options.subject });
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

/**
 * Genera el HTML del email de recuperación de contraseña
 */
export function generatePasswordResetEmail(data: {
  userName: string;
  resetToken: string;
}): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${data.resetToken}`;
  
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
    .warning { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
    .button { display: inline-block; background: #14b8a6; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; }
    .link-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Recuperación de Contraseña</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${data.userName}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>DOCALINK</strong>.</p>
      <div class="warning">
        <p style="margin: 0; color: #92400e;">
          ⚠️ <strong>Importante:</strong> Si no solicitaste este cambio, ignora este email. 
          Tu contraseña permanecerá sin cambios.
        </p>
      </div>
      <p>Para restablecer tu contraseña, haz clic en el siguiente botón:</p>
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Restablecer Contraseña</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        ⏰ <strong>Este enlace expira en 1 hora</strong> por seguridad.
      </p>
      <div class="link-box">
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
          <a href="${resetLink}" style="color: #14b8a6;">${resetLink}</a>
        </p>
      </div>
    </div>
    <div class="footer">
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p><strong>DOCALINK</strong> - Conecta tu salud<br>
      Este es un email automático, por favor no respondas.</p>
    </div>
  </div>
</body>
</html>
  `;
}
