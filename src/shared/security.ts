import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { errorResponse } from './response';

/**
 * Valida el tamaño del payload
 */
/**
 * Corta peticiones con un cuerpo demasiado grande.
 *
 * Solo se usa en el registro, y es a proposito: en el despliegue real (Express
 * sobre Render) el limite ya lo pone el body-parser en index.ts — 10 MB general,
 * 32 KB en las rutas publicas que solo llevan texto. Esta funcion existe para el
 * camino Lambda, donde no hay body-parser que lo haga, y para el registro, que
 * acepta multipart con documentos y necesita su propio tope.
 *
 * O sea: no esta "a medias". Repartirla por todos los controladores duplicaria
 * una comprobacion que la capa HTTP ya hace.
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
 * Freno a los intentos de inicio de sesion.
 *
 * Mismo criterio que "olvide mi contrasena": tras N fallos se bloquea durante
 * un rato y se responde 429 diciendo cuanto falta.
 *
 * Por que la clave es correo + IP y no solo una de las dos:
 *  - Solo por correo: cualquiera podria dejar fuera a otra persona a proposito,
 *    fallando a drede contra su cuenta hasta bloquearla.
 *  - Solo por IP: una oficina o una red movil comparten IP y se bloquearian
 *    entre si.
 * Con la combinacion, el que prueba contrasenas contra una cuenta se frena, y
 * un tercero no puede bloquear la cuenta de nadie. Ademas hay un tope mas
 * holgado por IP sola, para el que prueba muchas cuentas distintas desde el
 * mismo sitio.
 *
 * Limitacion conocida: el contador vive en memoria del proceso. Si el servicio
 * se reinicia, se pierde; y con varias instancias cada una lleva el suyo. Aun
 * asi encarece muchisimo un ataque por fuerza bruta. Para hacerlo duradero hay
 * que mover `intentosFallidos` a Redis o a una tabla.
 */
interface RegistroIntentos {
  fallos: number;
  bloqueadoHasta: number | null;
  ultimoIntento: number;
}

const intentosFallidos = new Map<string, RegistroIntentos>();

const MAX_FALLOS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const MINUTOS_BLOQUEO = Number(process.env.LOGIN_LOCK_MINUTES || 15);
/** Tope por IP para quien prueba contra muchas cuentas distintas. */
const MAX_FALLOS_POR_IP = Number(process.env.LOGIN_MAX_ATTEMPTS_PER_IP || 20);

/** La ventana se reinicia sola si el usuario deja de intentar un buen rato. */
const VENTANA_MS = MINUTOS_BLOQUEO * 60 * 1000;

function claveCuenta(email: string, ip: string): string {
  return `login:${email.trim().toLowerCase()}:${ip}`;
}

function claveIp(ip: string): string {
  return `login-ip:${ip}`;
}

function revisar(clave: string, maximo: number): { bloqueado: boolean; esperaSegundos: number } {
  const ahora = Date.now();
  const registro = intentosFallidos.get(clave);

  if (!registro) return { bloqueado: false, esperaSegundos: 0 };

  if (registro.bloqueadoHasta && ahora < registro.bloqueadoHasta) {
    return {
      bloqueado: true,
      esperaSegundos: Math.ceil((registro.bloqueadoHasta - ahora) / 1000),
    };
  }

  // Bloqueo cumplido o ventana vencida: se empieza de cero.
  if (registro.bloqueadoHasta || ahora - registro.ultimoIntento > VENTANA_MS) {
    intentosFallidos.delete(clave);
    return { bloqueado: false, esperaSegundos: 0 };
  }

  if (registro.fallos >= maximo) {
    return { bloqueado: true, esperaSegundos: MINUTOS_BLOQUEO * 60 };
  }

  return { bloqueado: false, esperaSegundos: 0 };
}

/** Se llama ANTES de comprobar la contrasena. */
export function comprobarIntentosLogin(
  email: string,
  ip: string,
): { bloqueado: boolean; esperaSegundos: number } {
  const porCuenta = revisar(claveCuenta(email, ip), MAX_FALLOS);
  if (porCuenta.bloqueado) return porCuenta;
  return revisar(claveIp(ip), MAX_FALLOS_POR_IP);
}

/** Se llama en cada credencial incorrecta. */
export function registrarIntentoFallido(email: string, ip: string): void {
  const ahora = Date.now();

  for (const [clave, maximo] of [
    [claveCuenta(email, ip), MAX_FALLOS] as const,
    [claveIp(ip), MAX_FALLOS_POR_IP] as const,
  ]) {
    const registro = intentosFallidos.get(clave);

    if (!registro || ahora - registro.ultimoIntento > VENTANA_MS) {
      intentosFallidos.set(clave, { fallos: 1, bloqueadoHasta: null, ultimoIntento: ahora });
      continue;
    }

    registro.fallos += 1;
    registro.ultimoIntento = ahora;
    if (registro.fallos >= maximo) {
      registro.bloqueadoHasta = ahora + MINUTOS_BLOQUEO * 60 * 1000;
    }
  }
}

/** Se llama al entrar bien: el contador se borra. */
export function limpiarIntentosLogin(email: string, ip: string): void {
  intentosFallidos.delete(claveCuenta(email, ip));
}

/**
 * Borra el bloqueo de una cuenta desde cualquier IP.
 *
 * Se llama al completar la recuperacion de contrasena. Quien llego hasta ahi
 * demostro que controla el correo —recibio el enlace— asi que no tiene sentido
 * dejarlo esperando el bloqueo: lo normal es que el usuario se bloquee por
 * olvidar su clave, la recupere, y quiera entrar enseguida con la nueva.
 *
 * No se toca el tope por IP: ese frena a quien prueba contra muchas cuentas, y
 * recuperar una contrasena no deberia limpiarlo.
 */
export function limpiarBloqueoPorCorreo(email: string): number {
  const prefijo = `login:${email.trim().toLowerCase()}:`;
  let borrados = 0;

  for (const clave of [...intentosFallidos.keys()]) {
    if (clave.startsWith(prefijo)) {
      intentosFallidos.delete(clave);
      borrados++;
    }
  }

  return borrados;
}

/** Saca la IP del cliente del evento, mirando primero las cabeceras de proxy. */
export function obtenerIpCliente(event: any): string {
  const cabeceras = event?.headers || {};
  const reenviada =
    cabeceras["x-forwarded-for"] ||
    cabeceras["X-Forwarded-For"] ||
    cabeceras["x-real-ip"];
  if (typeof reenviada === "string" && reenviada.trim()) {
    // x-forwarded-for llega como lista: "cliente, proxy1, proxy2".
    //
    // Se toma la ULTIMA, no la primera. La cabecera la puede falsificar quien
    // llama: si manda su propio x-forwarded-for, el proxy de Render le agrega
    // la IP real al final, de modo que lo que el cliente invento queda a la
    // izquierda. Quedarse con la primera habria permitido rotar IPs falsas y
    // saltarse el limite por IP; la ultima es la que puso nuestro proxy.
    //
    // Esto asume exactamente un proxy de confianza delante (el de Render). Si
    // algun dia se agrega otro, hay que descartar tantas entradas por la
    // derecha como proxies de confianza haya.
    const entradas = reenviada
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (entradas.length > 0) return entradas[entradas.length - 1];
  }
  return event?.requestContext?.http?.sourceIp || "desconocida";
}

/** Purga los registros vencidos para que el mapa no crezca sin control. */
export function limpiarIntentosVencidos(): void {
  const ahora = Date.now();
  for (const [clave, registro] of intentosFallidos.entries()) {
    const vencido =
      (registro.bloqueadoHasta && ahora > registro.bloqueadoHasta) ||
      ahora - registro.ultimoIntento > VENTANA_MS;
    if (vencido) intentosFallidos.delete(clave);
  }
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
