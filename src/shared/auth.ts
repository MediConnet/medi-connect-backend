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
  console.log('✅ [EXTRACT_JWT] Token extraído. Longitud:', token.length, 'Primeros 30 chars:', token.substring(0, 30) + '...');
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

  // Fallback para desarrollo local: validar JWT manualmente o token simple
  const isLocalDev = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !process.env.COGNITO_USER_POOL_ID;
  
  if (isLocalDev) {
    const token = extractJWT(event);
    if (token) {
      try {
        console.log('🔧 [AUTH] Modo desarrollo local - Decodificando token');
        console.log('🔧 [AUTH] Longitud del token:', token.length);
        console.log('🔧 [AUTH] Primeros 30 caracteres:', token.substring(0, 30));
        
        // Intentar decodificar como token simple (base64 JSON)
        try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
          if (decoded.sub && decoded.email) {
            console.log('✅ [AUTH] Token simple decodificado. Email:', decoded.email);
            return decoded as JWTClaims;
          }
        } catch (e) {
          console.log('🔧 [AUTH] No es token simple base64, intentando JWT...');
        }

        // Decodificar JWT estándar (solo para desarrollo local)
        const parts = token.split('.');
        console.log('🔧 [AUTH] Partes del JWT:', parts.length);
        
        if (parts.length === 3) {
          try {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            
            // Agregar padding si es necesario
            const padding = base64.length % 4;
            const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
            
            const jsonPayload = Buffer.from(paddedBase64, 'base64').toString('utf-8');
            const decoded = JSON.parse(jsonPayload);
            console.log('✅ [AUTH] JWT decodificado exitosamente. Email:', decoded.email || decoded.sub);
            console.log('🔍 [AUTH] Claims decodificados:', JSON.stringify(decoded, null, 2).substring(0, 200));
            return decoded as JWTClaims;
          } catch (jwtError: any) {
            console.error('❌ [AUTH] Error decodificando JWT con método directo:', jwtError.message);
            // Intentar método alternativo (más compatible)
            try {
              const base64Url = parts[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const padding = base64.length % 4;
              const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
              
              const jsonPayload = decodeURIComponent(
                Buffer.from(paddedBase64, 'base64').toString().split('').map(c => {
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join('')
              );
              const decoded = JSON.parse(jsonPayload);
              console.log('✅ [AUTH] JWT decodificado con método alternativo. Email:', decoded.email || decoded.sub);
              return decoded as JWTClaims;
            } catch (altError: any) {
              console.error('❌ [AUTH] Error con método alternativo:', altError.message);
            }
          }
        } else {
          console.error('❌ [AUTH] Token no tiene formato JWT (3 partes). Partes encontradas:', parts.length);
          return null;
        }
      } catch (error: any) {
        console.error('❌ [AUTH] Error general decodificando token:', error.message);
        console.error('❌ [AUTH] Stack:', error.stack?.substring(0, 200));
        return null;
      }
    } else {
      console.log('❌ [AUTH] No se pudo extraer token del header');
    }
  }

  return null;
}

/**
 * Obtiene el contexto de autenticación (cognitoUserId + User de DB)
 */
export async function getAuthContext(
  event: APIGatewayProxyEventV2
): Promise<AuthContext | null> {
  const claims = getJWTClaims(event);
  const isLocalDev = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !process.env.COGNITO_USER_POOL_ID;
  
  // Si no hay claims, intentar autenticación directa en desarrollo local
  if (!claims && isLocalDev) {
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
export function generateJWT(payload: { userId: string; email: string; role: string | null }): string {
  const header = { alg: 'HS256', typ: 'JWT' };

  const base64UrlEncode = (str: string): string => {
    return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const now = Math.floor(Date.now() / 1000);
  
  const jwtPayload = {
    sub: payload.userId,
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    iat: now,
    exp: now + 3600, // 1 hora
  };
  
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  const secret = process.env.JWT_SECRET || 'local-dev-secret-key';
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}