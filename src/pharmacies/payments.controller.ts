import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, paginatedResponse, successResponse } from '../shared/response';

// GET /api/pharmacies/payments - Obtener pagos e ingresos
export async function getPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [PHARMACIES] GET /api/pharmacies/payments - Obteniendo pagos e ingresos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [PHARMACIES] GET /api/pharmacies/payments - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;
  const page = parseInt(queryParams.page || '1', 10);
  const limit = parseInt(queryParams.limit || '20', 10);
  const offset = (page - 1) * limit;

  try {
    // Buscar provider
    const provider = await prisma.providers.findFirst({
      where: { user_id: userId },
    });

    if (!provider) {
      console.log('⚠️ [PHARMACIES] Provider no encontrado, retornando valores en 0 para pagos');
      return successResponse({
        payments: [],
        totalIncome: 0,
        totalPending: 0,
        totalCompleted: 0,
        monthlyIncome: [],
      });
    }

    // Obtener appointment_ids del provider
    const providerAppointments = await prisma.appointments.findMany({
      where: { provider_id: provider.id },
      select: { id: true },
    });
    const appointmentIds = providerAppointments.map(a => a.id);

    if (appointmentIds.length === 0) {
      return successResponse({
        payments: [],
        totalIncome: 0,
        totalPending: 0,
        totalCompleted: 0,
        monthlyIncome: [],
      });
    }

    const paymentWhere = {
      appointment_id: { in: appointmentIds },
    };

    // Obtener pagos
    const [payments, total] = await Promise.all([
      prisma.payments.findMany({
        where: paymentWhere,
        include: {
          appointments: {
            include: {
              patients: {
                select: {
                  id: true,
                  full_name: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.payments.count({ where: paymentWhere }),
    ]);

    // Total de pagos (sin paginar) para los agregados
    const [allPaymentsAgg] = await Promise.all([
      prisma.payments.aggregate({
        where: {
          ...paymentWhere,
          status: 'completed',
        },
        _sum: { provider_amount: true },
        _count: true,
      }),
    ]);

    const totalIncome = Number(allPaymentsAgg._sum.provider_amount || 0);

    const pendingAgg = await prisma.payments.aggregate({
      where: {
        ...paymentWhere,
        status: 'pending',
      },
      _sum: { provider_amount: true },
    });
    const totalPending = Number(pendingAgg._sum.provider_amount || 0);

    const totalCompleted = allPaymentsAgg._count || 0;

    // Agrupar por mes (últimos 6 meses)
    const monthlyIncome: Array<{ month: string; income: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const result = await prisma.payments.aggregate({
        where: {
          ...paymentWhere,
          status: 'completed',
          created_at: {
            gte: new Date(date.getFullYear(), date.getMonth(), 1),
            lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
          },
        },
        _sum: { provider_amount: true },
      });
      monthlyIncome.push({
        month: monthKey,
        income: Number(result._sum.provider_amount || 0),
      });
    }

    console.log('✅ [PHARMACIES] Pagos obtenidos exitosamente');
    return successResponse({
      payments: payments.map(p => ({
        id: p.id,
        amount: Number(p.provider_amount || 0),
        totalAmount: Number(p.amount_total || 0),
        platformFee: Number(p.platform_fee || 0),
        status: p.status,
        createdAt: p.created_at,
        patient: p.appointments?.patients ? {
          id: p.appointments.patients.id,
          fullName: p.appointments.patients.full_name,
        } : null,
      })),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalPending: Number(totalPending.toFixed(2)),
      totalCompleted,
      monthlyIncome,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error(`❌ [PHARMACIES] Error al obtener pagos:`, error.message);
    logger.error('Error getting payments', error);
    return internalErrorResponse('Failed to get payments');
  }
}
