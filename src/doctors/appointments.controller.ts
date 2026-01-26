import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { notFoundResponse, successResponse } from '../shared/response';

export async function getAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  console.log('✅ [DOCTORS] GET /api/doctors/appointments - Obteniendo citas');
  
  // 1. Identificar al proveedor
  const provider = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
  });

  if (!provider) {
    console.log('⚠️ [DOCTORS] Provider no encontrado, retornando array vacío');
    // Retornar estructura completa con array vacío para usuarios nuevos
    return successResponse({
      appointments: [],
      pagination: {
        limit: 50,
        offset: 0,
        total: 0,
      },
    });
  }

  // 2. Query Params
  const queryParams = event.queryStringParameters || {};
  const status = queryParams.status;
  const limit = parseInt(queryParams.limit || '50', 10);
  const offset = parseInt(queryParams.offset || '0', 10);

  // 3. Consultar citas 
  const appointments = await prisma.appointments.findMany({
    where: {
      provider_id: provider.id,
      ...(status && { status: status as any }),
    },
    include: {
      patients: {
        select: {
          id: true,
          full_name: true,
          phone: true,
          users: {
            select: {
              profile_picture_url: true,
            },
          },
        },
      },
    },
    orderBy: { scheduled_for: 'asc' },
    take: limit,
    skip: offset,
  });

  // 4. Retornar respuesta
  const formattedAppointments = appointments.map(appt => ({
    ...appt,
    patients: appt.patients ? {
      ...appt.patients,
      profile_picture_url: appt.patients.users?.profile_picture_url || null,
      users: undefined 
    } : null
  }));

  return successResponse({
    appointments: formattedAppointments,
    pagination: {
      limit,
      offset,
      total: appointments.length,
    },
  });
}