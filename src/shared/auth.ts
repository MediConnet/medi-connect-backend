import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { getPrismaClient } from './prisma';
import { users, enum_roles } from '../generated/prisma/client';
import { unauthorizedResponse, forbiddenResponse } from './response';
import { APIGatewayProxyResult } from 'aws-lambda';

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
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Extrae claims del JWT (API Gateway ya lo valida, solo extraemos)
 * En producción, API Gateway JWT Authorizer valida el token antes de llegar a Lambda
 */
export function getJWTClaims(event: APIGatewayProxyEventV2): JWTClaims | null {
  // API Gateway HTTP API v2 pasa los claims en requestContext.authorizer.jwt.claims
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims) {
    return null;
  }
  return claims as JWTClaims;
}

/**
 * Obtiene el contexto de autenticación (cognitoUserId + User de DB)
 */
export async function getAuthContext(
  event: APIGatewayProxyEventV2
): Promise<AuthContext | null> {
  const claims = getJWTClaims(event);
  if (!claims || !claims.sub) {
    return null;
  }

  const prisma = getPrismaClient();
  const user = await prisma.users.findFirst({
    where: { email: claims.email || undefined },
  });

  if (!user || !user.is_active) {
    return null;
  }

  return {
    cognitoUserId: claims.sub,
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
  const authContext = await getAuthContext(event);
  if (!authContext) {
    return unauthorizedResponse('Authentication required');
  }
  return authContext;
}

/**
 * Middleware para verificar rol específico
 */
export async function requireRole(
  event: APIGatewayProxyEventV2,
  allowedRoles: enum_roles[]
): Promise<AuthContext | APIGatewayProxyResult> {
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  if (!allowedRoles.includes(authContext.user.role)) {
    return forbiddenResponse(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }

  return authContext;
}
