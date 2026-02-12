/**
 * MailerLite Email Service
 * Servicio para enviar emails usando la API de MailerLite
 */

import { logger } from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface MailerLiteStatus {
  configured: boolean;
  apiKey: string | null;
  fromEmail: string | null;
}

/**
 * Verifica si MailerLite está configurado
 */
export function getMailerLiteStatus(): MailerLiteStatus {
  const apiKey = process.env.MAILERLITE_API_KEY || null;
  const fromEmail = process.env.MAILERLITE_FROM_EMAIL || process.env.MAILJET_FROM_EMAIL || 'noreply@mediconnect.com';
  
  return {
    configured: !!apiKey,
    apiKey: apiKey ? '***' + apiKey.slice(-8) : null,
    fromEmail,
  };
}

/**
 * Envía un email usando MailerLite API
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const apiKey = process.env.MAILERLITE_API_KEY;
    const fromEmail = options.from || process.env.MAILERLITE_FROM_EMAIL || process.env.MAILJET_FROM_EMAIL || 'noreply@mediconnect.com';
    const fromName = process.env.MAILERLITE_FROM_NAME || 'DOCALINK';

    // Verificar configuración
    if (!apiKey) {
      console.error('❌ [MAILERLITE] API Key no configurada');
      return false;
    }

    console.log(`📧 [MAILERLITE] Enviando email a ${options.to}...`);

    // MailerLite API v2 - Envío de email transaccional
    const response = await fetch('https://connect.mailerlite.com/api/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: {
          email: fromEmail,
          name: fromName,
        },
        to: [
          {
            email: options.to,
          }
        ],
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Texto plano sin HTML
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      console.error(`❌ [MAILERLITE] Error ${response.status}:`, errorData);
      logger.error('Error sending email with MailerLite', new Error(JSON.stringify(errorData)), {
        to: options.to,
        subject: options.subject,
        status: response.status,
      });
      return false;
    }

    const data: any = await response.json();
    console.log(`✅ [MAILERLITE] Email enviado exitosamente a ${options.to}`);
    console.log(`   ID: ${data.data?.id || 'N/A'}`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ [MAILERLITE] Error al enviar email a ${options.to}:`, error.message);
    logger.error('Error sending email with MailerLite', error, {
      to: options.to,
      subject: options.subject,
    });
    return false;
  }
}
