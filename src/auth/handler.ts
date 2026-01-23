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
} from '../shared/response';
import { logger } from '../shared/logger';
import { requireAuth } from '../shared/auth';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  parseBody,
} from '../shared/validators';
import { validatePayloadSize } from '../shared/security';

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
      return await register(event);
    }

    // POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      return await login(event);
    }

    // POST /api/auth/refresh
    if (method === 'POST' && path === '/api/auth/refresh') {
      return await refresh(event);
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      return await me(event);
    }

    // POST /api/auth/change-password
    if (method === 'POST' && path === '/api/auth/change-password') {
      return await changePassword(event);
    }

    // POST /api/auth/forgot-password
    if (method === 'POST' && path === '/api/auth/forgot-password') {
      return await forgotPassword(event);
    }

    // POST /api/auth/reset-password
    if (method === 'POST' && path === '/api/auth/reset-password') {
      return await resetPassword(event);
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    logger.error('Error in auth handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function register(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
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
    const user = await prisma.user.create({
      data: {
        cognitoUserId: cognitoResponse.UserSub || '',
        email: body.email,
        phone: body.phone,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role || 'PATIENT',
      },
    });

    return successResponse({
      userId: user.id,
      email: user.email,
      message: 'User registered successfully. Please confirm your email.',
    }, 201);
  } catch (error: any) {
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
    const body = parseBody(event.body, loginSchema);

    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
    });

    const response = await cognitoClient.send(authCommand);

    return successResponse({
      accessToken: response.AuthenticationResult?.AccessToken,
      refreshToken: response.AuthenticationResult?.RefreshToken,
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });
  } catch (error: any) {
    logger.error('Error in login', error);
    if (error.name === 'NotAuthorizedException') {
      return unauthorizedResponse('Invalid credentials');
    }
    return internalErrorResponse('Failed to login');
  }
}

async function refresh(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const refreshToken = body.refreshToken;

    if (!refreshToken) {
      return errorResponse('Refresh token is required', 400);
    }

    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(authCommand);

    return successResponse({
      accessToken: response.AuthenticationResult?.AccessToken,
      idToken: response.AuthenticationResult?.IdToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    });
  } catch (error: any) {
    logger.error('Error in refresh', error);
    return unauthorizedResponse('Invalid refresh token');
  }
}

async function me(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireAuth(event);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: authResult.user.id },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      serviceType: true,
      createdAt: true,
    },
  });

  return successResponse(user);
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
