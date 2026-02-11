import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { errorResponse } from './response';

/**
 * Valida el tamaño del payload
 */
export function validatePayloadSize(
  event: APIGatewayProxyEventV2,
  maxBytes: number = 100000,
): void {
  if (!event.body) return;

  const isBase64 = Boolean((event as any).isBase64Encoded);
  const bytes = isBase64
    ? Buffer.byteLength(event.body, 'base64')
    : Buffer.byteLength(event.body, 'utf8');

  if (bytes > maxBytes) {
    throw new Error('Payload too large');
  }
}

/**
 * Sanitiza strings para prevenir XSS básico
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Valida y sanitiza query parameters
 */
export function sanitizeQueryParams(params: Record<string, string | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      // Solo sanitizar si es string, no números
      sanitized[key] = isNaN(Number(value)) ? sanitizeString(value) : value;
    }
  }
  return sanitized;
}

/**
 * Valida límites de paginación
 */
export function validatePagination(limit?: string, offset?: string): { limit: number; offset: number } {
  const parsedLimit = limit ? parseInt(limit, 10) : 50;
  const parsedOffset = offset ? parseInt(offset, 10) : 0;

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  if (isNaN(parsedOffset) || parsedOffset < 0) {
    throw new Error('Offset must be >= 0');
  }

  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Rate limiting helper (básico - para producción usar AWS WAF)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Limpia el rate limit map periódicamente (en producción usar Redis/ElastiCache)
 */
export function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}
