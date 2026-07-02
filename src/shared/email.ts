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
 * Obtiene la URL de una imagen para usar en emails
 * Se usan URLs de Cloudinary para asegurar la carga en clientes como Gmail
 */
function getImageBase64(imageName: string): string {
  const CLOUDINARY_URLS: Record<string, string> = {
    'splash.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778814193/docalink/emails/docalink_email_new_docalink-logo.png',
    'docalink-logo.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778814193/docalink/emails/docalink_email_new_docalink-logo.png',
    'restablecer-contraseña.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778814194/docalink/emails/docalink_email_new_restablecer-contrase%C3%B1a.png',
    'contraseña-actualizada.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778817412/docalink/emails/docalink_email_new_contrase%C3%B1a-actualizada.png',
    'soporte-contacto.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778814196/docalink/emails/docalink_email_new_soporte-contacto.png',
    'ambulancia.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818291/docalink/emails/docalink_email_new_ambulancia.png',
    'cita-agendada.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818292/docalink/emails/docalink_email_new_cita-agendada.png',
    'cuenta-creada.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818294/docalink/emails/docalink_email_new_cuenta-creada.png',
    'farmacia.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818295/docalink/emails/docalink_email_new_farmacia.png',
    'medico.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818296/docalink/emails/docalink_email_new_medico.png',
    'notificaciones.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818298/docalink/emails/docalink_email_new_notificaciones.png',
    'pago-consultorio.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818299/docalink/emails/docalink_email_new_pago-consultorio.png',
    'solicitud-aceptada.png': 'https://res.cloudinary.com/dws7ywsvy/image/upload/v1778818300/docalink/emails/docalink_email_new_solicitud-aceptada.png'
  };

  if (CLOUDINARY_URLS[imageName]) {
    return CLOUDINARY_URLS[imageName];
  }

  // Fallback para otras imágenes
  return `https://docalink.com/assets/${imageName}`;
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
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: Arial, sans-serif;">
  <center>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 20px 0;">
      <tr>
        <td align="center">
          <!-- Contenedor Principal -->
          <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 20px; border-bottom: 1px solid #f1f5f9;">
                <table border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="padding-right: 15px;">
                      <img src="${logoDataUri}" alt="DocaLink" width="60" style="display: block;" />
                    </td>
                    <td align="left" style="font-family: Arial, sans-serif;">
                      <span style="font-size: 32px; font-weight: 800; color: ${primaryColor}; display: block; line-height: 1;">DocaLink</span>
                      <span style="font-size: 14px; color: ${primaryColor}; opacity: 0.8;">Conecta tu salud</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Contenido Principal -->
            <tr>
              <td style="font-family: Arial, sans-serif; color: #334155;">
                <style>
                  .title { color: ${primaryColor}; font-size: 24px; font-weight: 800; margin: 0 0 10px 0; text-align: left; }
                  .subtitle { color: #64748b; font-size: 14px; margin: 0; text-align: left; }
                  .illustration { text-align: right; }
                  .illustration img { max-width: 160px; height: auto; }
                  .button-container { padding: 35px 30px; text-align: left; }
                  .button-link { color: #004aad; font-weight: 700; font-size: 16px; text-decoration: underline; }
                  .details-box { background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
                  .detail-row { margin-bottom: 10px; font-size: 13px; }
                  .detail-label { color: #64748b; font-weight: 500; }
                  .detail-value { color: #1e293b; font-weight: 600; text-align: right; }
                  .footer-note { color: #94a3b8; font-size: 13px; margin-top: 20px; }
                </style>
                <div style="padding: 0;">
                  ${options.content}
                </div>
              </td>
            </tr>

            <!-- Sección de Ayuda -->
            <tr>
              <td align="center" style="border-top: 1px solid #f1f5f9; background-color: #ffffff; padding: 30px 20px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="50%" align="center" style="border-right: 1px solid #f1f5f9; padding-right: 10px;">
                      <img src="${getImageBase64('soporte-contacto.png')}" width="45" height="45" style="display: block; margin-bottom: 10px;" />
                      <p style="margin: 0; font-size: 13px; color: #64748b; font-family: Arial, sans-serif;"><strong>¿Necesitas ayuda?</strong><br>Estamos aquí para ti.</p>
                    </td>
                    <td width="50%" align="center" style="padding-left: 10px;">
                      <span style="font-size: 24px; display: block; margin-bottom: 10px;">✉️</span>
                      <p style="margin: 0; font-size: 13px; color: #64748b; font-family: Arial, sans-serif;">Escríbenos a<br><a href="mailto:docalink1@gmail.com" style="color: ${primaryColor}; font-weight: 600; text-decoration: none;">docalink1@gmail.com</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Redes Sociales -->
            <tr>
              <td align="center" style="border-top: 1px solid #f1f5f9; padding: 25px 20px;">
                <p style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 15px 0; font-family: Arial, sans-serif;">Síguenos en nuestras redes sociales</p>
                <table border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 0 8px;"><a href="https://www.facebook.com/share/1Lmuf2rTyh/?mibextid=wwXIfr" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="28" height="28" alt="FB" /></a></td>
                    <td style="padding: 0 8px;"><a href="https://www.instagram.com/docalink1?igsh=ZGs1Y2N4dHExMHl3&utm_source=qr" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="28" height="28" alt="IG" /></a></td>
                    <td style="padding: 0 8px;"><a href="https://www.tiktok.com/@docalink4" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" width="28" height="28" alt="TK" /></a></td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer Azul/Verde -->
            <tr>
              <td style="background-color: ${footerColor}; padding: 25px 30px; color: #ffffff;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;">
                      DocaLink<br><span style="font-size: 10px; font-weight: normal; opacity: 0.8;">Conecta tu salud</span>
                    </td>
                    <td align="center" style="font-family: Arial, sans-serif; font-size: 10px; opacity: 0.8;">
                      Tu salud, conectada<br>en un solo lugar.
                    </td>
                    <td align="right" style="font-family: Arial, sans-serif; font-size: 10px; opacity: 0.8;">
                      Soporte:<br>docalink1@gmail.com
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
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
    <!-- Hero Section con fondo celeste -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #e0f2fe; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #004aad; margin: 0 0 5px 0;">Nueva Cita Agendada</h2>
          <p class="subtitle" style="color: #004aad; opacity: 0.8; font-size: 14px; margin: 0;">Tienes un nuevo paciente en espera.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('cita-agendada.png')}" width="140" alt="Cita" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola Dr./Dra. <strong>${data.doctorName}</strong> 👋,</p>
      <p>Se ha registrado una nueva cita médica en tu agenda:</p>
      
      <center>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="details-box" style="background-color: #f8fafc; border: 1px solid #e2e8f0; margin: 25px 0; max-width: 450px;">
          <tr>
            <td style="padding: 20px;">
              <p style="color: #004aad; font-weight: 700; margin: 0 0 15px 0; font-size: 14px;">Detalles de la cita</p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/2838/2838779.png" width="18" style="filter: brightness(0.5);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Fecha:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.date}</td>
                </tr>
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/2088/2088617.png" width="18" style="filter: brightness(0.5);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Hora:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.time}</td>
                </tr>
                <tr>
                  <td width="30"><img src="https://cdn-icons-png.flaticon.com/512/1077/1077114.png" width="18" style="filter: brightness(0.5);" /></td>
                  <td style="font-size: 13px; color: #64748b;">Paciente:</td>
                  <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 600;">${data.patientName}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
      <p>Puedes revisar los detalles completos y el historial clínico del paciente desde tu panel de control.</p>
    </div>
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
    <!-- Hero Section con fondo celeste -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #e0f2fe; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #004aad; margin: 0 0 5px 0;">Cita Registrada</h2>
          <p class="subtitle" style="color: #004aad; opacity: 0.8; font-size: 14px; margin: 0;">Nueva actividad en tu clínica.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('cita-agendada.png')}" width="140" alt="Clínica" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Se ha registrado una nueva cita médica en las instalaciones:</p>
      
      <center>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="details-box" style="background-color: #f8fafc; border: 1px solid #e2e8f0; margin: 25px 0; max-width: 450px;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3304/3304567.png" width="18" style="filter: brightness(0.5);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Médico:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.doctorName}</td>
                </tr>
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/1077/1077114.png" width="18" style="filter: brightness(0.5);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Paciente:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.patientName}</td>
                </tr>
                <tr>
                  <td width="30"><img src="https://cdn-icons-png.flaticon.com/512/2838/2838779.png" width="18" style="filter: brightness(0.5);" /></td>
                  <td style="font-size: 13px; color: #64748b;">Fecha:</td>
                  <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 600;">${data.date} a las ${data.time}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
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
    <!-- Hero Section con fondo verde -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #108369; margin: 0 0 5px 0;">¡Cita Confirmada!</h2>
          <p class="subtitle" style="color: #108369; opacity: 0.8; font-size: 14px; margin: 0;">Tu salud es nuestra prioridad.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('solicitud-aceptada.png')}" width="140" alt="Confirmada" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola <strong>${data.patientName}</strong> 👋,</p>
      <p>Tu cita médica ha sido confirmada exitosamente. Aquí tienes los detalles para tu visita:</p>
      
      <center>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="details-box" style="background-color: #f0fdf4; border: 1px solid #dcfce7; margin: 25px 0; max-width: 450px;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3304/3304567.png" width="18" style="filter: hue-rotate(100deg);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Especialista:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">Dr./Dra. ${data.doctorName}</td>
                </tr>
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/2838/2838779.png" width="18" style="filter: hue-rotate(100deg);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Fecha:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.date} a las ${data.time}</td>
                </tr>
                <tr>
                  <td width="30"><img src="https://cdn-icons-png.flaticon.com/512/684/684908.png" width="18" style="filter: hue-rotate(100deg);" /></td>
                  <td style="font-size: 13px; color: #64748b;">Lugar:</td>
                  <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 600;">${data.clinicName}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
      <p style="text-align: center; font-weight: 600; color: #108369;">Recuerda asistir 10 minutos antes de tu cita.</p>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Cita Confirmada',
    headerColor: '#108369',
    footerColor: '#108369',
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
    <!-- Hero Section con fondo naranja -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #c2410c; margin: 0 0 5px 0;">Recordatorio de Cita</h2>
          <p class="subtitle" style="color: #c2410c; opacity: 0.8; font-size: 14px; margin: 0;">¡Mañana tenemos una cita!</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('notificaciones.png')}" width="140" alt="Recordatorio" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola <strong>${data.patientName}</strong> 👋,</p>
      <p>Te recordamos que tienes una cita programada para el día de mañana:</p>
      
      <center>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="details-box" style="background-color: #fffcf9; border: 1px solid #fed7aa; margin: 25px 0; max-width: 450px;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3304/3304567.png" width="18" style="filter: sepia(1) saturate(5) hue-rotate(340deg);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Médico:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.doctorName}</td>
                </tr>
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/2838/2838779.png" width="18" style="filter: sepia(1) saturate(5) hue-rotate(340deg);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Fecha/Hora:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.date} a las ${data.time}</td>
                </tr>
                <tr>
                  <td width="30"><img src="https://cdn-icons-png.flaticon.com/512/684/684908.png" width="18" style="filter: sepia(1) saturate(5) hue-rotate(340deg);" /></td>
                  <td style="font-size: 13px; color: #64748b;">Dirección:</td>
                  <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 600;">${data.clinicAddress}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Recordatorio de Cita',
    headerColor: '#f59e0b',
    footerColor: '#f59e0b',
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
    <!-- Hero Section con fondo rojo -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #b91c1c; margin: 0 0 5px 0;">Cita Cancelada</h2>
          <p class="subtitle" style="color: #b91c1c; opacity: 0.8; font-size: 14px; margin: 0;">Un paciente ha cancelado su cita.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('ambulancia.png')}" width="140" alt="Cancelación" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola Dr./Dra. <strong>${data.doctorName}</strong> 👋,</p>
      <p>Te informamos que la siguiente cita ha sido cancelada:</p>
      
      <center>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="details-box" style="background-color: #fff5f5; border: 1px solid #fecaca; margin: 25px 0; max-width: 450px;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/1077/1077114.png" width="18" style="filter: hue-rotate(340deg) saturate(3);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Paciente:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.patientName}</td>
                </tr>
                <tr>
                  <td width="30"><img src="https://cdn-icons-png.flaticon.com/512/2838/2838779.png" width="18" style="filter: hue-rotate(340deg) saturate(3);" /></td>
                  <td style="font-size: 13px; color: #64748b;">Fecha/Hora:</td>
                  <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 600;">${data.date} a las ${data.time}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Cita Cancelada',
    headerColor: '#ef4444',
    footerColor: '#ef4444',
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
    <!-- Hero Section con fondo rojo -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #b91c1c; margin: 0 0 5px 0;">Cita Cancelada</h2>
          <p class="subtitle" style="color: #b91c1c; opacity: 0.8; font-size: 14px; margin: 0;">Hubo un cambio en tu cita médica.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('ambulancia.png')}" width="140" alt="Cancelación" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola <strong>${data.patientName}</strong> 👋,</p>
      <p>Lamentamos informarte que tu cita ha sido cancelada:</p>
      
      <center>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="details-box" style="background-color: #fff5f5; border: 1px solid #fecaca; margin: 25px 0; max-width: 450px;">
          <tr>
            <td style="padding: 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3304/3304567.png" width="18" style="filter: hue-rotate(340deg) saturate(3);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Médico:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">Dr./Dra. ${data.doctorName}</td>
                </tr>
                <tr>
                  <td width="30"><img src="https://cdn-icons-png.flaticon.com/512/2838/2838779.png" width="18" style="filter: hue-rotate(340deg) saturate(3);" /></td>
                  <td style="font-size: 13px; color: #64748b;">Fecha/Hora:</td>
                  <td align="right" style="font-size: 13px; color: #1e293b; font-weight: 600;">${data.date} a las ${data.time}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
      <p>Puedes volver a agendar una cita cuando lo desees desde la aplicación.</p>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Cita Cancelada',
    headerColor: '#ef4444',
    footerColor: '#ef4444',
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
    <!-- Hero Section con fondo celeste -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #e0f2fe; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #004aad; margin: 0 0 5px 0;">Recupera tu contraseña</h2>
          <p class="subtitle" style="color: #004aad; opacity: 0.8; font-size: 14px; margin: 0;">Solicitamos restablecer tu contraseña en DocaLink.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('restablecer-contraseña.png')}" width="160" alt="Recuperar" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola, <strong>${data.userName}</strong> 👋</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en DocaLink.</p>
      <p>Para continuar, haz clic en el siguiente botón:</p>
      
      <div align="center" style="margin: 35px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #004aad; color: #ffffff !important; padding: 16px 35px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">Restablecer mi contraseña</a>
      </div>

      <p class="footer-note" style="text-align: center;">Este enlace expirará en 60 minutos por seguridad.</p>
    </div>
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
    <!-- Hero Section con fondo verde -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #108369; margin: 0 0 5px 0;">¡Tu contraseña ha sido actualizada con éxito!</h2>
          <p class="subtitle" style="color: #108369; opacity: 0.8; font-size: 14px; margin: 0;">Tu cuenta en DocaLink está segura.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('contraseña-actualizada.png')}" width="160" alt="Seguro" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola, <strong>${data.userName}</strong> 👋</p>
      <p>Te informamos que tu contraseña fue actualizada correctamente. Si no realizaste este cambio, te recomendamos contactar a nuestro soporte de inmediato.</p>
      
      <center>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="details-box" style="background-color: #f0fdf4; border: 1px solid #dcfce7; margin: 25px 0; max-width: 450px;">
          <tr>
            <td style="padding: 20px;">
              <p style="color: #108369; font-weight: 700; margin: 0 0 15px 0; font-size: 14px;">Detalles del cambio</p>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <!-- Fila Fecha -->
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/2838/2838779.png" width="18" style="filter: hue-rotate(100deg);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Fecha:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.date || 'Hoy'}</td>
                </tr>
                <!-- Fila Hora -->
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/2088/2088617.png" width="18" style="filter: hue-rotate(100deg);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Hora:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.time || 'Recientemente'}</td>
                </tr>
                <!-- Fila Ubicación -->
                <tr>
                  <td width="30" style="padding-bottom: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/684/684908.png" width="18" style="filter: hue-rotate(100deg);" /></td>
                  <td style="padding-bottom: 10px; font-size: 13px; color: #64748b;">Ubicación:</td>
                  <td align="right" style="padding-bottom: 10px; font-size: 13px; color: #1e293b; font-weight: 600;">${data.location || 'No disponible'}</td>
                </tr>
                <!-- Fila Dispositivo -->
                <tr>
                  <td width="30"><img src="https://cdn-icons-png.flaticon.com/512/3039/3039399.png" width="18" style="filter: hue-rotate(100deg);" /></td>
                  <td style="font-size: 13px; color: #64748b;">Dispositivo:</td>
                  <td align="right" style="font-size: 11px; color: #1e293b; font-weight: 600; max-width: 150px;">${data.device || 'Navegador web'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </center>
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
  /** Si true, el destinatario ya tiene cuenta médico; al aceptar irá a iniciar sesión. */
  doctorExists?: boolean;
}): string {
  const loginHint = data.doctorExists
    ? `<p style="margin-top: 16px; padding: 12px; background: #eff6ff; border-radius: 8px; color: #1e40af; font-size: 14px;">
        Ya tienes una cuenta en DocaLink con este correo. Al aceptar la invitación, iniciarás sesión para unirte a <strong>${data.clinicName}</strong>.
      </p>`
    : `<p style="margin-top: 16px; color: #64748b; font-size: 14px;">
        Si aún no tienes cuenta, al aceptar completarás un breve registro como médico.
      </p>`;

  const content = `
    <!-- Hero Section con fondo celeste -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #e0f2fe; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #004aad; margin: 0 0 5px 0;">Invitación a DocaLink</h2>
          <p class="subtitle" style="color: #004aad; opacity: 0.8; font-size: 14px; margin: 0;">Únete a una red de salud inteligente.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('medico.png')}" width="140" alt="Invitación" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola 👋,</p>
      <p>Has sido invitado a formar parte del equipo médico de <strong>${data.clinicName}</strong> en nuestra plataforma.</p>
      <p>Al unirte, podrás gestionar tus citas, expedientes clínicos y pacientes de manera digital y eficiente.</p>
      ${loginHint}
      
      <div align="center" style="margin: 35px 0;">
        <a href="${data.invitationLink}" style="display: inline-block; background-color: #004aad; color: #ffffff !important; padding: 16px 35px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">Aceptar invitación</a>
      </div>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Invitación a DocaLink',
    headerColor: '#004aad',
    footerColor: '#004aad',
    content,
  });
}

export function generateWelcomeEmail(data: {
  userName: string;
  userRole: string;
}): string {
  const content = `
    <!-- Hero Section con fondo verde -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #108369; margin: 0 0 5px 0;">¡Bienvenido a DocaLink! 🎉</h2>
          <p class="subtitle" style="color: #108369; opacity: 0.8; font-size: 14px; margin: 0;">Tu salud, ahora más cerca de ti.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('cuenta-creada.png')}" width="140" alt="Bienvenido" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola <strong>${data.userName}</strong> 👋,</p>
      <p>¡Estamos muy felices de tenerte con nosotros! Tu cuenta como <strong>${data.userRole}</strong> ha sido creada exitosamente.</p>
      <p>Ya puedes acceder a todos nuestros servicios desde la plataforma y empezar a gestionar tu salud de manera digital.</p>
      
      <div align="center" style="margin: 35px 0;">
        <a href="https://docalink.com" style="display: inline-block; background-color: #108369; color: #ffffff !important; padding: 16px 35px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">Comenzar ahora</a>
      </div>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Bienvenido',
    headerColor: '#108369',
    footerColor: '#108369',
    content,
  });
}

export function generateRequestAcceptedEmail(data: {
  userName: string;
  userRole: string;
}): string {
  const content = `
    <!-- Hero Section con fondo celeste -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #e0f2fe; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #004aad; margin: 0 0 5px 0;">¡Solicitud Aceptada!</h2>
          <p class="subtitle" style="color: #004aad; opacity: 0.8; font-size: 14px; margin: 0;">Tu cuenta ha sido verificada con éxito.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('solicitud-aceptada.png')}" width="140" alt="Aceptada" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola <strong>${data.userName}</strong> 👋,</p>
      <p>Nos complace informarte que tu solicitud para unirte a <strong>DocaLink</strong> como <strong>${data.userRole}</strong> ha sido revisada y aceptada por nuestro equipo administrativo.</p>
      <p>Ya puedes acceder a tu panel de control para completar tu perfil, configurar tus servicios y empezar a recibir pacientes.</p>
      
      <div align="center" style="margin: 35px 0;">
        <a href="https://docalink.com" style="display: inline-block; background-color: #004aad; color: #ffffff !important; padding: 16px 35px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">Ir al Panel de Control</a>
      </div>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Solicitud Aceptada',
    headerColor: '#004aad',
    footerColor: '#004aad',
    content,
  });
}

/**
 * Genera el HTML del email de confirmación de pago obligatorio para Nuvei
 */
export function generatePaymentConfirmationEmail(data: {
  patientName: string;
  doctorName: string;
  doctorSpecialty: string;
  clinicName: string;
  date: string;
  time: string;
  amount: number;
  transactionId: string;
  authorizationCode: string;
}): string {
  const vat = Number((data.amount * 0.15 / 1.15).toFixed(2));
  const subtotal = Number((data.amount - vat).toFixed(2));

  const content = `
    <!-- Hero Section con fondo verde -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #108369; margin: 0 0 5px 0;">¡Pago Confirmado!</h2>
          <p class="subtitle" style="color: #108369; opacity: 0.8; font-size: 14px; margin: 0;">Tu transacción ha sido procesada con éxito.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('solicitud-aceptada.png')}" width="140" alt="Pago Exitoso" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola <strong>${data.patientName}</strong> 👋,</p>
      <p>Te confirmamos que el pago de tu cita médica ha sido procesado de forma segura y exitosa a través de nuestra pasarela de pagos Nuvei.</p>
      
      <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px;">Detalle de la Compra</h3>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 15px 0;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Servicio:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">Consulta Médica - Dr./Dra. ${data.doctorName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Especialidad:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px;">${data.doctorSpecialty}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Establecimiento:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px;">${data.clinicName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Fecha y Hora:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px;">${data.date} a las ${data.time}</td>
        </tr>
      </table>

      <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 25px;">Detalle de Facturación (Informativo)</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 15px 0; background-color: #f8fafc; padding: 15px; border-radius: 8px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-size: 14px;">Subtotal:</td>
          <td align="right" style="padding: 4px 0; color: #1e293b; font-size: 14px;">$${subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-size: 14px;">IVA (15%):</td>
          <td align="right" style="padding: 4px 0; color: #1e293b; font-size: 14px;">$${vat.toFixed(2)}</td>
        </tr>
        <tr style="font-weight: 700;">
          <td style="padding: 8px 0 0 0; color: #1e293b; font-size: 16px; border-top: 1px dashed #cbd5e1;">Total Pagado:</td>
          <td align="right" style="padding: 8px 0 0 0; color: #108369; font-size: 16px; border-top: 1px dashed #cbd5e1;">$${data.amount.toFixed(2)}</td>
        </tr>
      </table>

      <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 25px;">Información de la Transacción</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 15px 0;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">ID de Transacción (Ref):</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.transactionId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Código de Autorización:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.authorizationCode}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Medio de Pago:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px;">Tarjeta de Crédito/Débito (Nuvei)</td>
        </tr>
      </table>

      <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">
        Este correo sirve como comprobante del pago de tu cita. El médico o establecimiento correspondiente emitirá la factura fiscal respectiva.
      </p>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Confirmación de Pago',
    headerColor: '#108369',
    footerColor: '#108369',
    content,
  });
}

/**
 * Genera el HTML del email de reembolso completado
 */
export function generateRefundCompletedEmail(data: {
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  time: string;
  amount: number;
  transactionId: string;
}): string {
  const content = `
    <!-- Hero Section con fondo naranja/rojo de reembolso -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; padding: 15px 40px;">
      <tr>
        <td width="60%" align="left">
          <h2 class="title" style="color: #ea580c; margin: 0 0 5px 0;">Reembolso Exitoso</h2>
          <p class="subtitle" style="color: #ea580c; opacity: 0.8; font-size: 14px; margin: 0;">Los fondos han sido devueltos a tu cuenta.</p>
        </td>
        <td width="40%" align="right">
          <div class="illustration">
            <img src="${getImageBase64('solicitud-aceptada.png')}" width="140" alt="Reembolso Completado" />
          </div>
        </td>
      </tr>
    </table>

    <div style="padding: 40px;">
      <p>Hola <strong>${data.patientName}</strong> 👋,</p>
      <p>Te informamos que el reembolso de tu cita médica ha sido procesado de forma exitosa a través de nuestra pasarela de pagos Nuvei.</p>
      
      <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px;">Detalles de la Cita Cancelada</h3>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 15px 0;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Especialista:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px; font-weight: 600;">Dr./Dra. ${data.doctorName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Establecimiento:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px;">${data.clinicName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Fecha y Hora Original:</td>
          <td align="right" style="padding: 6px 0; color: #1e293b; font-size: 14px;">${data.date} a las ${data.time}</td>
        </tr>
      </table>

      <h3 style="color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 25px;">Información del Reembolso</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 15px 0; background-color: #f8fafc; padding: 15px; border-radius: 8px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-size: 14px;">Monto Reembolsado:</td>
          <td align="right" style="padding: 4px 0; color: #ea580c; font-size: 16px; font-weight: 700;">$${data.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-size: 14px;">ID de Transacción (Ref):</td>
          <td align="right" style="padding: 4px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.transactionId}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b; font-size: 14px;">Método de Devolución:</td>
          <td align="right" style="padding: 4px 0; color: #1e293b; font-size: 14px;">Mismo método de pago utilizado</td>
        </tr>
      </table>

      <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">
        El tiempo que tarda el dinero en verse reflejado en tu cuenta depende exclusivamente de tu banco o entidad financiera (normalmente toma entre 1 y 7 días hábiles).
      </p>
    </div>
  `;

  return generateEmailTemplateBase({
    title: 'Reembolso Procesado',
    headerColor: '#ea580c',
    footerColor: '#ea580c',
    content,
  });
}


