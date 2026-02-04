/**
 * Módulo de Nodemailer para envío de correos con Gmail SMTP
 * 
 * Más simple y confiable para desarrollo que Mailjet o Resend
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
 * Inicializa el transporter de Nodemailer con Gmail SMTP
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
    console.log('💡 [NODEMAILER] Para usar Gmail:');
    console.log('   1. Ve a https://myaccount.google.com/apppasswords');
    console.log('   2. Genera una "App Password"');
    console.log('   3. Configura en .env:');
    console.log('      SMTP_USER=tu-email@gmail.com');
    console.log('      SMTP_PASSWORD=tu-app-password');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // true para 465, false para otros puertos
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
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
 * Envía un correo usando Nodemailer con Gmail SMTP
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
