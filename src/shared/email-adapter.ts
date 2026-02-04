/**
 * Adaptador de Email - Permite usar Nodemailer, Mailjet o Resend de forma transparente
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
export type EmailProvider = 'nodemailer' | 'mailjet' | 'resend' | 'auto';

/**
 * Configuración del adaptador
 */
interface EmailAdapterConfig {
  provider: EmailProvider;
  fallbackToResend: boolean; // Si Mailjet falla, usar Resend como fallback
}

// Configuración por defecto
const defaultConfig: EmailAdapterConfig = {
  provider: (process.env.EMAIL_PROVIDER as EmailProvider) || 'mailjet',
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
function determineProvider(config: EmailAdapterConfig): 'nodemailer' | 'mailjet' | 'resend' {
  // Si se especifica un proveedor, usarlo
  if (config.provider === 'nodemailer' || config.provider === 'mailjet' || config.provider === 'resend') {
    return config.provider;
  }
  
  // Modo auto: usar Nodemailer si está configurado, sino Mailjet, sino Resend
  if (config.provider === 'auto') {
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
  
  // Por defecto, usar Nodemailer
  return 'nodemailer';
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
    if (provider === 'nodemailer') {
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
    
    // Si hay fallback habilitado y estábamos usando Mailjet, intentar con Resend
    if (provider === 'mailjet' && config.fallbackToResend) {
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
 * Envía un email forzando el uso de Resend
 */
export async function sendEmailWithResend(options: EmailOptions): Promise<boolean> {
  return sendEmail(options, { provider: 'resend', fallbackToResend: false });
}

/**
 * Determina qué proveedor usar basado en la configuración
 */
export function getCurrentProvider(): 'nodemailer' | 'mailjet' | 'resend' {
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
} from './email';
