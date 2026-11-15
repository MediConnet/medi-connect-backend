import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles, users } from '../generated/prisma/client';
import { getPrismaClient } from './prisma';
import { forbiddenResponse, unauthorizedResponse } from './response';
import * as crypto from 'crypto';

export interface AuthContext {
  cognitoUserId: string;
  user: users;
}

export interface JWTClaims {
  sub: string;
  email?: string;
  'cognito:groups'?: string[];
  [key: string]: any;
}

const JWT_SECRET_POR_DEFECTO = 'local-dev-secret-key';

/** Tipo de token. Va dentro del payload para que uno no sirva por el otro. */
export type TokenType = 'access' | 'refresh';

function getJwtSecret(): string {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) {
    console.warn(
      'ATENCION [AUTH] JWT_SECRET no esta configurado: se usa el secreto por defecto del codigo, que es publico. Configuralo en el entorno.',
    );
    return JWT_SECRET_POR_DEFECTO;
  }
  return secreto;
}

/**
 * Secreto de los refresh tokens. Si no esta configurado se usa el de acceso:
 * los dos tipos siguen sin confundirse porque el payload lleva `typ`, pero
 * conviene separarlos para que filtrar uno no comprometa al otro.
 */
function getRefreshSecret(): string {
  const secreto = process.env.JWT_REFRESH_SECRET;
  if (!secreto) {
    console.warn(
      'ATENCION [AUTH] JWT_REFRESH_SECRET no esta configurado: los refresh tokens se firman con JWT_SECRET.',
    );
    return getJwtSecret();
  }
  return secreto;
}

function secretoDe(tipo: TokenType): string {
  return tipo === 'refresh' ? getRefreshSecret() : getJwtSecret();
}

/**
 * Convierte "60m", "30d", "15m", "900s", "2h" a segundos.
 * Un valor vacio o que no se entienda cae al valor por defecto.
 */
export function parseDuracion(valor: string | undefined, porDefecto: number): number {
  if (!valor) return porDefecto;

  const m = valor.trim().match(/^(\d+)\s*([smhd])?$/i);
  if (!m) {
    console.warn(`ATENCION [AUTH] Duracion no reconocida: "${valor}". Se usan ${porDefecto}s.`);
    return porDefecto;
  }

  const cantidad = parseInt(m[1], 10);
  const unidad = (m[2] || 's').toLowerCase();
  const factores: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return cantidad * factores[unidad];
}

/** Vida del access token. 60 minutos por defecto. */
export const accessTokenTTL = (): number =>
  parseDuracion(process.env.JWT_ACCESS_TOKEN_EXPIRATION, 60 * 60);

/** Vida del refresh token. 30 dias por defecto. */
export const refreshTokenTTL = (): number =>
  parseDuracion(process.env.JWT_REFRESH_TOKEN_EXPIRATION, 30 * 24 * 60 * 60);

const base64UrlDesdeTexto = (str: string): string =>
  Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

export interface TokenPayload {
  userId: string;
  email: string;
  role: string | null;
}

/** Firma un token del tipo indicado. */
export function signToken(payload: TokenPayload, tipo: TokenType): string {
  const encodedHeader = base64UrlDesdeTexto(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const ttl = tipo === 'refresh' ? refreshTokenTTL() : accessTokenTTL();

  const encodedPayload = base64UrlDesdeTexto(
    JSON.stringify({
      sub: payload.userId,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      typ: tipo,
      iat: now,
      exp: now + ttl,
    }),
  );

  const firma = crypto
    .createHmac('sha256', secretoDe(tipo))
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${firma}`;
}

/** Par de tokens que se entrega al iniciar sesion o al refrescar. */
export function issueTokenPair(payload: TokenPayload) {
  return {
    accessToken: signToken(payload, 'access'),
    refreshToken: signToken(payload, 'refresh'),
    expiresIn: accessTokenTTL(),
    refreshExpiresIn: refreshTokenTTL(),
  };
}

const base64UrlDesdeBuffer = (b: Buffer): string =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/**
 * Verifica la FIRMA y la expiracion de uno de nuestros JWT.
 *
 * Antes esto no existia: getJWTClaims hacia base64-decode del payload y
 * confiaba en el. Como la firma no se comprobaba, cualquiera podia fabricar un
 * token con el sub/role que quisiera y entrar como cualquier usuario, admin
 * incluido. Los tokens siempre se firmaron (HMAC-SHA256); lo que faltaba era
 * comprobarlos al recibirlos.
 *
 * Mismo formato que generan generateLocalJWT (auth.controller) y generateJWT
 * (mas abajo en este archivo).
 */
export function verifyJWT(
  token: string,
  tipoEsperado: TokenType = 'access',
): JWTClaims | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    console.log('[AUTH] El token no tiene formato JWT (3 partes)');
    return null;
  }

  const [encodedHeader, encodedPayload, firmaRecibida] = partes;

  const firmaEsperada = base64UrlDesdeBuffer(
    crypto
      .createHmac('sha256', secretoDe(tipoEsperado))
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest(),
  );

  const a = Buffer.from(firmaRecibida);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.log('[AUTH] Firma del token invalida');
    return null;
  }

  let claims: JWTClaims;
  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    const conPadding = padding ? base64 + '='.repeat(4 - padding) : base64;
    claims = JSON.parse(Buffer.from(conPadding, 'base64').toString('utf-8'));
  } catch (error: any) {
    console.log('[AUTH] No se pudo leer el contenido del token:', error.message);
    return null;
  }

  if (!claims || !claims.sub) {
    console.log('[AUTH] El token no trae sub');
    return null;
  }

  if (typeof claims.exp === 'number' && Date.now() / 1000 > claims.exp) {
    console.log('[AUTH] Token expirado');
    return null;
  }

  // Un refresh token no sirve para pedir datos, ni un access token para
  // refrescar. Sin esta comprobacion, el refresh token (que vive 30 dias)
  // valdria como credencial de acceso y la vida corta del access no serviria
  // de nada.
  if (claims.typ !== tipoEsperado) {
    console.log(
      `[AUTH] Se esperaba un token de tipo ${tipoEsperado} y llego uno de tipo ${claims.typ || '(sin tipo)'}`,
    );
    return null;
  }

  return claims;
}

/**
 * Autenticacion por header X-User-Email / token-como-email, sin credenciales.
 *
 * Es una comodidad de desarrollo y hay que pedirla explicitamente. Antes se
 * activaba sola cuando faltaba COGNITO_USER_POOL_ID, que es justamente lo que
 * pasa en el despliegue de Render: bastaba mandar un header con el correo de
 * alguien para actuar como esa persona en produccion.
 */
function headerAuthHabilitado(): boolean {
  const esProduccion =
    process.env.NODE_ENV === 'production' || process.env.STAGE === 'prod';
  return !esProduccion && process.env.ALLOW_DEV_HEADER_AUTH === 'true';
}

/**
 * Extrae el JWT del header Authorization
 */
export function extractJWT(event: APIGatewayProxyEventV2): string | null {
  // Buscar en múltiples lugares posibles (case-insensitive)
  const authHeader = event.headers.authorization || 
                     event.headers.Authorization || 
                     event.headers['authorization'] || 
                     event.headers['Authorization'];
  
  if (!authHeader) {
    console.log('❌ [EXTRACT_JWT] No hay header Authorization');
    console.log('🔍 [EXTRACT_JWT] Headers disponibles:', Object.keys(event.headers).slice(0, 10).join(', '));
    return null;
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.log('❌ [EXTRACT_JWT] Header no empieza con "Bearer ":', authHeader.substring(0, 30) + '...');
    return null;
  }
  
  const token = authHeader.substring(7);
  return token;
}

/**
 * Extrae claims del JWT (API Gateway ya lo valida, solo extraemos)
 * En producción, API Gateway JWT Authorizer valida el token antes de llegar a Lambda
 * En desarrollo local, decodificamos el JWT manualmente
 */
export function getJWTClaims(event: APIGatewayProxyEventV2): JWTClaims | null {
  // Primero intentamos obtener claims de API Gateway (producción)
  const authorizer = (event.requestContext as any).authorizer;
  const claims = authorizer?.jwt?.claims;

  if (claims) {
    console.log('✅ [AUTH] Claims obtenidos de API Gateway');
    return claims as JWTClaims;
  }

  // Sin authorizer de API Gateway (el despliegue en Render es Express), el
  // token lo validamos aqui: firma y expiracion, siempre, en cualquier entorno.
  const token = extractJWT(event);
  if (!token) return null;

  return verifyJWT(token);
}

/**
 * Obtiene el contexto de autenticación (cognitoUserId + User de DB)
 */
export async function getAuthContext(
  event: APIGatewayProxyEventV2
): Promise<AuthContext | null> {
  const claims = getJWTClaims(event);
  
  // Si no hay claims, intentar autenticación directa en desarrollo local
  // Atajos sin credenciales: solo si se piden explicitamente, nunca en produccion.
  if (!claims && headerAuthHabilitado()) {
    console.log('🔧 [AUTH] Modo desarrollo local - Intentando autenticación directa');
    
    // Opción 1: Buscar por header X-User-Email (para testing)
    const email = event.headers['x-user-email'] || event.headers['X-User-Email'];
    if (email) {
      console.log(`🔧 [AUTH] Autenticación por header X-User-Email: ${email}`);
      const prisma = getPrismaClient();
      const user = await prisma.users.findFirst({
        where: { email: email as string },
      });
      
      // En desarrollo, permitir usuarios inactivos
      const isDevelopment = !(process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production');
      if (user && (user.is_active || isDevelopment)) {
        if (!user.is_active && isDevelopment) {
          console.log(`⚠️ [AUTH] Usuario inactivo pero permitido en desarrollo: ${user.email}`);
        }
        console.log(`✅ [AUTH] Usuario autenticado por header: ${user.email} (${user.role})`);
        return {
          cognitoUserId: user.id,
          user,
        };
      }
    }

    // Opción 2: Si hay token pero no se pudo decodificar, intentar buscar por token como email
    const token = extractJWT(event);
    if (token && token.includes('@')) {
      // Si el token parece un email, buscar directamente
      console.log(`🔧 [AUTH] Token parece ser email, buscando usuario: ${token}`);
      const prisma = getPrismaClient();
      const user = await prisma.users.findFirst({
        where: { email: token },
      });
      
      // En desarrollo, permitir usuarios inactivos
      const isDevelopment = !(process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production');
      if (user && (user.is_active || isDevelopment)) {
        if (!user.is_active && isDevelopment) {
          console.log(`⚠️ [AUTH] Usuario inactivo pero permitido en desarrollo: ${user.email}`);
        }
        console.log(`✅ [AUTH] Usuario autenticado por token-email: ${user.email} (${user.role})`);
        return {
          cognitoUserId: user.id,
          user,
        };
      }
    }

    console.log('❌ [AUTH] No se pudo autenticar en modo desarrollo local');
    return null;
  }

  if (!claims || !claims.sub) {
    console.log('❌ [AUTH] No hay claims válidos');
    return null;
  }

  const prisma = getPrismaClient();
  
  // Buscamos al usuario primero por ID (sub/userId) que es inmutable,
  // luego por email como fallback
  const userId = claims.userId || claims.sub;
  const userEmail = claims.email || 
                    claims['cognito:username'] || 
                    claims.username;
  
  let user;
  try {
    // Primero buscar por ID (más confiable, no cambia aunque el usuario actualice su email)
    if (userId) {
      console.log(`🔍 [AUTH] Buscando usuario por userId/sub: ${userId}`);
      user = await prisma.users.findUnique({
        where: { id: String(userId) },
      });
    }
    
    // Si no encontró por ID, intentar por email como fallback
    if (!user && userEmail) {
      console.log(`🔍 [AUTH] Buscando usuario por email: ${userEmail}`);
      user = await prisma.users.findFirst({
        where: { email: String(userEmail) },
      });
    }
  } catch (err: any) {
    // Evitar 500 por errores intermitentes/consulta: tratamos como no autenticado
    console.error('❌ [AUTH] Error consultando usuario en DB:', err?.message);
    if (err?.code) console.error('❌ [AUTH] Prisma code:', err.code);
    if (err?.meta) console.error('❌ [AUTH] Prisma meta:', JSON.stringify(err.meta));
    return null;
  }
  
  if (!userId && !userEmail) {
    console.log('❌ [AUTH] No hay email, userId ni sub en los claims');
    console.log('🔍 [AUTH] Claims disponibles:', Object.keys(claims).join(', '));
    return null;
  }

  if (!user) {
    console.log(`❌ [AUTH] Usuario no encontrado. userId: ${userId}, email: ${userEmail}`);
    return null;
  }

  // En desarrollo, permitir usuarios inactivos
  const isDevelopment = !(process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production');
  if (!user.is_active && !isDevelopment) {
    console.log(`❌ [AUTH] Usuario inactivo (modo producción): ${userEmail}`);
    return null;
  }
  
  if (!user.is_active && isDevelopment) {
    console.log(`⚠️ [AUTH] Usuario inactivo pero permitido en desarrollo: ${userEmail}`);
  }

  console.log(`✅ [AUTH] Usuario autenticado: ${user.email} (${user.role})`);
  return {
    cognitoUserId: claims.sub || user.id,
    user,
  };
}

/**
 * Middleware para verificar autenticación
 * Retorna el AuthContext o una respuesta de error
 */
export async function requireAuth(
  event: APIGatewayProxyEventV2
): Promise<AuthContext | APIGatewayProxyResult> {
  console.log('🔐 [REQUIRE_AUTH] Verificando autenticación...');
  const authContext = await getAuthContext(event);
  if (!authContext) {
    console.error('❌ [REQUIRE_AUTH] Autenticación fallida - No se pudo obtener contexto');
    return unauthorizedResponse('Authentication required');
  }
  console.log(`✅ [REQUIRE_AUTH] Usuario autenticado: ${authContext.user.email} (${authContext.user.role})`);
  return authContext;
}

/**
 * Middleware para verificar rol específico
 */
export async function requireRole(
  event: APIGatewayProxyEventV2,
  allowedRoles: enum_roles[]
): Promise<AuthContext | APIGatewayProxyResult> {
  console.log(`🔐 [REQUIRE_ROLE] Verificando rol. Roles permitidos: ${allowedRoles.join(', ')}`);
  const authResult = await requireAuth(event);
  
  // Si requireAuth devolvió un error (APIGatewayProxyResult), lo retornamos
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;

  // Verificamos que el rol no sea null antes de chequear si está permitido
  if (!authContext.user.role || !allowedRoles.includes(authContext.user.role)) {
    console.error(`❌ [REQUIRE_ROLE] Acceso denegado. Usuario: ${authContext.user.email}, Rol: ${authContext.user.role}, Requerido: ${allowedRoles.join(', ')}`);
    return forbiddenResponse(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }

  console.log(`✅ [REQUIRE_ROLE] Rol verificado correctamente: ${authContext.user.role}`);
  return authContext;
}

/**
 * Genera un JWT token para desarrollo local
 */
/**
 * Compatibilidad: emite un access token. Se mantiene porque lo usan los
 * controladores de invitaciones.
 */
export function generateJWT(payload: TokenPayload): string {
  return signToken(payload, 'access');
}