import {
    ChangePasswordCommand,
    CognitoIdentityProviderClient,
    ConfirmForgotPasswordCommand,
    ForgotPasswordCommand,
    InitiateAuthCommand,
    SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { requireAuth } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import {
    errorResponse,
    internalErrorResponse,
    notFoundResponse,
    successResponse,
    unauthorizedResponse,
} from '../shared/response';
import { validatePayloadSize } from '../shared/security';
import {
    changePasswordSchema,
    forgotPasswordSchema,
    loginSchema,
    parseBody,
    refreshTokenSchema,
    registerSchema,
    resetPasswordSchema,
} from '../shared/validators';

// --- CONFIGURACIÓN ---
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_USER_POOL_CLIENT_ID || '';

// --- HELPERS ---

/**
 * Helper para obtener User-Agent del evento
 */
const getDeviceInfo = (event: APIGatewayProxyEventV2): string => {
  return event.headers['user-agent'] || event.headers['User-Agent'] || 'Unknown Device';
};

/**
 * Genera un JWT real para desarrollo local
 */
function generateLocalJWT(payload: { sub: string; email: string; role: string | null }): string {
  const header = { alg: 'HS256', typ: 'JWT' };

  const base64UrlEncode = (str: string): string => {
    return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const now = Math.floor(Date.now() / 1000);
  
  const jwtPayload = {
    sub: payload.sub,
    userId: payload.sub,
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

function mapRoleToEnum(role: string): enum_roles {
  const roleMap: Record<string, enum_roles> = {
    'PATIENT': enum_roles.patient,
    'DOCTOR': enum_roles.provider,
    'PHARMACY': enum_roles.provider,
    'LABORATORY': enum_roles.provider,
    'AMBULANCE': enum_roles.provider,
    'patient': enum_roles.patient,
    'doctor': enum_roles.provider,
    'provider': enum_roles.provider,
    'admin': enum_roles.admin,
    'user': enum_roles.user,
  };
  return roleMap[role.toUpperCase()] || roleMap[role.toLowerCase()] || enum_roles.patient;
}

// --- CONTROLLERS ---

export async function register(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    console.log('📝 [REGISTER] Procesando registro de usuario');
    validatePayloadSize(event);
    const body = parseBody(event.body, registerSchema);
    const prisma = getPrismaClient();

    // Registrar en Cognito
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        { Name: 'email', Value: body.email },
        ...(body.phone ? [{ Name: 'phone_number', Value: body.phone }] : []),
        ...(body.firstName ? [{ Name: 'given_name', Value: body.firstName }] : []),
        ...(body.lastName ? [{ Name: 'family_name', Value: body.lastName }] : []),
      ],
    });

    const cognitoResponse = await cognitoClient.send(signUpCommand);

    // Crear usuario en DB
    const user = await prisma.users.create({
      data: {
        id: cognitoResponse.UserSub || randomUUID(),
        email: body.email,
        password_hash: '', 
        role: body.role ? mapRoleToEnum(body.role) : enum_roles.patient,
      },
    });

    console.log('✅ [REGISTER] Usuario registrado exitosamente:', user.email);
    return successResponse({
      userId: user.id,
      email: user.email,
      message: 'User registered successfully. Please confirm your email.',
    }, 201);
  } catch (error: any) {
    console.error('❌ [REGISTER] Error al registrar usuario:', error.message);
    logger.error('Error in register', error);
    if (error.message.includes('Validation error')) return errorResponse(error.message, 400);
    if (error.name === 'UsernameExistsException') return errorResponse('User already exists', 409);
    return internalErrorResponse('Failed to register user');
  }
}

export async function login(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    console.log('🔐 [LOGIN] Procesando inicio de sesión');
    const body = parseBody(event.body, loginSchema);
    const isLocalDev = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !CLIENT_ID || !USER_POOL_ID;

    // --- MODO DESARROLLO / FALLBACK LOCAL ---
    if (isLocalDev) {
      console.log('🔧 [LOGIN] Modo desarrollo local - Autenticación directa contra BD');
      const prisma = getPrismaClient();
      
      const user = await prisma.users.findFirst({ where: { email: body.email } });

      if (!user) {
        console.error('❌ [LOGIN] Usuario no encontrado:', body.email);
        return unauthorizedResponse('Invalid credentials');
      }

      // Verificaciones de estado y contraseña
      const isProduction = process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production';
      const isDevelopment = !isProduction;
      
      if (!user.is_active && !isDevelopment) return unauthorizedResponse('User account is inactive');
      if (!user.password_hash) return unauthorizedResponse('Invalid credentials');

      const passwordMatch = await bcrypt.compare(body.password, user.password_hash);
      
      if (!passwordMatch) {
        console.error('❌ [LOGIN] Contraseña incorrecta');
        return unauthorizedResponse('Invalid credentials');
      }

      // Obtener info del provider
      let providerInfo = null;
      let serviceType = null;
      
      if (user.role === enum_roles.provider) {
        const clinic = await prisma.clinics.findFirst({
          where: { user_id: user.id },
          select: { id: true, name: true, logo_url: true },
        });

        if (clinic) {
          providerInfo = { id: clinic.id, commercialName: clinic.name, logoUrl: clinic.logo_url };
          serviceType = 'clinic';
        } else {
          const provider = await prisma.providers.findFirst({
            where: { user_id: user.id },
            include: { service_categories: { select: { slug: true, name: true } } },
          });
          
          if (provider) {
            providerInfo = { id: provider.id, commercialName: provider.commercial_name, logoUrl: provider.logo_url };
            serviceType = provider.service_categories?.slug || null;
          }
        }
      }

      const jwtToken = generateLocalJWT({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      // ============================================================
      // 🚀 GESTIÓN DE SESIONES PROFESIONAL 
      // ============================================================
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hora de validez

        // 1. Guardar nueva sesión
        await prisma.sessions.create({
          data: {
            id: randomUUID(),
            user_id: user.id,
            token: jwtToken,
            device_info: getDeviceInfo(event),
            expires_at: expiresAt,
          },
        });
        console.log('✅ [LOGIN] Sesión guardada en DB');

        // 2. MANTENIMIENTO AUTOMÁTICO (Fire & Forget)
        // Borramos sesiones que expiraron hace más de 30 días para no saturar la BD
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        prisma.sessions.deleteMany({
          where: {
            expires_at: { lt: thirtyDaysAgo }
          }
        }).catch(err => console.error('⚠️ [LOGIN] Error en limpieza de sesiones viejas:', err));

      } catch (sessionError) {
        console.error('❌ [LOGIN] Error guardando sesión (no bloqueante):', sessionError);
      }
      // ============================================================

      // Normalización para el Frontend
      const normalizedRole = user.role ? String(user.role).toLowerCase() : 'patient';
      const normalizedServiceType = serviceType ? String(serviceType).toLowerCase() : null;
      
      const responseData: any = {
        token: jwtToken,
        accessToken: jwtToken,
        refreshToken: jwtToken,
        idToken: jwtToken,
        expiresIn: 3600,
        user: {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: normalizedRole,
          profilePictureUrl: user.profile_picture_url,
        },
      };

      if (providerInfo) {
        responseData.user.name = providerInfo.commercialName;
        responseData.user.provider = providerInfo;
      }

      // IMPORTANTE: Mapeo de tipos para los Guards del Frontend
      if (normalizedServiceType) {
        responseData.user.serviceType = normalizedServiceType;
        responseData.user.tipo = normalizedServiceType; 
      }

      return successResponse(responseData);
    }

    // --- MODO PRODUCCIÓN (COGNITO) ---
    console.log('🔐 [LOGIN] Autenticando con Cognito');
    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: body.email, PASSWORD: body.password },
    });

    const response = await cognitoClient.send(authCommand);
    return successResponse({
      accessToken: response.AuthenticationResult?.AccessToken,
      refreshToken: response.AuthenticationResult?.RefreshToken,
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });

  } catch (error: any) {
    console.error('❌ [LOGIN] Error:', error.message);
    if (error.name === 'NotAuthorizedException') return unauthorizedResponse('Invalid credentials');
    return internalErrorResponse('Failed to login');
  }
}

//  LOGOUT: MARCAR COMO REVOCADO
export async function logout(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const token = event.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const prisma = getPrismaClient();
      
      // Soft Delete: Marcamos revocada con la fecha actual
      await prisma.sessions.updateMany({
        where: { token: token },
        data: { revoked_at: new Date() }
      });
      
      console.log('👋 [LOGOUT] Sesión revocada exitosamente');
    }

    return successResponse({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout', error);
    // Respondemos éxito igual para no romper el frontend
    return successResponse({ message: 'Logged out' }); 
  }
}

export async function refresh(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    console.log('🔄 [REFRESH] Procesando refresh token');
    const body = parseBody(event.body, refreshTokenSchema);
    const refreshToken = body.refreshToken;
    const isLocalDev = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !CLIENT_ID || !USER_POOL_ID;

    if (isLocalDev) {
      
      const parts = refreshToken.split('.');
      if (parts.length !== 3) return unauthorizedResponse('Invalid refresh token format');
      
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
      const decoded = JSON.parse(jsonPayload);

      const prisma = getPrismaClient();
      const user = await prisma.users.findFirst({
        where: { OR: [{ id: decoded.sub }, { email: decoded.email }] },
      });

      if (!user) return unauthorizedResponse('User not found');

      // Regenerar tokens
      const normalizedRole = user.role ? String(user.role).toLowerCase() : 'patient';
      const newToken = generateLocalJWT({ sub: user.id, email: user.email, role: user.role });

      // Buscar provider info nuevamente para la respuesta
      let serviceType = null;
      if (user.role === enum_roles.provider) {
         const provider = await prisma.providers.findFirst({
            where: { user_id: user.id },
            include: { service_categories: { select: { slug: true } } }
         });
         if (provider) serviceType = provider.service_categories?.slug;
      }
      const normalizedServiceType = serviceType ? String(serviceType).toLowerCase() : null;

      const responseData: any = {
        token: newToken,
        accessToken: newToken,
        refreshToken: newToken,
        user: {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: normalizedRole,
        }
      };
      
      if (normalizedServiceType) {
          responseData.user.serviceType = normalizedServiceType;
          responseData.user.tipo = normalizedServiceType;
      }

      return successResponse(responseData);
    }

    // Cognito Refresh
    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });
    const response = await cognitoClient.send(authCommand);
    return successResponse({
      accessToken: response.AuthenticationResult?.AccessToken,
      refreshToken: refreshToken,
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });

  } catch (error: any) {
    logger.error('Error in refresh', error);
    return internalErrorResponse('Failed to refresh token');
  }
}

export async function me(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('👤 [ME] Obteniendo info usuario');
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) return authResult;

  const prisma = getPrismaClient();
  const user = await prisma.users.findUnique({
    where: { id: authResult.user.id },
    select: { id: true, email: true, role: true, profile_picture_url: true, is_active: true, created_at: true },
  });

  if (!user) return notFoundResponse('User not found');

  const normalizedRole = user.role ? String(user.role).toLowerCase() : 'patient';
  const responseData: any = {
    id: user.id,
    userId: user.id,
    email: user.email,
    role: normalizedRole,
    profilePictureUrl: user.profile_picture_url,
    isActive: user.is_active,
    createdAt: user.created_at,
  };

  if (user.role === enum_roles.provider) {
    const provider = await prisma.providers.findFirst({
      where: { user_id: user.id },
      include: { service_categories: { select: { slug: true, name: true } } },
    });

    if (provider) {
      const serviceType = provider.service_categories?.slug || null;
      const normalizedServiceType = serviceType ? String(serviceType).toLowerCase() : null;

      if (normalizedServiceType) {
        responseData.serviceType = normalizedServiceType;
        responseData.tipo = normalizedServiceType;
      }
      responseData.name = provider.commercial_name;
      responseData.provider = {
        id: provider.id,
        commercialName: provider.commercial_name,
        logoUrl: provider.logo_url,
      };
    }
  }

  return successResponse(responseData);
}

export async function changePassword(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) return authResult;

  try {
    const body = parseBody(event.body, changePasswordSchema);
    const cmd = new ChangePasswordCommand({
      AccessToken: event.headers.authorization?.replace('Bearer ', '') || '',
      PreviousPassword: body.currentPassword,
      ProposedPassword: body.newPassword,
    });
    await cognitoClient.send(cmd);
    return successResponse({ message: 'Password changed successfully' });
  } catch (error: any) {
    logger.error('Error in changePassword', error);
    return internalErrorResponse('Failed to change password');
  }
}

export async function forgotPassword(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event.body, forgotPasswordSchema);
    const cmd = new ForgotPasswordCommand({ ClientId: CLIENT_ID, Username: body.email });
    await cognitoClient.send(cmd);
    return successResponse({ message: 'Password reset code sent' });
  } catch (error: any) {
    return successResponse({ message: 'If the email exists, a reset code has been sent' });
  }
}

export async function resetPassword(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event.body, resetPasswordSchema);
    const cmd = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: body.email,
      ConfirmationCode: body.code,
      Password: body.newPassword,
    });
    await cognitoClient.send(cmd);
    return successResponse({ message: 'Password reset successfully' });
  } catch (error: any) {
    if (error.name === 'CodeMismatchException') return errorResponse('Invalid verification code', 400);
    return internalErrorResponse('Failed to reset password');
  }
}