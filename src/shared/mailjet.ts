/**
 * Módulo de Mailjet para envío de correos
 * 
 * Mailjet es más simple que Gmail OAuth y funciona inmediatamente
 * con solo las claves API.
 */

import Mailjet from 'node-mailjet';
import { logger } from './logger';

interface MailjetConfig {
  apiKey: string;
  apiSecret: string;
  fromEmail: string;
  fromName: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

// Cliente de Mailjet (singleton)
let mailjetClient: Mailjet | null = null;
let mailjetConfig: MailjetConfig | null = null;

/**
 * Inicializa el cliente de Mailjet
 */
function initializeMailjet(): { client: Mailjet; config: MailjetConfig } | null {
  if (mailjetClient && mailjetConfig) {
    return { client: mailjetClient, config: mailjetConfig };
  }

  // Obtener credenciales desde variables de entorno
  const apiKey = process.env.MAILJET_API_KEY || '52310994faddce84d73669abd3935985';
  const apiSecret = process.env.MAILJET_API_SECRET || '6347b69ec2d17372d2eb8c62c7c1b3e0';
  const fromEmail = process.env.MAILJET_FROM_EMAIL || 'noreply@mediconnect.com';
  const fromName = process.env.MAILJET_FROM_NAME || 'MediConnect';

  if (!apiKey || !apiSecret) {
    console.error('❌ [MAILJET] API Key o API Secret no configurados');
    return null;
  }

  try {
    mailjetClient = Mailjet.apiConnect(apiKey, apiSecret);
    mailjetConfig = { apiKey, apiSecret, fromEmail, fromName };
    
    console.log('✅ [MAILJET] Cliente inicializado correctamente');
    console.log(`📧 [MAILJET] Email remitente: ${fromEmail}`);
    
    return { client: mailjetClient, config: mailjetConfig };
  } catch (error: any) {
    console.error('❌ [MAILJET] Error al inicializar cliente:', error.message);
    logger.error('Error initializing Mailjet client', error);
    return null;
  }
}

/**
 * Envía un correo usando Mailjet
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const mailjet = initializeMailjet();
    
    if (!mailjet) {
      console.error('❌ [MAILJET] Cliente no inicializado');
      return false;
    }

    const { client, config } = mailjet;

    // Preparar el mensaje
    const message: any = {
      From: {
        Email: config.fromEmail,
        Name: config.fromName,
      },
      To: [
        {
          Email: options.to,
          Name: options.to.split('@')[0], // Usar parte antes del @ como nombre
        },
      ],
      Subject: options.subject,
    };

    // Agregar contenido HTML o texto
    if (options.html) {
      message.HTMLPart = options.html;
    }
    if (options.text) {
      message.TextPart = options.text;
    }
    // Si solo hay HTML, generar texto plano automáticamente
    if (options.html && !options.text) {
      message.TextPart = options.html.replace(/<[^>]*>/g, '');
    }

    // Enviar el correo
    const response: any = await client
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [message],
      });

    console.log(`✅ [MAILJET] Email enviado a ${options.to}`);
    if (response.body && response.body.Messages && response.body.Messages[0]) {
      console.log(`   ID del mensaje: ${response.body.Messages[0].To[0].MessageID}`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ [MAILJET] Error al enviar email a ${options.to}:`, error.message);
    
    // Log más detallado del error
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    logger.error('Error sending email with Mailjet', error, { 
      to: options.to, 
      subject: options.subject 
    });
    
    return false;
  }
}

/**
 * Envía un correo de prueba
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: '🧪 Correo de Prueba - MediConnect',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #667eea;">¡Hola desde MediConnect!</h1>
        <p>Este es un correo de prueba enviado desde Mailjet.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Sistema:</strong> MediConnect Backend</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          Si recibiste este correo, significa que la integración con Mailjet está funcionando correctamente. ✅
        </p>
      </div>
    `,
  });
}

/**
 * Verifica la configuración de Mailjet
 */
export function getMailjetStatus() {
  const apiKey = process.env.MAILJET_API_KEY || '52310994faddce84d73669abd3935985';
  const apiSecret = process.env.MAILJET_API_SECRET || '6347b69ec2d17372d2eb8c62c7c1b3e0';
  const fromEmail = process.env.MAILJET_FROM_EMAIL || 'noreply@mediconnect.com';
  
  return {
    configured: !!(apiKey && apiSecret),
    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'No configurado',
    fromEmail,
    ready: !!(apiKey && apiSecret),
  };
}
