import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole, AuthContext } from '../shared/auth';
import { UserRole } from '@prisma/client';
import { approveRequestSchema, rejectRequestSchema, parseBody } from '../shared/validators';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  logger.info('Admin handler invoked', { method, path });

  // Manejar preflight OPTIONS requests (CORS)
  if (method === 'OPTIONS') {
    const { optionsResponse } = await import('../shared/response');
    return optionsResponse(event);
  }

  try {
    // GET /api/admin/dashboard/stats
    if (method === 'GET' && path === '/api/admin/dashboard/stats') {
      return await getDashboardStats(event);
    }

    // GET /api/admin/requests
    if (method === 'GET' && path === '/api/admin/requests') {
      return await getRequests(event);
    }

    // PUT /api/admin/requests/{id}/approve
    if (method === 'PUT' && path.startsWith('/api/admin/requests/') && path.endsWith('/approve')) {
      return await approveRequest(event);
    }

    // PUT /api/admin/requests/{id}/reject
    if (method === 'PUT' && path.startsWith('/api/admin/requests/') && path.endsWith('/reject')) {
      return await rejectRequest(event);
    }

    return errorResponse('Not found', 404);
  } catch (error: any) {
    logger.error('Error in admin handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function getDashboardStats(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [UserRole.ADMIN]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const prisma = getPrismaClient();

  // Estadísticas en paralelo
  const [
    totalUsers,
    totalDoctors,
    totalAppointments,
    pendingProviderRequests,
    pendingAdRequests,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.DOCTOR } }),
    prisma.appointment.count(),
    prisma.providerRequest.count({ where: { status: 'PENDING' } }),
    prisma.adRequest.count({ where: { status: 'PENDING' } }),
  ]);

  return successResponse({
    users: {
      total: totalUsers,
      doctors: totalDoctors,
    },
    appointments: {
      total: totalAppointments,
    },
    requests: {
      pendingProviderRequests,
      pendingAdRequests,
      total: pendingProviderRequests + pendingAdRequests,
    },
  });
}

async function getRequests(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [UserRole.ADMIN]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const type = queryParams.type || 'all'; // 'provider', 'ad', 'all'
  const status = queryParams.status;
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  const prisma = getPrismaClient();

  if (type === 'provider') {
    const requests = await prisma.providerRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return successResponse({
      requests,
      type: 'provider',
      pagination: { limit, offset, total: requests.length },
    });
  }

  if (type === 'ad') {
    const requests = await prisma.adRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return successResponse({
      requests,
      type: 'ad',
      pagination: { limit, offset, total: requests.length },
    });
  }

  // 'all' - combinar ambos
  const [providerRequests, adRequests] = await Promise.all([
    prisma.providerRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.adRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);

  return successResponse({
    providerRequests,
    adRequests,
    type: 'all',
    pagination: { limit, offset },
  });
}

async function approveRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [UserRole.ADMIN]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  try {
    const authContext = authResult as AuthContext;
    const requestId = extractIdFromPath(event.requestContext.http.path, '/api/admin/requests/', '/approve');
    const body = parseBody(event.body, approveRequestSchema);
    const prisma = getPrismaClient();

    // Intentar aprobar como ProviderRequest primero
    let request = await prisma.providerRequest.findUnique({ where: { id: requestId } });
    if (request) {
      request = await prisma.providerRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: authContext.user.id,
          reviewedAt: new Date(),
          notes: body.notes,
        },
      });
      return successResponse({ request, type: 'provider' });
    }

    // Si no es ProviderRequest, intentar AdRequest
    request = await prisma.adRequest.findUnique({ where: { id: requestId } });
    if (request) {
      request = await prisma.adRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedBy: authContext.user.id,
          reviewedAt: new Date(),
        },
      });
      return successResponse({ request, type: 'ad' });
    }

    return notFoundResponse('Request not found');
  } catch (error: any) {
    logger.error('Error in approveRequest', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to approve request');
  }
}

async function rejectRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [UserRole.ADMIN]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  try {
    const authContext = authResult as AuthContext;
    const requestId = extractIdFromPath(event.requestContext.http.path, '/api/admin/requests/', '/reject');
    const body = parseBody(event.body, rejectRequestSchema);
    const prisma = getPrismaClient();

    // Intentar rechazar como ProviderRequest primero
    let request = await prisma.providerRequest.findUnique({ where: { id: requestId } });
    if (request) {
      request = await prisma.providerRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: authContext.user.id,
          reviewedAt: new Date(),
          notes: body.notes,
        },
      });
      return successResponse({ request, type: 'provider' });
    }

    // Si no es ProviderRequest, intentar AdRequest
    request = await prisma.adRequest.findUnique({ where: { id: requestId } });
    if (request) {
      request = await prisma.adRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          reviewedBy: authContext.user.id,
          reviewedAt: new Date(),
        },
      });
      return successResponse({ request, type: 'ad' });
    }

    return notFoundResponse('Request not found');
  } catch (error: any) {
    logger.error('Error in rejectRequest', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to reject request');
  }
}

function extractIdFromPath(path: string, prefix: string, suffix: string): string {
  const start = prefix.length;
  const end = path.indexOf(suffix);
  if (end === -1) {
    throw new Error('Invalid path format');
  }
  return path.substring(start, end);
}
