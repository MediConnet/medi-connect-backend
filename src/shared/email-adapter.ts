/**
 * Punto unico de envio de correo.
 *
 * El proyecto usa Resend. Este archivo existia como adaptador entre cuatro
 * proveedores (Resend, Nodemailer/SMTP, Mailjet y MailerLite) que se elegian
 * con la variable EMAIL_PROVIDER, pero ninguno de los otros tres se llego a
 * usar: EMAIL_PROVIDER nunca se configuro, asi que siempre cayo en Resend.
 *
 * Se retiraron en noviembre de 2026 al consolidar en Resend. Motivos:
 *  - Nodemailer arrastraba una vulnerabilidad de inyeccion de comandos SMTP
 *    (GHSA, "envelope.size" sin sanear) cuyo arreglo exigia saltar tres
 *    versiones mayores, por una rama de codigo que no se ejecutaba.
 *  - Mantener tres caminos de envio sin probar es superficie que no se revisa.
 *
 * Se conserva esta capa (y no se llama directo a email.ts) para que el resto
 * del codigo no tenga que cambiar sus imports, y para que volver a tener varios
 * proveedores algun dia sea un cambio local a este archivo.
 */

import { sendEmail as sendEmailResend } from './email';
import { logger } from './logger';

/** Opciones de un correo. */
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Envia un correo. Devuelve true si salio, false si no.
 *
 * Importante: no lanza excepcion cuando el proveedor rechaza el envio. Hay que
 * mirar el valor devuelto, o el fallo pasa inadvertido.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    return await sendEmailResend(options);
  } catch (error: any) {
    console.error('❌ [EMAIL] Error al enviar email:', error.message);
    logger.error('Error sending email', error, { to: options.to });
    return false;
  }
}

/**
 * Se mantiene por compatibilidad con quien forzaba Resend explicitamente.
 * Hoy es lo mismo que sendEmail.
 */
export async function sendEmailWithResend(options: EmailOptions): Promise<boolean> {
  return sendEmail(options);
}

/** Proveedor en uso. Util para diagnostico. */
export function getCurrentProvider(): 'resend' {
  return 'resend';
}

/** Estado del envio de correo. Util para diagnostico. */
export function getAdapterStatus() {
  return {
    currentProvider: 'resend' as const,
    resendAvailable: Boolean(process.env.RESEND_API_KEY),
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
