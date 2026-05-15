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
 * Obtiene una imagen en base64 para usar en emails
 * Busca primero en el directorio local del backend y luego en los assets de la app móvil
 */
function getImageBase64(imageName: string): string {
  try {
    // 1. Intentar en el directorio público del backend
    const backendPath = path.join(process.cwd(), 'public', 'images', imageName);
    
    // 2. Intentar en los assets de la app móvil (asumiendo estructura de carpetas compartida)
    const appAssetsPath = path.join(process.cwd(), '..', 'medi-conecct-app', 'assets', imageName);
    
    let targetPath = '';
    
    if (fs.existsSync(backendPath)) {
      targetPath = backendPath;
    } else if (fs.existsSync(appAssetsPath)) {
      targetPath = appAssetsPath;
    }

    if (targetPath) {
      const imageBuffer = fs.readFileSync(targetPath);
      const base64Image = imageBuffer.toString('base64');
      const ext = path.extname(targetPath).substring(1).replace('jfif', 'jpeg');
      return `data:image/${ext};base64,${base64Image}`;
    } else {
      console.warn(`⚠️ [EMAIL] Imagen no encontrada: ${imageName}`);
      // Fallback a una URL genérica si no existe localmente
      return `https://docalink.com/assets/${imageName}`;
    }
  } catch (error: any) {
    console.error(`❌ [EMAIL] Error al leer imagen ${imageName}:`, error.message);
    return '';
  }
}

/**
 * Shorthand para obtener el logo principal
 */
function getLogoBase64(): string {
  return getImageBase64('splash.png');
}

/**
 * Plantilla base para emails con el nuevo diseño de DocaLink
 */
function generateEmailTemplateBase(options: {
  title: string;
  headerColor?: string;
  footerColor?: string;
  content: string;
  showSocial?: boolean;
}): string {
  const primaryColor = options.headerColor || '#004aad';
  const footerColor = options.footerColor || primaryColor;
  const logoDataUri = getLogoBase64();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
    .main-container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { padding: 30px 20px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f1f5f9; }
    .header img { max-width: 180px; height: auto; }
    .content { padding: 40px 30px; }
    .title { color: ${primaryColor}; font-size: 28px; font-weight: 800; margin: 0 0 10px 0; text-align: center; }
    .subtitle { color: #64748b; font-size: 16px; margin: 0 0 30px 0; text-align: center; }
    .illustration { text-align: center; margin-bottom: 30px; }
    .illustration img { max-width: 200px; height: auto; }
    .button-container { text-align: center; margin: 35px 0; }
    .button { display: inline-block; background-color: ${primaryColor}; color: #ffffff !important; padding: 16px 35px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 74, 173, 0.2); }
    .footer-note { text-align: center; color: #94a3b8; font-size: 13px; margin-top: 20px; }
    
    /* Sección de Ayuda */
    .help-section { display: flex; justify-content: space-between; padding: 30px; border-top: 1px solid #f1f5f9; background-color: #ffffff; }
    .help-item { flex: 1; text-align: center; padding: 0 10px; }
    .help-icon { font-size: 24px; margin-bottom: 10px; display: block; }
    .help-text { font-size: 13px; color: #64748b; margin: 0; }
    .help-link { color: ${primaryColor}; font-weight: 600; text-decoration: none; font-size: 13px; }
    
    /* Redes Sociales */
    .social-section { text-align: center; padding: 20px; background-color: #ffffff; border-top: 1px solid #f1f5f9; }
    .social-title { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 15px; }
    .social-icons { margin-bottom: 10px; }
    .social-icon { display: inline-block; margin: 0 8px; width: 32px; height: 32px; }
    
    /* Footer Final */
    .final-footer { background-color: ${footerColor}; color: #ffffff; padding: 25px 30px; }
    .footer-content { display: flex; justify-content: space-between; align-items: center; }
    .footer-logo { max-width: 120px; filter: brightness(0) invert(1); }
    .footer-info { font-size: 11px; opacity: 0.9; text-align: right; }
    
    /* Caja de Detalles */
    .details-box { background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #e2e8f0; }
    .details-title { font-weight: 700; color: #108369; font-size: 14px; margin-bottom: 15px; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
    .detail-label { color: #64748b; font-weight: 500; }
    .detail-value { color: #1e293b; font-weight: 600; }

    @media only screen and (max-width: 480px) {
      .help-section { flex-direction: column; }
      .help-item { margin-bottom: 20px; }
      .footer-content { flex-direction: column; text-align: center; }
      .footer-info { text-align: center; margin-top: 15px; }
    }
  </style>
</head>
<body>
  <div class="main-container">
    <div class="header">
      <img src="${logoDataUri}" alt="DocaLink" />
    </div>
    
    <div class="content">
      ${options.content}
    </div>

    <div class="help-section">
      <div class="help-item">
        <img src="${getImageBase64('soporte-contacto.jfif')}" width="50" style="margin-bottom: 10px; border-radius: 50%;" /><br>
        <p class="help-text"><strong>¿Necesitas ayuda?</strong><br>Estamos aquí para ti.</p>
      </div>
      <div class="help-item">
        <span class="help-icon">✉️</span>
        <p class="help-text">Escríbenos a<br><a href="mailto:docalink1@gmail.com" class="help-link">docalink1@gmail.com</a></p>
      </div>
    </div>

    <div class="social-section">
      <p class="social-title">Síguenos en nuestras redes sociales</p>
      <div class="social-icons">
        <!-- Íconos simplificados (en producción usarían imágenes reales) -->
        <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="24" style="margin: 0 5px;" /></a>
        <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="24" style="margin: 0 5px;" /></a>
        <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" width="24" style="margin: 0 5px;" /></a>
        <a href="#"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="24" style="margin: 0 5px;" /></a>
      </div>
    </div>

    <div class="final-footer">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="left" style="color: white; font-size: 14px; font-weight: bold;">
            DocaLink<br><span style="font-size: 10px; font-weight: normal; opacity: 0.8;">Conecta tu salud</span>
          </td>
          <td align="center" style="color: white; font-size: 10px; opacity: 0.8;">
            Tu salud, conectada<br>en un solo lugar.
          </td>
          <td align="right" style="color: white; font-size: 10px; opacity: 0.8;">
            Soporte:<br>docalink1@gmail.com
          </td>
        </tr>
      </table>
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
    <h2 class="title">Nueva Cita Agendada</h2>
    <p>Hola Dr./Dra. <strong>${data.doctorName}</strong>,</p>
    <p>Tienes una nueva cita agendada en la plataforma:</p>
    <div class="details-box">
      <div class="detail-row"><span class="detail-label">📅 Fecha:</span> <span class="detail-value">${data.date}</span></div>
      <div class="detail-row"><span class="detail-label">🕐 Hora:</span> <span class="detail-value">${data.time}</span></div>
      <div class="detail-row"><span class="detail-label">👤 Paciente:</span> <span class="detail-value">${data.patientName}</span></div>
      ${data.reason ? `<div class="detail-row"><span class="detail-label">📋 Motivo:</span> <span class="detail-value">${data.reason}</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">🏥 Clínica:</span> <span class="detail-value">${data.clinicName}</span></div>
      <div class="detail-row"><span class="detail-label">📍 Dirección:</span> <span class="detail-value">${data.clinicAddress}</span></div>
    </div>
    <p>Por favor, revisa tu agenda en el panel de control.</p>
  `;
  
  return generateEmailTemplateBase({
    title: 'Nueva Cita Agendada',
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
    <h2 class="title">Nueva Cita Agendada</h2>
    <p>Se ha registrado una nueva cita en tu clínica:</p>
    <div class="details-box">
      <div class="detail-row"><span class="detail-label">👨‍⚕️ Médico:</span> <span class="detail-value">${data.doctorName} (${data.doctorSpecialty})</span></div>
      <div class="detail-row"><span class="detail-label">👤 Paciente:</span> <span class="detail-value">${data.patientName}</span></div>
      <div class="detail-row"><span class="detail-label">📅 Fecha:</span> <span class="detail-value">${data.date}</span></div>
      <div class="detail-row"><span class="detail-label">🕐 Hora:</span> <span class="detail-value">${data.time}</span></div>
    </div>
  `;
  
  return generateEmailTemplateBase({
    title: 'Nueva Cita Agendada',
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
    <h2 class="title" style="color: #108369;">¡Cita Confirmada!</h2>
    <p>Hola <strong>${data.patientName}</strong>,</p>
    <p>Tu cita médica ha sido confirmada exitosamente:</p>
    <div class="details-box">
      <div class="detail-row"><span class="detail-label">👨‍⚕️ Médico:</span> <span class="detail-value">Dr./Dra. ${data.doctorName}</span></div>
      <div class="detail-row"><span class="detail-label">📅 Fecha:</span> <span class="detail-value">${data.date}</span></div>
      <div class="detail-row"><span class="detail-label">🕐 Hora:</span> <span class="detail-value">${data.time}</span></div>
      <div class="detail-row"><span class="detail-label">📍 Lugar:</span> <span class="detail-value">${data.clinicName}</span></div>
    </div>
    <p style="text-align: center; font-weight: 600;">Recuerda asistir 10 minutos antes.</p>
  `;
  
  return generateEmailTemplateBase({
    title: 'Cita Confirmada',
    headerColor: '#108369',
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
    <h2 class="title" style="color: #f59e0b;">Recordatorio de Cita</h2>
    <p>Hola <strong>${data.patientName}</strong>,</p>
    <p>Te recordamos que tienes una cita programada para el día de mañana:</p>
    <div class="details-box">
      <div class="detail-row"><span class="detail-label">👨‍⚕️ Médico:</span> <span class="detail-value">${data.doctorName}</span></div>
      <div class="detail-row"><span class="detail-label">📅 Fecha:</span> <span class="detail-value">${data.date}</span></div>
      <div class="detail-row"><span class="detail-label">🕐 Hora:</span> <span class="detail-value">${data.time}</span></div>
      <div class="detail-row"><span class="detail-label">📍 Dirección:</span> <span class="detail-value">${data.clinicAddress}</span></div>
    </div>
  `;
  
  return generateEmailTemplateBase({
    title: 'Recordatorio de Cita',
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
    <h2 class="title" style="color: #ef4444;">Cita Cancelada</h2>
    <p>Hola Dr./Dra. <strong>${data.doctorName}</strong>,</p>
    <p>Se ha cancelado la siguiente cita programada:</p>
    <div class="details-box">
      <div class="detail-row"><span class="detail-label">👤 Paciente:</span> <span class="detail-value">${data.patientName}</span></div>
      <div class="detail-row"><span class="detail-label">📅 Fecha:</span> <span class="detail-value">${data.date}</span></div>
      <div class="detail-row"><span class="detail-label">🕐 Hora:</span> <span class="detail-value">${data.time}</span></div>
    </div>
  `;
  
  return generateEmailTemplateBase({
    title: 'Cita Cancelada',
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
    <h2 class="title" style="color: #ef4444;">Tu cita ha sido cancelada</h2>
    <p>Hola <strong>${data.patientName}</strong>,</p>
    <p>Lamentamos informarte que tu cita ha sido cancelada.</p>
    <div class="details-box">
      <div class="detail-row"><span class="detail-label">👨‍⚕️ Médico:</span> <span class="detail-value">${data.doctorName}</span></div>
      <div class="detail-row"><span class="detail-label">📅 Fecha:</span> <span class="detail-value">${data.date}</span></div>
      <div class="detail-row"><span class="detail-label">🕐 Hora:</span> <span class="detail-value">${data.time}</span></div>
    </div>
  `;
  
  return generateEmailTemplateBase({
    title: 'Cita Cancelada',
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
    <h2 class="title">Recupera tu contraseña</h2>
    <p class="subtitle">Solicitamos restablecer tu contraseña en DocaLink.</p>
    
    <div class="illustration">
      <img src="${getImageBase64('restablecer-contraseña.jfif')}" alt="Recuperar" />
    </div>

    <p>Hola, <strong>${data.userName}</strong> 👋</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en DocaLink.</p>
    <p>Para continuar, haz clic en el siguiente botón:</p>
    
    <div class="button-container">
      <a href="${resetLink}" class="button">🔒 Restablecer mi contraseña</a>
    </div>

    <p class="footer-note">Este enlace expirará en 60 minutos por seguridad.</p>
  `;
  
  return generateEmailTemplateBase({
    title: 'Recuperar Contraseña',
    content,
  });
}

/**
 * Genera el HTML del email de confirmación de cambio de contraseña exitoso
 */
export function generatePasswordUpdatedEmail(data: {
  userName: string;
  date?: string;
  time?: string;
  location?: string;
  device?: string;
}): string {
  const content = `
    <h2 class="title" style="color: #108369;">¡Tu contraseña ha sido actualizada con éxito!</h2>
    <p class="subtitle">Tu cuenta en DocaLink está segura.</p>
    
    <div class="illustration">
      <img src="${getImageBase64('contraseña-actualizada.jfif')}" alt="Seguro" />
    </div>

    <p>Hola, <strong>${data.userName}</strong> 👋</p>
    <p>Te informamos que tu contraseña fue actualizada correctamente. Si no realizaste este cambio, te recomendamos contactar a nuestro soporte de inmediato.</p>
    
    <div class="details-box">
      <p class="details-title">Detalles del cambio</p>
      <div class="detail-row"><span class="detail-label">📅 Fecha:</span> <span class="detail-value">${data.date || new Date().toLocaleDateString()}</span></div>
      <div class="detail-row"><span class="detail-label">🕐 Hora:</span> <span class="detail-value">${data.time || new Date().toLocaleTimeString()}</span></div>
      <div class="detail-row"><span class="detail-label">📍 Ubicación aproximada:</span> <span class="detail-value">${data.location || 'No disponible'}</span></div>
      <div class="detail-row"><span class="detail-label">💻 Dispositivo:</span> <span class="detail-value">${data.device || 'Navegador web'}</span></div>
    </div>
  `;
  
  return generateEmailTemplateBase({
    title: 'Contraseña Actualizada',
    headerColor: '#108369',
    footerColor: '#108369',
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
    <h2 class="title">Invitación a DocaLink</h2>
    <p>Has sido invitado a unirte a <strong>${data.clinicName}</strong>.</p>
    <div class="button-container">
      <a href="${data.invitationLink}" class="button">Aceptar Invitación</a>
    </div>
  `;
  
  return generateEmailTemplateBase({
    title: 'Invitación',
    content,
  });
}

export function generateWelcomeEmail(data: {
  userName: string;
  userRole: string;
}): string {
  const content = `
    <h2 class="title">¡Bienvenido a DocaLink! 🎉</h2>
    <p>Hola <strong>${data.userName}</strong>, estamos felices de tenerte con nosotros.</p>
    <p>Tu cuenta como <strong>${data.userRole}</strong> ha sido creada exitosamente.</p>
    <p>Ya puedes acceder a todos nuestros servicios desde la plataforma.</p>
  `;
  
  return generateEmailTemplateBase({
    title: 'Bienvenido',
    content,
  });
}

