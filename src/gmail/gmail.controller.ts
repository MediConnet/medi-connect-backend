import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../shared/response';
import {
  getAuthUrl,
  getTokenFromCode,
  sendEmail,
  hasToken,
  deleteToken,
} from '../shared/gmail';

/**
 * GET /api/gmail/authorize
 * Obtener URL de autorización de Google OAuth2
 */
export async function authorize(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authUrl = getAuthUrl();
    
    return successResponse({
      message: 'Por favor, visita esta URL para autorizar la aplicación',
      authUrl,
      instructions: [
        '1. Abre la URL en tu navegador',
        '2. Inicia sesión con tu cuenta de Gmail',
        '3. Autoriza la aplicación',
        '4. Serás redirigido a /api/gmail/callback con el código',
      ],
    });
  } catch (error: any) {
    console.error('Error al generar URL de autorización:', error);
    return errorResponse(error.message || 'Error al generar URL de autorización', 500);
  }
}

/**
 * GET /api/gmail/callback
 * Callback de OAuth2 - Recibe el código de autorización
 */
export async function callback(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const code = event.queryStringParameters?.code;
    
    if (!code) {
      return errorResponse('Código de autorización no proporcionado', 400);
    }
    
    const token = await getTokenFromCode(code);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autorización Exitosa</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 {
              color: #667eea;
              margin-bottom: 20px;
            }
            .success-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
            .token-info {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
              margin-top: 20px;
              font-size: 12px;
              color: #888;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>¡Autorización Exitosa!</h1>
            <p>Tu cuenta de Gmail ha sido autorizada correctamente.</p>
            <p>Ahora puedes enviar correos usando la API de Gmail.</p>
            <div class="token-info">
              <strong>Token guardado:</strong> gmail-token.json<br>
              <strong>Expira:</strong> ${new Date(token.expiry_date).toLocaleString()}
            </div>
            <p style="margin-top: 20px;">
              <a href="/api/gmail/test" style="color: #667eea; text-decoration: none;">
                → Probar envío de correo
              </a>
            </p>
          </div>
        </body>
        </html>
      `,
    };
  } catch (error: any) {
    console.error('Error en callback:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html',
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error de Autorización</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 {
              color: #f5576c;
              margin-bottom: 20px;
            }
            .error-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
            .error-details {
              background: #fff5f5;
              padding: 15px;
              border-radius: 5px;
              margin-top: 20px;
              font-size: 12px;
              color: #c53030;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Error de Autorización</h1>
            <p>Hubo un problema al autorizar tu cuenta de Gmail.</p>
            <div class="error-details">
              ${error.message}
            </div>
            <p style="margin-top: 20px;">
              <a href="/api/gmail/authorize" style="color: #f5576c; text-decoration: none;">
                → Intentar nuevamente
              </a>
            </p>
          </div>
        </body>
        </html>
      `,
    };
  }
}

/**
 * POST /api/gmail/send
 * Enviar correo usando Gmail API
 */
export async function send(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    if (!hasToken()) {
      return errorResponse(
        'No hay token de autorización. Por favor, autoriza la aplicación primero en /api/gmail/authorize',
        401
      );
    }
    
    const body = JSON.parse(event.body || '{}');
    const { to, subject, message, isHtml } = body;
    
    if (!to || !subject || !message) {
      return errorResponse('Faltan campos requeridos: to, subject, message', 400);
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return errorResponse('Formato de email inválido', 400);
    }
    
    const result = await sendEmail(to, subject, message, isHtml || false);
    
    if (result.success) {
      return successResponse({
        message: 'Correo enviado exitosamente',
        messageId: result.messageId,
        to,
        subject,
      }, 201);
    } else {
      return errorResponse(result.error || 'Error al enviar correo', 500);
    }
  } catch (error: any) {
    console.error('Error al enviar correo:', error);
    return errorResponse(error.message || 'Error al enviar correo', 500);
  }
}

/**
 * GET /api/gmail/test
 * Enviar correo de prueba
 */
export async function test(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    if (!hasToken()) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'text/html',
        },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Autorización Requerida</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 500px;
              }
              h1 {
                color: #667eea;
                margin-bottom: 20px;
              }
              p {
                color: #666;
                line-height: 1.6;
              }
              .button {
                display: inline-block;
                margin-top: 20px;
                padding: 12px 30px;
                background: #667eea;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                transition: background 0.3s;
              }
              .button:hover {
                background: #5568d3;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⚠️ Autorización Requerida</h1>
              <p>Necesitas autorizar la aplicación con tu cuenta de Gmail antes de enviar correos.</p>
              <a href="/api/gmail/authorize" class="button">Autorizar Ahora</a>
            </div>
          </body>
          </html>
        `,
      };
    }
    
    // Obtener email de destino desde query params o usar uno por defecto
    const testEmail = event.queryStringParameters?.email || 'test@example.com';
    
    const result = await sendEmail(
      testEmail,
      '🧪 Correo de Prueba - MediConnect Backend',
      `
        <h1>¡Hola desde MediConnect!</h1>
        <p>Este es un correo de prueba enviado desde la API de Gmail.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Sistema:</strong> MediConnect Backend</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Si recibiste este correo, significa que la integración con Gmail API está funcionando correctamente. ✅
        </p>
      `,
      true
    );
    
    if (result.success) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html',
        },
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Correo Enviado</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
                max-width: 500px;
              }
              h1 {
                color: #667eea;
                margin-bottom: 20px;
              }
              .success-icon {
                font-size: 60px;
                margin-bottom: 20px;
              }
              p {
                color: #666;
                line-height: 1.6;
              }
              .info-box {
                background: #f5f5f5;
                padding: 15px;
                border-radius: 5px;
                margin-top: 20px;
                text-align: left;
              }
              .info-box strong {
                color: #667eea;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">📧</div>
              <h1>¡Correo Enviado!</h1>
              <p>El correo de prueba se envió exitosamente.</p>
              <div class="info-box">
                <strong>Destinatario:</strong> ${testEmail}<br>
                <strong>ID del mensaje:</strong> ${result.messageId}<br>
                <strong>Fecha:</strong> ${new Date().toLocaleString()}
              </div>
              <p style="margin-top: 20px; font-size: 14px; color: #888;">
                Revisa la bandeja de entrada del destinatario para verificar la recepción.
              </p>
            </div>
          </body>
          </html>
        `,
      };
    } else {
      return errorResponse(result.error || 'Error al enviar correo de prueba', 500);
    }
  } catch (error: any) {
    console.error('Error en test:', error);
    return errorResponse(error.message || 'Error al enviar correo de prueba', 500);
  }
}

/**
 * GET /api/gmail/status
 * Verificar estado de la autorización
 */
export async function status(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authorized = hasToken();
    
    return successResponse({
      authorized,
      message: authorized
        ? 'Gmail API está autorizada y lista para usar'
        : 'Gmail API no está autorizada. Visita /api/gmail/authorize para autorizar',
      authUrl: authorized ? null : '/api/gmail/authorize',
    });
  } catch (error: any) {
    console.error('Error al verificar estado:', error);
    return errorResponse(error.message || 'Error al verificar estado', 500);
  }
}

/**
 * DELETE /api/gmail/revoke
 * Revocar autorización (eliminar token)
 */
export async function revoke(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    deleteToken();
    
    return successResponse({
      message: 'Autorización revocada exitosamente',
      note: 'Necesitarás autorizar nuevamente para enviar correos',
    });
  } catch (error: any) {
    console.error('Error al revocar autorización:', error);
    return errorResponse(error.message || 'Error al revocar autorización', 500);
  }
}

/**
 * GET /api/gmail/adapter-status
 * Verificar estado del adaptador de email
 */
export async function adapterStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const { getAdapterStatus } = await import('../shared/email-adapter');
    const status = getAdapterStatus();
    
    return successResponse({
      ...status,
      message: `Usando ${status.currentProvider} como proveedor de email`,
      recommendations: status.mailjetAvailable
        ? ['Mailjet está configurado y listo para usar']
        : [
            'Mailjet no está configurado',
            `Actualmente usando ${status.currentProvider} como proveedor`,
          ],
    });
  } catch (error: any) {
    console.error('Error al verificar estado del adaptador:', error);
    return errorResponse(error.message || 'Error al verificar estado del adaptador', 500);
  }
}
