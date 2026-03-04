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
  // Por defecto usar Hostinger con puerto 465 (SSL) según configuración oficial
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPassword = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465'); // Puerto 465 (SSL) por defecto según Hostinger

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
    
    // Configuración optimizada para Hostinger y Render
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: useSSL, // true para 465 (SSL), false para otros puertos (TLS)
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Timeouts aumentados para evitar errores de conexión (especialmente importante para Render)
      connectionTimeout: 60000, // 60 segundos para establecer conexión
      greetingTimeout: 60000, // 60 segundos para recibir saludo del servidor
      socketTimeout: 60000, // 60 segundos de timeout en el socket
      // Configuración TLS/SSL mejorada para Hostinger
      tls: {
        rejectUnauthorized: false, // Permitir certificados autofirmados
        minVersion: 'TLSv1.2', // Usar TLS 1.2 o superior
        servername: smtpHost, // Especificar el nombre del servidor para SSL
      },
      // Deshabilitar pool para evitar problemas de conexión en Render
      pool: false, // Sin pool - conexiones directas más confiables
    } as any); // Type assertion para evitar problemas de tipos con nodemailer

    console.log('✅ [NODEMAILER] Transporter inicializado correctamente');
    console.log(`📧 [NODEMAILER] Email remitente: ${smtpUser}`);
    console.log(`📧 [NODEMAILER] Servidor SMTP: ${smtpHost}:${smtpPort} (${useSSL ? 'SSL' : 'TLS'})`);
    
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
      console.error(`   Código de error: ${error.code}`);
      
      // Mensajes específicos para errores comunes
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        console.error('   ⚠️ Error de conexión: Verifica que el servidor SMTP esté accesible desde Render');
        console.error('   💡 Sugerencia: Verifica SMTP_HOST, SMTP_PORT y que el firewall permita conexiones');
      } else if (error.code === 'EAUTH') {
        console.error('   ⚠️ Error de autenticación: Verifica SMTP_USER y SMTP_PASSWORD');
      }
    }
    if (error.response) {
      console.error('   Respuesta del servidor:', error.response);
    }
    if (error.responseCode) {
      console.error('   Código de respuesta:', error.responseCode);
    }
    
    logger.error('Error sending email with Nodemailer', error, { 
      to: options.to, 
      subject: options.subject,
      errorCode: error.code,
      errorMessage: error.message
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
