import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
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
 * Obtiene el logo de DOCALINK en base64 para usar en emails
 * Esto garantiza que la imagen siempre se muestre sin depender de URLs externas
 */
function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'docalink-logo.png');
    
    // Verificar si el archivo existe
    if (fs.existsSync(logoPath)) {
      const imageBuffer = fs.readFileSync(logoPath);
      const base64Image = imageBuffer.toString('base64');
      return `data:image/png;base64,${base64Image}`;
    } else {
      console.warn(`⚠️ [EMAIL] Logo no encontrado en: ${logoPath}`);
      // Fallback: retornar URL si no se encuentra el archivo
      const baseUrl = process.env.FILE_BASE_URL || 
                      process.env.FRONTEND_URL?.replace('/api', '') || 
                      `http://localhost:${process.env.PORT || 3000}`;
      return `${baseUrl}/public/images/docalink-logo.png`;
    }
  } catch (error: any) {
    console.error(`❌ [EMAIL] Error al leer logo:`, error.message);
    // Fallback a URL
    const baseUrl = process.env.FILE_BASE_URL || 
                    process.env.FRONTEND_URL?.replace('/api', '') || 
                    `http://localhost:${process.env.PORT || 3000}`;
    return `${baseUrl}/public/images/docalink-logo.png`;
  }
}

/**
 * Genera el header del email con el logo de DOCALINK
 */
function generateEmailHeader(title: string, headerColor: string = '#14b8a6'): string {
  const logoDataUri = getLogoBase64();
  return `
    <div class="header" style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%); color: white; padding: 30px 20px; text-align: center;">
      <img src="${logoDataUri}" alt="DOCALINK" style="max-width: 180px; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;" />
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${title}</h1>
    </div>
  `;
}

/**
 * Plantilla base para emails con logo
 */
function generateEmailTemplateBase(options: {
  title: string;
  headerColor?: string;
  content: string;
}): string {
  const headerColor = options.headerColor || '#14b8a6';
  const logoDataUri = getLogoBase64();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%); color: white; padding: 30px 20px; text-align: center; }
    .header img { max-width: 180px; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; background-color: #ffffff; }
    .info-item { margin: 12px 0; padding: 8px 0; }
    .button { display: inline-block; background: ${headerColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
    .warning { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
    .link-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; word-break: break-all; }
    .footer { text-align: center; padding: 25px 20px; color: #6b7280; font-size: 12px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoDataUri}" alt="DOCALINK" />
      <h1>${options.title}</h1>
    </div>
    <div class="content">
      ${options.content}
    </div>
    <div class="footer">
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p><strong>DOCALINK</strong> - Conecta tu salud</p>
      <p>Este es un email automático, por favor no respondas.</p>
    </div>
  </div>
</body>
</html>
  `;
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
  const content = `
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
  `;
  
  return generateEmailTemplateBase({
    title: 'Nueva Cita Agendada',
    headerColor: '#14b8a6',
    content,
  });
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
  const content = `
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
  `;
  
  return generateEmailTemplateBase({
    title: 'Nueva Cita Agendada',
    headerColor: '#14b8a6',
    content,
  });
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
  const content = `
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
  `;
  
  return generateEmailTemplateBase({
    title: 'Tu Cita Ha Sido Confirmada',
    headerColor: '#14b8a6',
    content,
  });
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
  const content = `
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
  `;
  
  return generateEmailTemplateBase({
    title: '⏰ Recordatorio: Tu Cita es Mañana',
    headerColor: '#f59e0b',
    content,
  });
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
  const content = `
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
  `;
  
  return generateEmailTemplateBase({
    title: '❌ Cita Cancelada',
    headerColor: '#ef4444',
    content,
  });
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
  const content = `
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
  `;
  
  return generateEmailTemplateBase({
    title: '❌ Tu Cita Ha Sido Cancelada',
    headerColor: '#ef4444',
    content,
  });
}

/**
 * Genera el HTML del email de recuperación de contraseña
 */
export function generatePasswordResetEmail(data: {
  userName: string;
  resetToken: string;
}): string {
  const frontendUrl = process.env.FRONTEND_URL || 'https://docalink.com';
  const resetLink = `${frontendUrl}/reset-password?token=${data.resetToken}`;
  
  const content = `
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
  `;
  
  return generateEmailTemplateBase({
    title: '🔐 Recuperación de Contraseña',
    headerColor: '#14b8a6',
    content,
  });
}

/**
 * Genera el HTML del email de invitación a médico
 */
export function generateDoctorInvitationEmail(data: {
  clinicName: string;
  invitationLink: string;
}): string {
  const content = `
    <p>Hola,</p>
    <p>Has sido invitado a unirte a <strong>${data.clinicName}</strong> en la plataforma <strong>DOCALINK</strong>.</p>
    <p>DOCALINK es la plataforma que conecta profesionales de la salud con pacientes, facilitando la gestión de citas y el acceso a servicios médicos.</p>
    <p>Para aceptar la invitación y crear tu cuenta, haz clic en el siguiente botón:</p>
    <div style="text-align: center;">
      <a href="${data.invitationLink}" class="button">Aceptar Invitación</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      ⏰ <strong>Esta invitación expira en 7 días</strong> por seguridad.
    </p>
    <div class="link-box">
      <p style="margin: 0; font-size: 13px; color: #6b7280;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <a href="${data.invitationLink}" style="color: #14b8a6;">${data.invitationLink}</a>
      </p>
    </div>
    <p>Si no solicitaste esta invitación, puedes ignorar este email.</p>
  `;
  
  return generateEmailTemplateBase({
    title: '🏥 Invitación a DOCALINK',
    headerColor: '#14b8a6',
    content,
  });
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

  const content = `
    <p>Hola <strong>${data.userName}</strong>, 👋</p>
    <p>Tu registro fue aprobado y ya puedes usar <strong>DOCALINK</strong>.</p>

    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 16px; border-radius: 10px; border: 2px solid #14b8a6; margin: 18px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Tipo de cuenta:</strong> ${displayRole}</p>
      <p style="margin: 0; color: #6b7280; font-size: 13px;">Te recomendamos completar tu perfil para aprovechar al máximo la plataforma.</p>
    </div>

    <div style="text-align: center;">
      <a href="${dashboardLink}" class="button">Ir a mi panel</a>
    </div>

    <p style="margin-top: 6px;"><strong>Próximos pasos:</strong></p>
    <ul style="margin: 14px 0 0 0; padding-left: 18px; color: #374151;">
      <li style="margin: 8px 0;">Completa tu perfil y datos de contacto.</li>
      <li style="margin: 8px 0;">Configura tu disponibilidad y horarios.</li>
      <li style="margin: 8px 0;">Explora las funcionalidades de la plataforma.</li>
    </ul>

    <p style="margin-top: 18px; color: #6b7280; font-size: 13px;">
      Si no fuiste tú quien creó esta cuenta, puedes ignorar este email.
    </p>
  `;
  
  return generateEmailTemplateBase({
    title: '🎉 ¡Bienvenido a DOCALINK!',
    headerColor: '#14b8a6',
    content,
  });
}

