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
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || 'noreply@docalink.com';

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

/**
 * Genera el HTML del email de bienvenida
 * (Estilo consistente con el email de recuperación, pero con contenido de onboarding)
 */
export function generateWelcomeEmail(data: {
  userName: string;
  userRole: string;
}): string {
  const frontendUrl = process.env.FRONTEND_URL || "https://docalink.com";
  const dashboardLink = `${frontendUrl}/dashboard`;

  // Mapear roles a nombres más amigables (para mostrar en el email)
  const roleNames: Record<string, string> = {
    provider: "Proveedor de Servicios",
    patient: "Paciente",
    doctor: "Médico",
    pharmacy: "Farmacia",
    laboratory: "Laboratorio",
    ambulance: "Ambulancia",
    supplies: "Suministros Médicos",
    clinic: "Clínica",
  };

  const displayRole =
    roleNames[(data.userRole || "").toLowerCase()] || data.userRole || "Usuario";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 28px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { padding: 22px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
    .highlight { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 16px; border-radius: 10px; border: 2px solid #14b8a6; margin: 18px 0; }
    .button { display: inline-block; background: #14b8a6; color: white; padding: 14px 34px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; margin: 18px 0; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.25); }
    .steps { margin: 14px 0 0 0; padding-left: 18px; color: #374151; }
    .steps li { margin: 8px 0; }
    .footer { text-align: center; padding: 18px; color: #6b7280; font-size: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
    .muted { color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">🎉 ¡Bienvenido a DOCALINK!</h1>
      <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.95;">Tu cuenta ya está activa</p>
    </div>
    <div class="content">
      <p>Hola <strong>${data.userName}</strong>, 👋</p>
      <p>Tu registro fue aprobado y ya puedes usar <strong>DOCALINK</strong>.</p>

      <div class="highlight">
        <p style="margin: 0 0 8px 0;"><strong>Tipo de cuenta:</strong> ${displayRole}</p>
        <p class="muted" style="margin: 0;">Te recomendamos completar tu perfil para aprovechar al máximo la plataforma.</p>
      </div>

      <div style="text-align: center;">
        <a href="${dashboardLink}" class="button">Ir a mi panel</a>
      </div>

      <p style="margin-top: 6px;"><strong>Próximos pasos:</strong></p>
      <ul class="steps">
        <li>Completa tu perfil y datos de contacto.</li>
        <li>Configura tu disponibilidad y horarios.</li>
        <li>Explora las funcionalidades de la plataforma.</li>
      </ul>

      <p class="muted" style="margin-top: 18px;">
        Si no fuiste tú quien creó esta cuenta, puedes ignorar este email.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;"><strong>DOCALINK</strong> - Conecta tu salud</p>
      <p style="margin: 6px 0 0 0;">Este es un email automático, por favor no respondas.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Genera el HTML del email de bienvenida para nuevos usuarios aprobados
 */
export function generateWelcomeEmail(data: {
  userName: string;
  userRole: string;
  loginUrl: string;
}): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a DOCALINK</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 50px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700;">
                🎉 ¡Bienvenido!
              </h1>
              <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 18px; opacity: 0.9;">
                Tu cuenta ha sido aprobada exitosamente
              </p>
            </td>
          </tr>
          
          <!-- Contenido -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                Hola ${data.userName}, 👋
              </h2>
              
              <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
                Gracias por unirte a <strong style="color: #14b8a6;">DOCALINK</strong>, la plataforma que conecta tu salud.
              </p>
              
              <p style="margin: 0 0 25px 0; color: #6b7280; font-size: 15px; line-height: 1.6;">
                Estamos emocionados de tenerte con nosotros. Tu cuenta como <strong>${data.userRole}</strong> está lista para usar.
              </p>
              
              <!-- Botón CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${data.loginUrl}" style="display: inline-block; background-color: #14b8a6; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.3);">
                      Iniciar Sesión →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Próximos Pasos -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 25px; border: 2px solid #14b8a6;">
                <tr>
                  <td>
                    <p style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px; font-weight: 600;">
                      🚀 Próximos pasos:
                    </p>
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top; width: 30px;">
                          <span style="display: inline-block; background-color: #14b8a6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">1</span>
                        </td>
                        <td style="color: #1f2937; font-size: 14px; line-height: 1.6;">
                          <strong>Completa tu perfil</strong><br>
                          <span style="color: #6b7280; font-size: 13px;">Agrega tu foto, información de contacto y especialidades</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="vertical-align: top;">
                          <span style="display: inline-block; background-color: #14b8a6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">2</span>
                        </td>
                        <td style="color: #1f2937; font-size: 14px; line-height: 1.6;">
                          <strong>Configura tu disponibilidad</strong><br>
                          <span style="color: #6b7280; font-size: 13px;">Define tus horarios de atención y días disponibles</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="vertical-align: top;">
                          <span style="display: inline-block; background-color: #14b8a6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">3</span>
                        </td>
                        <td style="color: #1f2937; font-size: 14px; line-height: 1.6;">
                          <strong>Explora la plataforma</strong><br>
                          <span style="color: #6b7280; font-size: 13px;">Familiarízate con todas las funcionalidades disponibles</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Soporte -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; background-color: #f0f9ff; border-radius: 8px; padding: 20px; border-left: 4px solid #3b82f6;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 15px; font-weight: 600;">
                      💡 ¿Necesitas ayuda?
                    </p>
                    <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.6;">
                      Nuestro equipo de soporte está disponible para ayudarte.<br>
                      📧 Email: <a href="mailto:soporte@docalink.com" style="color: #3b82f6;">soporte@docalink.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">
                © 2024 DOCALINK - Conecta tu salud<br>
                Este es un email automático, por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
