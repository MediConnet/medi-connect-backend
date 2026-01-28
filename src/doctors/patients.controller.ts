import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles, Prisma } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, successResponse } from '../shared/response';

export async function getPatients(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/patients - Obteniendo pacientes');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) return authResult;
  
  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  const queryParams = event.queryStringParameters || {};
  const page = parseInt(queryParams.page || '1');
  const limit = parseInt(queryParams.limit || '10');
  const search = queryParams.search || '';
  const skip = (page - 1) * limit;

  const provider = await prisma.providers.findFirst({
    where: { user_id: authContext.user.id },
  });

  if (!provider) return errorResponse('Proveedor no encontrado', 404);


  const whereClause: Prisma.patientsWhereInput = {
    AND: [
      {
        appointments: {
          some: { provider_id: provider.id } 
        }
      },
      search ? {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { users: { email: { contains: search, mode: 'insensitive' } } }
        ]
      } : {}
    ]
  };

  try {
   
    const [total, patientsRaw] = await prisma.$transaction([
      prisma.patients.count({ where: whereClause }),
      prisma.patients.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { full_name: 'asc' }, 
        include: {
          users: { select: { email: true } }, 
          appointments: {
            where: { provider_id: provider.id },
            orderBy: { scheduled_for: 'desc' }, 
            select: {
              id: true,
              scheduled_for: true,
              status: true,
              reason: true,
              payment_method: true,
              cost: true,
              is_paid: true
            }
          }
        }
      })
    ]);

    const formattedPatients = patientsRaw.map(p => {
      const appointments = p.appointments || [];
      const lastAppointment = appointments.length > 0 ? appointments[0] : null;

      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        email: p.users?.email || null,
        birth_date: p.birth_date,
        
        total_appointments: appointments.length,
        last_appointment_date: lastAppointment?.scheduled_for || null,

        appointment_history: appointments.map(apt => ({
          id: apt.id,
          date: apt.scheduled_for, 
          reason: apt.reason,
          status: apt.status,
          payment: {
            amount: Number(apt.cost),
            method: apt.payment_method,
            isPaid: apt.is_paid
          }
        }))
      };
    });

    return successResponse({
      data: formattedPatients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error getting patients:', error);
    return errorResponse('Error al obtener lista de pacientes', 500);
  }
}