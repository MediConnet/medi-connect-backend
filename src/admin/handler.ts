import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getPrismaClient } from '../shared/prisma';
import { successResponse, errorResponse, notFoundResponse, internalErrorResponse } from '../shared/response';
import { logger } from '../shared/logger';
import { requireRole, AuthContext } from '../shared/auth';
import { enum_roles } from '../generated/prisma/client';
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
  const authResult = await requireRole(event, [enum_roles.admin]);
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
    prisma.users.count(),
    prisma.users.count({ where: { role: enum_roles.provider } }),
    prisma.appointments.count(),
    // TODO: Models providerRequest and adRequest don't exist in schema
    0, // prisma.providerRequest.count({ where: { status: 'PENDING' } }),
    0, // prisma.adRequest.count({ where: { status: 'PENDING' } }),
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
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const queryParams = event.queryStringParameters || {};
  const type = queryParams.type || 'all'; // 'provider', 'ad', 'all'
  const status = queryParams.status;
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  const prisma = getPrismaClient();

  // TODO: Models providerRequest and adRequest don't exist in schema
  return successResponse({
    requests: [],
    type: type === 'provider' ? 'provider' : type === 'ad' ? 'ad' : 'all',
    pagination: { limit, offset, total: 0 },
  });
}

async function approveRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  // TODO: Models providerRequest and adRequest don't exist in schema
  return notFoundResponse('Request models not implemented');
}

async function rejectRequest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.admin]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  // TODO: Models providerRequest and adRequest don't exist in schema
  return notFoundResponse('Request models not implemented');
}

function extractIdFromPath(path: string, prefix: string, suffix: string): string {
  const start = prefix.length;
  const end = path.indexOf(suffix);
  if (end === -1) {
    throw new Error('Invalid path format');
  }
  return path.substring(start, end);
}
