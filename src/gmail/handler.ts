import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import * as gmailController from './gmail.controller';

/**
 * Handler principal para Gmail
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const path = event.rawPath || event.requestContext?.http?.path || '';
  const method = event.requestContext?.http?.method || 'GET';

  console.log(`📧 [GMAIL] ${method} ${path}`);

  try {
    // GET /api/gmail/authorize - Obtener URL de autorización
    if (path === '/api/gmail/authorize' && method === 'GET') {
      return await gmailController.authorize(event);
    }

    // GET /api/gmail/callback - Callback de OAuth2
    if (path === '/api/gmail/callback' && method === 'GET') {
      return await gmailController.callback(event);
    }

    // POST /api/gmail/send - Enviar correo
    if (path === '/api/gmail/send' && method === 'POST') {
      return await gmailController.send(event);
    }

    // GET /api/gmail/test - Enviar correo de prueba
    if (path === '/api/gmail/test' && method === 'GET') {
      return await gmailController.test(event);
    }

    // GET /api/gmail/status - Verificar estado
    if (path === '/api/gmail/status' && method === 'GET') {
      return await gmailController.status(event);
    }

    // DELETE /api/gmail/revoke - Revocar autorización
    if (path === '/api/gmail/revoke' && method === 'DELETE') {
      return await gmailController.revoke(event);
    }

    // GET /api/gmail/adapter-status - Estado del adaptador
    if (path === '/api/gmail/adapter-status' && method === 'GET') {
      return await gmailController.adapterStatus(event);
    }

    // Ruta no encontrada
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Ruta no encontrada',
        availableRoutes: [
          'GET /api/gmail/authorize',
          'GET /api/gmail/callback',
          'POST /api/gmail/send',
          'GET /api/gmail/test',
          'GET /api/gmail/status',
          'DELETE /api/gmail/revoke',
          'GET /api/gmail/adapter-status',
        ],
      }),
    };
  } catch (error: any) {
    console.error('❌ [GMAIL] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: error.message || 'Error interno del servidor',
      }),
    };
  }
}
