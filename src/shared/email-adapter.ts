/**
 * Adaptador de Email - Permite usar Nodemailer, Mailjet, MailerLite o Resend de forma transparente
 * 
 * Este módulo actúa como un adaptador que permite cambiar entre proveedores
 * sin modificar el código que envía correos.
 */

import { sendEmail as sendEmailResend } from './email';
import { sendEmail as sendEmailMailjet, getMailjetStatus } from './mailjet';
import { sendEmail as sendEmailNodemailer, getNodemailerStatus } from './nodemailer';
import { logger } from './logger';

/**
 * Tipo de proveedor de email
 */
export type EmailProvider = 'nodemailer' | 'mailjet' | 'mailerlite' | 'resend' | 'auto';

/**
 * Configuración del adaptador
 */
interface EmailAdapterConfig {
  provider: EmailProvider;
  fallbackToResend: boolean; // Si Mailjet/MailerLite falla, usar Resend como fallback
}

// Configuración por defecto
const defaultConfig: EmailAdapterConfig = {
  provider: (process.env.EMAIL_PROVIDER as EmailProvider) || 'mailerlite',
  fallbackToResend: process.env.EMAIL_FALLBACK_TO_RESEND === 'true' || true,
};

/**
 * Opciones de email
 */
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Determina qué proveedor usar basado en la configuración
 */
function determineProvider(config: EmailAdapterConfig): 'nodemailer' | 'mailjet' | 'mailerlite' | 'resend' {
  // Si se especifica un proveedor, usarlo
  if (config.provider === 'nodemailer' || config.provider === 'mailjet' || config.provider === 'mailerlite' || config.provider === 'resend') {
    return config.provider;
  }
  
  // Modo auto: usar MailerLite si está configurado, sino Nodemailer, sino Mailjet, sino Resend
  if (config.provider === 'auto') {
    const { getMailerLiteStatus } = require('./mailerlite');
    const mailerliteStatus = getMailerLiteStatus();
    if (mailerliteStatus.configured) {
      console.log('📧 [EMAIL-ADAPTER] Usando MailerLite (configurado)');
      return 'mailerlite';
    }
    
    const nodemailerStatus = getNodemailerStatus();
    if (nodemailerStatus.configured) {
      console.log('📧 [EMAIL-ADAPTER] Usando Nodemailer (configurado)');
      return 'nodemailer';
    }
    
    const mailjetStatus = getMailjetStatus();
    if (mailjetStatus.configured) {
      console.log('📧 [EMAIL-ADAPTER] Usando Mailjet (configurado)');
      return 'mailjet';
    }
    
    console.log('📧 [EMAIL-ADAPTER] Usando Resend (por defecto)');
    return 'resend';
  }
  
  // Por defecto, usar MailerLite
  return 'mailerlite';
}

/**
 * Envía un email usando el proveedor configurado
 * 
 * @param options - Opciones del email
 * @param config - Configuración del adaptador (opcional)
 * @returns Promise<boolean> - true si el email se envió correctamente
 */
export async function sendEmail(
  options: EmailOptions,
  config: EmailAdapterConfig = defaultConfig
): Promise<boolean> {
  const provider = determineProvider(config);
  
  try {
    if (provider === 'mailerlite') {
      // Usar MailerLite
      const { sendEmail: sendEmailMailerLite } = await import('./mailerlite');
      const result = await sendEmailMailerLite(options);
      
      if (result) {
        console.log(`✅ [EMAIL-ADAPTER] Email enviado con MailerLite a ${options.to}`);
        return true;
      } else {
        console.error(`❌ [EMAIL-ADAPTER] Error al enviar con MailerLite`);
        
        // Si hay fallback habilitado, intentar con Resend
        if (config.fallbackToResend) {
          console.log('🔄 [EMAIL-ADAPTER] Intentando con Resend como fallback...');
          return await sendEmailResend(options);
        }
        
        return false;
      }
    } else if (provider === 'nodemailer') {
      // Usar Nodemailer
      return await sendEmailNodemailer(options);
    } else if (provider === 'mailjet') {
      // Intentar enviar con Mailjet
      const result = await sendEmailMailjet({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      
      if (result) {
        console.log(`✅ [EMAIL-ADAPTER] Email enviado con Mailjet a ${options.to}`);
        return true;
      } else {
        console.error(`❌ [EMAIL-ADAPTER] Error al enviar con Mailjet`);
        
        // Si hay fallback habilitado, intentar con Resend
        if (config.fallbackToResend) {
          console.log('🔄 [EMAIL-ADAPTER] Intentando con Resend como fallback...');
          return await sendEmailResend(options);
        }
        
        return false;
      }
    } else {
      // Usar Resend
      return await sendEmailResend(options);
    }
  } catch (error: any) {
    console.error(`❌ [EMAIL-ADAPTER] Error al enviar email:`, error.message);
    logger.error('Error sending email with adapter', error, { to: options.to, provider });
    
    // Si hay fallback habilitado y estábamos usando Mailjet o MailerLite, intentar con Resend
    if ((provider === 'mailjet' || provider === 'mailerlite') && config.fallbackToResend) {
      console.log('🔄 [EMAIL-ADAPTER] Intentando con Resend como fallback...');
      try {
        return await sendEmailResend(options);
      } catch (fallbackError: any) {
        console.error(`❌ [EMAIL-ADAPTER] Fallback también falló:`, fallbackError.message);
        return false;
      }
    }
    
    return false;
  }
}

/**
 * Envía un email forzando el uso de Mailjet
 */
export async function sendEmailWithMailjet(options: EmailOptions): Promise<boolean> {
  return sendEmail(options, { provider: 'mailjet', fallbackToResend: false });
}

/**
 * Envía un email forzando el uso de MailerLite
 */
export async function sendEmailWithMailerLite(options: EmailOptions): Promise<boolean> {
  return sendEmail(options, { provider: 'mailerlite', fallbackToResend: false });
}

/**
 * Envía un email forzando el uso de Resend
 */
export async function sendEmailWithResend(options: EmailOptions): Promise<boolean> {
  return sendEmail(options, { provider: 'resend', fallbackToResend: false });
}

/**
 * Determina qué proveedor usar basado en la configuración
 */
export function getCurrentProvider(): 'nodemailer' | 'mailjet' | 'mailerlite' | 'resend' {
  return determineProvider(defaultConfig);
}

/**
 * Verifica si Mailjet está disponible
 */
export function isMailjetAvailable(): boolean {
  const status = getMailjetStatus();
  return status.configured;
}

/**
 * Obtiene información sobre el estado del adaptador
 */
export function getAdapterStatus() {
  const mailjetAvailable = isMailjetAvailable();
  const currentProvider = getCurrentProvider();
  
  return {
    currentProvider,
    mailjetAvailable,
    resendAvailable: true, // Resend siempre está disponible (modo dev si no hay API key)
    fallbackEnabled: defaultConfig.fallbackToResend,
    configuredProvider: defaultConfig.provider,
  };
}

// Re-exportar las funciones de generación de templates desde email.ts
export {
  generateDoctorNewAppointmentEmail,
  generateClinicNewAppointmentEmail,
  generatePatientNewAppointmentEmail,
  generatePatientReminderEmail,
  generateDoctorCancellationEmail,
  generatePatientCancellationEmail,
  generatePasswordResetEmail,
} from './email';
