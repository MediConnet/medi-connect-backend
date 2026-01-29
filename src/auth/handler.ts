import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse } from '../shared/response';
// Importamos todas las funciones del controller
import * as authController from './auth.controller';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Auth handler invoked', { method, path });

  // Manejar preflight CORS
  if (method === 'OPTIONS') {
    const { optionsResponse } = await import('../shared/response');
    return optionsResponse(event);
  }

  try {
    // --- RUTAS DE AUTENTICACIÓN ---

    // 1. Registro
    if (method === 'POST' && path === '/api/auth/register') {
      return await authController.register(event);
    }

    // 2. Login (Devuelve user + tokens + tipo)
    if (method === 'POST' && path === '/api/auth/login') {
      return await authController.login(event);
    }

    // 3. Refresh Token
    if (method === 'POST' && path === '/api/auth/refresh') {
      return await authController.refresh(event);
    }

    // 4. Usuario Actual (Me)
    if (method === 'GET' && path === '/api/auth/me') {
      return await authController.me(event);
    }

    // 5. Cambio de Contraseña
    if (method === 'POST' && path === '/api/auth/change-password') {
      return await authController.changePassword(event);
    }

    // 6. Recuperación de Contraseña (Forgot)
    if (method === 'POST' && path === '/api/auth/forgot-password') {
      return await authController.forgotPassword(event);
    }

    // 7. Reseteo de Contraseña (Reset)
    if (method === 'POST' && path === '/api/auth/reset-password') {
      return await authController.resetPassword(event);
    }

    // 8. Registro Profesional (Proxy a Admin Handler)
    if (method === 'POST' && path === '/api/auth/register-professional') {
      console.log('✅ [AUTH] Proxying to /api/providers/register');
      const { handler: adminHandler } = await import('../admin/handler');
      
      const proxiedEvent = {
        ...event,
        requestContext: {
          ...event.requestContext,
          http: { ...event.requestContext.http, path: '/api/providers/register' },
        },
      } as APIGatewayProxyEventV2;
      
      return await adminHandler(proxiedEvent);
    }

    console.log(`❌ [AUTH] ${method} ${path} - Ruta no encontrada`);
    return errorResponse('Not found', 404);

  } catch (error: any) {
    console.error(`❌ [AUTH] Critical Error:`, error.message);
    logger.error('Error in auth handler', error);
    return internalErrorResponse('Internal server error');
  }
}