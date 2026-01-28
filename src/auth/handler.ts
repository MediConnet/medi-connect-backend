import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminGetUserCommand,
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getPrismaClient } from '../shared/prisma';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
  notFoundResponse,
} from '../shared/response';
import { logger } from '../shared/logger';
import { requireAuth } from '../shared/auth';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  parseBody,
} from '../shared/validators';
import { validatePayloadSize } from '../shared/security';
import { enum_roles } from '../generated/prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Genera un JWT real para desarrollo local
 * Formato: header.payload.signature
 */
function generateLocalJWT(payload: {
  sub: string;
  email: string;
  role: string | null;
}): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Función para codificar en base64url (sin padding, con caracteres seguros)
  const base64UrlEncode = (str: string): string => {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  
  // Agregar timestamps estándar de JWT y userId para compatibilidad con frontend
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    sub: payload.sub,           // Para compatibilidad con Cognito
    userId: payload.sub,         // Para compatibilidad con frontend
    email: payload.email,
    role: payload.role,
    iat: now,
    exp: now + 3600, // 1 hora de expiración
  };
  
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));

  // En desarrollo local, usamos una firma simple (no verificamos en producción)
  // En producción, Cognito genera la firma real
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

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.COGNITO_USER_POOL_CLIENT_ID || '';

// Router simple basado en path + method
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Auth handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    const { optionsResponse } = await import('../shared/response');
    return optionsResponse(event);
  }

  try {
    // POST /api/auth/register
    if (method === 'POST' && path === '/api/auth/register') {
      console.log('✅ [AUTH] POST /api/auth/register - Iniciando registro');
      const result = await register(event);
      console.log(`✅ [AUTH] POST /api/auth/register - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      console.log('✅ [AUTH] POST /api/auth/login - Iniciando login');
      const result = await login(event);
      console.log(`✅ [AUTH] POST /api/auth/login - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/auth/refresh
    if (method === 'POST' && path === '/api/auth/refresh') {
      console.log('✅ [AUTH] POST /api/auth/refresh - Iniciando refresh token');
      const result = await refresh(event);
      console.log(`✅ [AUTH] POST /api/auth/refresh - Completado con status ${result.statusCode}`);
      return result;
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      console.log('✅ [AUTH] GET /api/auth/me - Obteniendo usuario actual');
      const result = await me(event);
      console.log(`✅ [AUTH] GET /api/auth/me - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/auth/change-password
    if (method === 'POST' && path === '/api/auth/change-password') {
      console.log('✅ [AUTH] POST /api/auth/change-password - Cambiando contraseña');
      const result = await changePassword(event);
      console.log(`✅ [AUTH] POST /api/auth/change-password - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/auth/forgot-password
    if (method === 'POST' && path === '/api/auth/forgot-password') {
      console.log('✅ [AUTH] POST /api/auth/forgot-password - Solicitud de recuperación');
      const result = await forgotPassword(event);
      console.log(`✅ [AUTH] POST /api/auth/forgot-password - Completado con status ${result.statusCode}`);
      return result;
    }

    // POST /api/auth/reset-password
    if (method === 'POST' && path === '/api/auth/reset-password') {
      console.log('✅ [AUTH] POST /api/auth/reset-password - Reseteando contraseña');
      const result = await resetPassword(event);
      console.log(`✅ [AUTH] POST /api/auth/reset-password - Completado con status ${result.statusCode}`);
      return result;
    }

    console.log(`❌ [AUTH] ${method} ${path} - Ruta no encontrada (404)`);
    return errorResponse('Not found', 404);
  } catch (error: any) {
    console.error(`❌ [AUTH] ${method} ${path} - Error:`, error.message);
    logger.error('Error in auth handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function register(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
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
        password_hash: '', // Se maneja en Cognito
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
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    if (error.name === 'UsernameExistsException') {
      return errorResponse('User already exists', 409);
    }
    return internalErrorResponse('Failed to register user');
  }
}

async function login(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    console.log('🔐 [LOGIN] Procesando inicio de sesión');
    const body = parseBody(event.body, loginSchema);
    const isLocalDev = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !CLIENT_ID || !USER_POOL_ID;

    // Si Cognito no está configurado o estamos en desarrollo local, usar autenticación directa
    if (isLocalDev) {
      console.log('🔧 [LOGIN] Modo desarrollo local - Autenticación directa contra BD');
      console.log('📧 [LOGIN] Email recibido:', body.email);
      console.log('🔑 [LOGIN] Password recibido (longitud):', body.password ? body.password.length : 0);
      const prisma = getPrismaClient();
      
      const user = await prisma.users.findFirst({
        where: { email: body.email },
      });

      if (!user) {
        console.error('❌ [LOGIN] Usuario no encontrado:', body.email);
        console.error('🔍 [LOGIN] Verificando si existe otro usuario con email similar...');
        const allUsers = await prisma.users.findMany({
          select: { email: true, role: true },
          take: 5,
        });
        console.error('📋 [LOGIN] Primeros 5 usuarios en BD:', allUsers.map(u => ({ email: u.email, role: u.role })));
        return unauthorizedResponse('Invalid credentials');
      }

      console.log('✅ [LOGIN] Usuario encontrado:', {
        id: user.id,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        has_password_hash: !!user.password_hash,
        password_hash_length: user.password_hash ? user.password_hash.length : 0,
      });

      // En desarrollo, permitir login aunque el usuario esté inactivo
      // En producción, requerir que el usuario esté activo
      // Por defecto, asumir desarrollo si no está explícitamente en producción
      const isProduction = process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production';
      const isDevelopment = !isProduction; // Si no es producción, es desarrollo
      
      console.log(`🔍 [LOGIN] Verificando estado de usuario:`, {
        is_active: user.is_active,
        STAGE: process.env.STAGE || 'no configurado',
        NODE_ENV: process.env.NODE_ENV || 'no configurado',
        isProduction: isProduction,
        isDevelopment: isDevelopment,
      });
      
      if (!user.is_active && !isDevelopment) {
        console.error('❌ [LOGIN] Usuario inactivo (modo producción):', body.email);
        return unauthorizedResponse('User account is inactive');
      }
      
      if (!user.is_active && isDevelopment) {
        console.log('⚠️ [LOGIN] Usuario inactivo pero permitido en desarrollo:', body.email);
      }

      // Verificar contraseña
      if (!user.password_hash) {
        console.error('❌ [LOGIN] Usuario sin contraseña hash:', body.email);
        console.error('💡 [LOGIN] Sugerencia: Ejecuta "npm run seed" para crear usuarios con contraseñas');
        return unauthorizedResponse('Invalid credentials');
      }

      console.log('🔐 [LOGIN] Comparando contraseña...');
      const passwordMatch = await bcrypt.compare(body.password, user.password_hash);
      console.log('🔐 [LOGIN] Resultado de comparación:', passwordMatch ? '✅ COINCIDE' : '❌ NO COINCIDE');
      
      if (!passwordMatch) {
        console.error('❌ [LOGIN] Contraseña incorrecta para:', body.email);
        console.error('💡 [LOGIN] Credenciales correctas según seed:');
        console.error('   - Admin: admin@medicones.com / admin123');
        console.error('   - Doctor: doctor@medicones.com / doctor123');
        console.error('   - Farmacia: farmacia@medicones.com / farmacia123');
        return unauthorizedResponse('Invalid credentials');
      }

      // Obtener información adicional del provider si es un provider
      let providerInfo = null;
      let serviceType = null;
      
      if (user.role === enum_roles.provider) {
        // Verificar primero si es una clínica (tiene registro en tabla clinics)
        const clinic = await prisma.clinics.findFirst({
          where: { user_id: user.id },
          select: {
            id: true,
            name: true,
            logo_url: true,
          },
        });

        if (clinic) {
          // Es una clínica
          providerInfo = {
            id: clinic.id,
            commercialName: clinic.name,
            logoUrl: clinic.logo_url,
          };
          serviceType = 'clinic';
          console.log('🏥 [LOGIN] Usuario identificado como CLÍNICA');
        } else {
          // Es otro tipo de provider (doctor, farmacia, etc.)
          const provider = await prisma.providers.findFirst({
            where: { user_id: user.id },
            include: {
              service_categories: {
                select: {
                  slug: true,
                  name: true,
                },
              },
            },
          });
          
          if (provider) {
            providerInfo = {
              id: provider.id,
              commercialName: provider.commercial_name,
              logoUrl: provider.logo_url,
            };
            serviceType = provider.service_categories?.slug || null;
            console.log(`🏷️ [LOGIN] Provider identificado como: ${serviceType || 'SIN CATEGORÍA'}`);
          }
        }
      }

      // Generar un JWT real para desarrollo local
      const jwtToken = generateLocalJWT({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      console.log('✅ [LOGIN] Inicio de sesión exitoso (local):', body.email);
      console.log('🔑 [LOGIN] JWT generado (primeros 50 chars):', jwtToken.substring(0, 50) + '...');
      
      // Normalizar role a string en minúsculas para compatibilidad con frontend
      const normalizedRole = user.role ? String(user.role).toLowerCase() : 'patient';
      
      // Normalizar serviceType a minúsculas si existe
      const normalizedServiceType = serviceType ? String(serviceType).toLowerCase() : null;
      
      console.log('🔍 [LOGIN] Valores normalizados:', {
        roleOriginal: user.role,
        roleNormalizado: normalizedRole,
        serviceTypeOriginal: serviceType,
        serviceTypeNormalizado: normalizedServiceType,
      });
      
      // Construir respuesta con información completa
      const responseData: any = {
        token: jwtToken, // Campo 'token' para compatibilidad con frontend
        accessToken: jwtToken,
        refreshToken: jwtToken, // En local, ambos son iguales
        idToken: jwtToken,
        expiresIn: 3600, // 1 hora
        user: {
          id: user.id,
          userId: user.id, // También incluir userId para compatibilidad
          email: user.email,
          role: normalizedRole, // Role normalizado a minúsculas
          profilePictureUrl: user.profile_picture_url,
        },
      };

      // Agregar información del provider si existe
      if (providerInfo) {
        responseData.user.name = providerInfo.commercialName;
        responseData.user.provider = providerInfo;
      }

      // Agregar serviceType y tipo normalizados si es provider
      // ⚠️ CRÍTICO: El frontend espera 'tipo' porque los guards verifican user?.tipo
      if (normalizedServiceType) {
        responseData.user.serviceType = normalizedServiceType;
        // El frontend también necesita 'tipo' para los guards (DoctorRoute, LaboratoryRoute, etc.)
        responseData.user.tipo = normalizedServiceType;
        console.log('🏷️ [LOGIN] ServiceType y tipo normalizados:', normalizedServiceType);
      } else if (user.role === enum_roles.provider) {
        console.warn('⚠️ [LOGIN] Provider sin serviceType. Verificar categoría asignada.');
      }

      console.log('📤 [LOGIN] Respuesta completa del login:', JSON.stringify({
        token: responseData.token.substring(0, 30) + '...',
        accessToken: responseData.accessToken.substring(0, 30) + '...',
        user: {
          ...responseData.user,
          role: responseData.user.role,
          serviceType: responseData.user.serviceType || 'NO DEFINIDO',
          tipo: responseData.user.tipo || 'NO DEFINIDO',
        },
      }, null, 2));

      return successResponse(responseData);
    }

    // Autenticación con Cognito (producción)
    console.log('🔐 [LOGIN] Autenticando con Cognito');
    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
    });

    const response = await cognitoClient.send(authCommand);

    console.log('✅ [LOGIN] Inicio de sesión exitoso (Cognito):', body.email);
    return successResponse({
      accessToken: response.AuthenticationResult?.AccessToken,
      refreshToken: response.AuthenticationResult?.RefreshToken,
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });
  } catch (error: any) {
    console.error('❌ [LOGIN] Error al iniciar sesión:', error.message);
    logger.error('Error in login', error);
    
    // Si falla Cognito y estamos en desarrollo local, intentar autenticación directa
    const isLocalDev = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !CLIENT_ID || !USER_POOL_ID;
    if (isLocalDev && (error.name === 'NotAuthorizedException' || error.name === 'ResourceNotFoundException')) {
      console.log('🔧 [LOGIN] Cognito falló, intentando autenticación directa');
      const body = parseBody(event.body, loginSchema);
      const prisma = getPrismaClient();
      
      const user = await prisma.users.findFirst({
        where: { email: body.email },
      });

      if (user && user.password_hash && user.is_active) {
        const passwordMatch = await bcrypt.compare(body.password, user.password_hash);
        if (passwordMatch) {
          // Obtener información adicional del provider si es un provider
          let providerInfo = null;
          let serviceType = null;
          
          if (user.role === enum_roles.provider) {
            const provider = await prisma.providers.findFirst({
              where: { user_id: user.id },
              include: {
                service_categories: {
                  select: {
                    slug: true,
                    name: true,
                  },
                },
              },
            });
            
            if (provider) {
              providerInfo = {
                id: provider.id,
                commercialName: provider.commercial_name,
                logoUrl: provider.logo_url,
              };
              serviceType = provider.service_categories?.slug || null;
            }
          }

          // Generar un JWT real para desarrollo local
          const jwtToken = generateLocalJWT({
            sub: user.id,
            email: user.email,
            role: user.role,
          });

          console.log('✅ [LOGIN] Inicio de sesión exitoso (fallback local):', body.email);
          console.log('🔑 [LOGIN] JWT generado (primeros 50 chars):', jwtToken.substring(0, 50) + '...');
          
          // Normalizar role a string en minúsculas para compatibilidad con frontend
          const normalizedRole = user.role ? String(user.role).toLowerCase() : 'patient';
          
          // Normalizar serviceType a minúsculas si existe
          const normalizedServiceType = serviceType ? String(serviceType).toLowerCase() : null;
          
          console.log('🔍 [LOGIN] Valores normalizados (fallback):', {
            roleOriginal: user.role,
            roleNormalizado: normalizedRole,
            serviceTypeOriginal: serviceType,
            serviceTypeNormalizado: normalizedServiceType,
          });
          
          // Construir respuesta con información completa
          const responseData: any = {
            token: jwtToken, // Campo 'token' para compatibilidad con frontend
            accessToken: jwtToken,
            refreshToken: jwtToken,
            idToken: jwtToken,
            expiresIn: 3600,
            user: {
              id: user.id,
              userId: user.id, // También incluir userId para compatibilidad
              email: user.email,
              role: normalizedRole, // Role normalizado a minúsculas
              profilePictureUrl: user.profile_picture_url,
            },
          };

          // Agregar información del provider si existe
          if (providerInfo) {
            responseData.user.name = providerInfo.commercialName;
            responseData.user.provider = providerInfo;
          }

          // Agregar serviceType y tipo normalizados si es provider
          // ⚠️ CRÍTICO: El frontend espera 'tipo' porque los guards verifican user?.tipo
          if (normalizedServiceType) {
            responseData.user.serviceType = normalizedServiceType;
            // El frontend también necesita 'tipo' para los guards (DoctorRoute, LaboratoryRoute, etc.)
            responseData.user.tipo = normalizedServiceType;
            console.log('🏷️ [LOGIN] ServiceType y tipo normalizados (fallback):', normalizedServiceType);
          } else if (user.role === enum_roles.provider) {
            console.warn('⚠️ [LOGIN] Provider sin serviceType. Verificar categoría asignada.');
          }

          return successResponse(responseData);
        }
      }
    }
    
    if (error.name === 'NotAuthorizedException') {
      return unauthorizedResponse('Invalid credentials');
    }
    return internalErrorResponse('Failed to login');
  }
}

async function refresh(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    console.log('🔄 [REFRESH] Procesando refresh token');
    const body = parseBody(event.body, refreshTokenSchema);
    const refreshToken = body.refreshToken;
    const isLocalDev = process.env.STAGE === 'dev' || process.env.NODE_ENV === 'development' || !CLIENT_ID || !USER_POOL_ID;

    // Si estamos en desarrollo local, decodificar el refresh token y generar uno nuevo
    if (isLocalDev) {
      console.log('🔧 [REFRESH] Modo desarrollo local - Generando nuevo token desde refresh token');
      
      try {
        // Decodificar el refresh token (que en local es igual al access token)
        const parts = refreshToken.split('.');
        if (parts.length !== 3) {
          console.error('❌ [REFRESH] Token no tiene formato JWT válido');
          return unauthorizedResponse('Invalid refresh token format');
        }

        // Decodificar payload
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padding = base64.length % 4;
        const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
        const jsonPayload = Buffer.from(paddedBase64, 'base64').toString('utf-8');
        const decoded = JSON.parse(jsonPayload);

        console.log('✅ [REFRESH] Token decodificado. Email:', decoded.email || decoded.sub);

        // Verificar que el token no haya expirado (si tiene exp)
        if (decoded.exp) {
          const now = Math.floor(Date.now() / 1000);
          if (decoded.exp < now) {
            console.error('❌ [REFRESH] Token expirado');
            return unauthorizedResponse('Refresh token expired');
          }
        }

        // Buscar el usuario en la base de datos
        const prisma = getPrismaClient();
        const user = await prisma.users.findFirst({
          where: {
            OR: [
              { id: decoded.sub || decoded.userId },
              { email: decoded.email },
            ],
          },
        });

        if (!user) {
          console.error('❌ [REFRESH] Usuario no encontrado');
          return unauthorizedResponse('User not found');
        }

        // Verificar que el usuario esté activo (en desarrollo permitimos inactivos)
        const isProduction = process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production';
        if (!user.is_active && isProduction) {
          console.error('❌ [REFRESH] Usuario inactivo');
          return unauthorizedResponse('User account is inactive');
        }

        // Obtener información adicional del provider si es un provider
        let providerInfo = null;
        let serviceType = null;
        
        if (user.role === enum_roles.provider) {
          const provider = await prisma.providers.findFirst({
            where: { user_id: user.id },
            include: {
              service_categories: {
                select: {
                  slug: true,
                  name: true,
                },
              },
            },
          });
          
          if (provider) {
            providerInfo = {
              id: provider.id,
              commercialName: provider.commercial_name,
              logoUrl: provider.logo_url,
            };
            serviceType = provider.service_categories?.slug || null;
          }
        }

        // Normalizar role y serviceType
        const normalizedRole = user.role ? String(user.role).toLowerCase() : 'patient';
        const normalizedServiceType = serviceType ? String(serviceType).toLowerCase() : null;

        // Generar nuevos tokens
        const newAccessToken = generateLocalJWT({
          sub: user.id,
          email: user.email,
          role: normalizedRole,
        });

        const newRefreshToken = generateLocalJWT({
          sub: user.id,
          email: user.email,
          role: normalizedRole,
        });

        console.log('✅ [REFRESH] Nuevos tokens generados exitosamente');

        // Construir respuesta con la misma estructura que el login
        const responseData: any = {
          token: newAccessToken,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          idToken: newAccessToken,
          expiresIn: 3600, // 1 hora
          user: {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: normalizedRole,
            profilePictureUrl: user.profile_picture_url,
          },
        };

        // Agregar información del provider si existe
        if (providerInfo) {
          responseData.user.name = providerInfo.commercialName;
          responseData.user.provider = providerInfo;
        }

        // Agregar serviceType y tipo normalizados si es provider
        if (normalizedServiceType) {
          responseData.user.serviceType = normalizedServiceType;
          responseData.user.tipo = normalizedServiceType;
        }

        return successResponse(responseData);
      } catch (decodeError: any) {
        console.error('❌ [REFRESH] Error decodificando token:', decodeError.message);
        return unauthorizedResponse('Invalid refresh token');
      }
    }

    // Autenticación con Cognito (producción)
    console.log('🔐 [REFRESH] Refrescando token con Cognito');
    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(authCommand);

    console.log('✅ [REFRESH] Token refrescado exitosamente con Cognito');
    return successResponse({
      token: response.AuthenticationResult?.AccessToken,
      accessToken: response.AuthenticationResult?.AccessToken,
      refreshToken: refreshToken, // Cognito no devuelve un nuevo refresh token, se reutiliza
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });
  } catch (error: any) {
    console.error('❌ [REFRESH] Error al refrescar token:', error.message);
    logger.error('Error in refresh', error);
    
    if (error.name === 'NotAuthorizedException' || error.name === 'InvalidParameterException') {
      return unauthorizedResponse('Invalid refresh token');
    }
    
    return internalErrorResponse('Failed to refresh token');
  }
}

async function me(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('👤 [ME] Obteniendo información del usuario actual');
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    console.error('❌ [ME] Error de autenticación');
    return authResult;
  }

  const prisma = getPrismaClient();
  const user = await prisma.users.findUnique({
    where: { id: authResult.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      profile_picture_url: true,
      is_active: true,
      created_at: true,
    },
  });

  if (!user) {
    console.error('❌ [ME] Usuario no encontrado');
    return notFoundResponse('User not found');
  }

  // Normalizar role a minúsculas
  const normalizedRole = user.role ? String(user.role).toLowerCase() : 'patient';

  // Construir respuesta con estructura similar al login
  const responseData: any = {
    id: user.id,
    userId: user.id,
    email: user.email,
    role: normalizedRole,
    profilePictureUrl: user.profile_picture_url,
    isActive: user.is_active,
    createdAt: user.created_at,
  };

  // Si es provider, obtener serviceType y tipo
  if (user.role === enum_roles.provider) {
    const provider = await prisma.providers.findFirst({
      where: { user_id: user.id },
      include: {
        service_categories: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    if (provider) {
      const serviceType = provider.service_categories?.slug || null;
      const normalizedServiceType = serviceType ? String(serviceType).toLowerCase() : null;

      if (normalizedServiceType) {
        responseData.serviceType = normalizedServiceType;
        responseData.tipo = normalizedServiceType; // ⚠️ CRÍTICO: Frontend espera 'tipo'
      }

      // Agregar información del provider
      responseData.name = provider.commercial_name;
      responseData.provider = {
        id: provider.id,
        commercialName: provider.commercial_name,
        logoUrl: provider.logo_url,
      };
    }
  }

  console.log('✅ [ME] Información del usuario obtenida:', {
    id: responseData.id,
    email: responseData.email,
    role: responseData.role,
    serviceType: responseData.serviceType || 'NO DEFINIDO',
    tipo: responseData.tipo || 'NO DEFINIDO',
  });

  return successResponse(responseData);
}

async function changePassword(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  try {
    const body = parseBody(event.body, changePasswordSchema);

    const changePasswordCommand = new ChangePasswordCommand({
      AccessToken: event.headers.authorization?.replace('Bearer ', '') || '',
      PreviousPassword: body.currentPassword,
      ProposedPassword: body.newPassword,
    });

    await cognitoClient.send(changePasswordCommand);

    return successResponse({ message: 'Password changed successfully' });
  } catch (error: any) {
    logger.error('Error in changePassword', error);
    if (error.name === 'NotAuthorizedException') {
      return unauthorizedResponse('Invalid current password');
    }
    return internalErrorResponse('Failed to change password');
  }
}

async function forgotPassword(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event.body, forgotPasswordSchema);

    const forgotPasswordCommand = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: body.email,
    });

    await cognitoClient.send(forgotPasswordCommand);

    return successResponse({
      message: 'Password reset code sent to your email',
    });
  } catch (error: any) {
    logger.error('Error in forgotPassword', error);
    // Por seguridad, no revelamos si el email existe o no
    return successResponse({
      message: 'If the email exists, a reset code has been sent',
    });
  }
}

async function resetPassword(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const body = parseBody(event.body, resetPasswordSchema);

    const confirmForgotPasswordCommand = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: body.email,
      ConfirmationCode: body.code,
      Password: body.newPassword,
    });

    await cognitoClient.send(confirmForgotPasswordCommand);

    return successResponse({ message: 'Password reset successfully' });
  } catch (error: any) {
    logger.error('Error in resetPassword', error);
    if (error.name === 'CodeMismatchException') {
      return errorResponse('Invalid verification code', 400);
    }
    return internalErrorResponse('Failed to reset password');
  }
}
