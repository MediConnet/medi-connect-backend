/**
 * Módulo de Nodemailer para envío de correos con SMTP (Gmail, Hostinger, etc.)
 * 
 * Soporta múltiples proveedores SMTP mediante variables de entorno
 */

import nodemailer from 'nodemailer';
import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Transporter de Nodemailer (singleton)
let transporter: nodemailer.Transporter | null = null;

/**
 * Inicializa el transporter de Nodemailer con SMTP (Gmail, Hostinger, etc.)
 */
function initializeNodemailer(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter;
  }

  // Obtener credenciales desde variables de entorno
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPassword = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');

  if (!smtpUser || !smtpPassword) {
    console.error('❌ [NODEMAILER] SMTP_USER o SMTP_PASSWORD no configurados');
    console.log('💡 [NODEMAILER] Configura las variables de entorno:');
    console.log('   SMTP_HOST=smtp.hostinger.com (o tu servidor SMTP)');
    console.log('   SMTP_PORT=465 (SSL) o 587 (TLS)');
    console.log('   SMTP_USER=tu-email@docalink.com');
    console.log('   SMTP_PASSWORD=tu-contraseña');
    return null;
  }

  try {
    // Puerto 465 requiere SSL (secure: true), otros puertos usan TLS (secure: false)
    const useSSL = smtpPort === 465;
    
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: useSSL, // true para 465 (SSL), false para otros puertos (TLS)
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Timeouts para evitar que se cuelgue la conexión
      connectionTimeout: 10000, // 10 segundos para establecer conexión
      greetingTimeout: 10000, // 10 segundos para recibir saludo del servidor
      socketTimeout: 10000, // 10 segundos de timeout en el socket
    });

    console.log('✅ [NODEMAILER] Transporter inicializado correctamente');
    console.log(`📧 [NODEMAILER] Email remitente: ${smtpUser}`);
    
    return transporter;
  } catch (error: any) {
    console.error('❌ [NODEMAILER] Error al inicializar transporter:', error.message);
    logger.error('Error initializing Nodemailer transporter', error);
    return null;
  }
}

/**
 * Envía un correo usando Nodemailer con SMTP
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transport = initializeNodemailer();
    
    if (!transport) {
      console.error('❌ [NODEMAILER] Transporter no inicializado');
      return false;
    }

    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;

    // Enviar el correo
    const info = await transport.sendMail({
      from: `"MediConnect" <${smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    console.log(`✅ [NODEMAILER] Email enviado a ${options.to}`);
    console.log(`   ID del mensaje: ${info.messageId}`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ [NODEMAILER] Error al enviar email a ${options.to}:`, error.message);
    
    // Log más detallado del error
    if (error.code) {
      console.error('   Código de error:', error.code);
    }
    if (error.response) {
      console.error('   Respuesta:', error.response);
    }
    
    logger.error('Error sending email with Nodemailer', error, { 
      to: options.to, 
      subject: options.subject 
    });
    
    return false;
  }
}

/**
 * Verifica la configuración de Nodemailer
 */
export async function verifyConnection(): Promise<boolean> {
  try {
    const transport = initializeNodemailer();
    
    if (!transport) {
      return false;
    }

    await transport.verify();
    console.log('✅ [NODEMAILER] Conexión SMTP verificada correctamente');
    return true;
  } catch (error: any) {
    console.error('❌ [NODEMAILER] Error al verificar conexión SMTP:', error.message);
    return false;
  }
}

/**
 * Obtiene el estado de Nodemailer
 */
export function getNodemailerStatus() {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPassword = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  
  return {
    configured: !!(smtpUser && smtpPassword),
    smtpUser: smtpUser || 'No configurado',
    ready: !!(smtpUser && smtpPassword),
  };
}
