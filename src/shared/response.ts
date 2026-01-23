import { APIGatewayProxyResult } from 'aws-lambda';

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: any[];
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Obtiene el origen permitido para CORS (soporta múltiples orígenes)
 * Compatible con web apps y mobile apps
 * 
 * Nota: Apps móviles no envían origin header, pero esto es necesario para web apps
 */
function getAllowedOrigin(event?: APIGatewayProxyEventV2): string {
  // Si hay un evento, intentar obtener el origen del header
  if (event?.headers?.origin || event?.headers?.Origin) {
    const origin = event.headers.origin || event.headers.Origin || '';
    const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
    
    // Si '*' está permitido o el origen está en la lista, permitirlo
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return origin;
    }
  }
  // Fallback a variable de entorno o '*'
  return process.env.CORS_ORIGIN || process.env.CORS_ORIGINS?.split(',')[0]?.trim() || '*';
}

export function successResponse<T>(data: T, statusCode: number = 200, event?: APIGatewayProxyEventV2): APIGatewayProxyResult {
  const origin = getAllowedOrigin(event);
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,Accept',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      // Security headers (solo para web, apps móviles los ignoran)
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
    body: JSON.stringify({
      success: true,
      data,
    } as SuccessResponse<T>),
  };
}

export function errorResponse(
  message: string,
  statusCode: number = 400,
  errors?: any[],
  event?: APIGatewayProxyEventV2
): APIGatewayProxyResult {
  const origin = getAllowedOrigin(event);
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,Accept',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      // Security headers (solo para web, apps móviles los ignoran)
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
    body: JSON.stringify({
      success: false,
      message,
      ...(errors && { errors }),
    } as ErrorResponse),
  };
}

export function unauthorizedResponse(message: string = 'Unauthorized', event?: APIGatewayProxyEventV2): APIGatewayProxyResult {
  return errorResponse(message, 401, undefined, event);
}

export function forbiddenResponse(message: string = 'Forbidden', event?: APIGatewayProxyEventV2): APIGatewayProxyResult {
  return errorResponse(message, 403, undefined, event);
}

export function notFoundResponse(message: string = 'Not found', event?: APIGatewayProxyEventV2): APIGatewayProxyResult {
  return errorResponse(message, 404, undefined, event);
}

export function internalErrorResponse(
  message: string = 'Internal server error',
  event?: APIGatewayProxyEventV2
): APIGatewayProxyResult {
  return errorResponse(message, 500, undefined, event);
}

/**
 * Maneja preflight OPTIONS requests para CORS
 * Necesario para web apps, apps móviles no lo requieren
 */
export function optionsResponse(event?: APIGatewayProxyEventV2): APIGatewayProxyResult {
  const origin = getAllowedOrigin(event);
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,Accept',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  };
}
