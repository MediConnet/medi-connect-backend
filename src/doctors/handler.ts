import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
<<<<<<< Updated upstream
import { getDashboard, getProfile, updateProfile, updateSchedule } from './profile.controller';
import { getSpecialties } from './specialties.controller';
=======
import { logger } from '../shared/logger';
import { errorResponse, internalErrorResponse, optionsResponse, successResponse, notFoundResponse } from '../shared/response';
import { getAppointments } from './appointments.controller';
import { getProfile, updateProfile } from './profile.controller';
import { requireRole, AuthContext } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { enum_roles } from '../generated/prisma/client';
import { 
  updateAppointmentStatusSchema, 
  createDiagnosisSchema, 
  updateScheduleSchema,
  parseBody,
  extractIdFromPath 
} from '../shared/validators';
import { randomUUID } from 'crypto';
>>>>>>> Stashed changes

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`Doctors handler invoked: ${method} ${path}`);

  // --- RUTAS DE PERFIL ---
  if (path === '/api/doctors/profile' && method === 'GET') {
    return getProfile(event);
  }
  if (path === '/api/doctors/profile' && method === 'PUT') {
    return updateProfile(event);
  }

<<<<<<< Updated upstream
  // --- RUTA: DASHBOARD ---
  if (path === '/api/doctors/dashboard' && method === 'GET') {
    return getDashboard(event);
=======
  try {
    // --- Rutas de Perfil ---
    if (path === '/api/doctors/profile') {
      if (method === 'GET') return await getProfile(event);
      if (method === 'PUT') return await updateProfile(event);
    }

    // --- Rutas de Dashboard ---
    if (path === '/api/doctors/dashboard') {
      if (method === 'GET') return await getDashboard(event);
    }

    // --- Rutas de Citas ---
    if (path === '/api/doctors/appointments') {
      if (method === 'GET') return await getAppointments(event);
    }

    // --- Rutas de Estado de Cita ---
    if (path.startsWith('/api/doctors/appointments/') && path.endsWith('/status')) {
      if (method === 'PUT') return await updateAppointmentStatus(event);
    }

    // --- Rutas de Diagnóstico ---
    if (path.startsWith('/api/doctors/appointments/') && path.endsWith('/diagnosis')) {
      if (method === 'POST') return await createDiagnosis(event);
    }

    // --- Rutas de Horario ---
    if (path === '/api/doctors/schedule') {
      if (method === 'GET') return await getSchedule(event);
      if (method === 'PUT') return await updateSchedule(event);
    }

    // --- Rutas de Pacientes ---
    if (path === '/api/doctors/patients') {
      if (method === 'GET') return await getPatients(event);
    }

    // --- Rutas de Reseñas ---
    if (path === '/api/doctors/reviews') {
      if (method === 'GET') return await getReviews(event);
    }

    // --- Rutas de Pagos ---
    if (path === '/api/doctors/payments' || path === '/api/doctors/payments/income') {
      if (method === 'GET') return await getPayments(event);
    }

    // Si no coincide ninguna ruta
    return errorResponse('Not found', 404);

  } catch (error: any) {
    console.error(`❌ [DOCTORS] ${method} ${path} - Error:`, error.message);
    logger.error('Error in doctors handler', error, { method, path });
    return internalErrorResponse(error.message || 'Internal server error');
  }
}

async function getDashboard(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/dashboard - Obteniendo dashboard del doctor');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/dashboard - Error de autenticación/autorización');
    return authResult;
>>>>>>> Stashed changes
  }

  // --- RUTA: HORARIOS ---
  if (path === '/api/doctors/schedule' && (method === 'PUT' || method === 'POST')) {
    return updateSchedule(event);
  }

  // --- ESPECIALIDADES ---
  if (path === '/api/specialties' && method === 'GET') {
    return getSpecialties(event);
  }

  if (path === '/api/doctors/appointments' && method === 'GET') {
    return { statusCode: 200, body: JSON.stringify({ success: true, data: [] }) }; 
  }

<<<<<<< Updated upstream
  return {
    statusCode: 404,
    body: JSON.stringify({ message: `Route ${method} ${path} not found` }),
  };
};
=======
  // Obtener pacientes únicos que tienen citas con este provider
  const appointments = await prisma.appointments.findMany({
    where: { provider_id: provider.id },
    include: {
      patients: {
        select: {
          id: true,
          full_name: true,
          phone: true,
          users: {
            select: {
              email: true,
              profile_picture_url: true,
            },
          },
        },
      },
    },
  });

  // Obtener pacientes únicos
  const uniquePatients = new Map();
  appointments.forEach(apt => {
    if (apt.patients && !uniquePatients.has(apt.patients.id)) {
      uniquePatients.set(apt.patients.id, {
        id: apt.patients.id,
        fullName: apt.patients.full_name,
        phone: apt.patients.phone,
        email: apt.patients.users?.email || null,
        profilePictureUrl: apt.patients.users?.profile_picture_url || null,
      });
    }
  });

  console.log('✅ [DOCTORS] GET /api/doctors/patients - Pacientes obtenidos exitosamente');
  return successResponse({
    patients: Array.from(uniquePatients.values()),
    total: uniquePatients.size,
  });
}

// Obtener reseñas del doctor
async function getReviews(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/reviews - Obteniendo reseñas');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/reviews - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  // Buscar provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
  });

  if (!provider) {
    console.log('⚠️ [DOCTORS] Provider no encontrado, retornando array vacío de reseñas');
    return successResponse({
      reviews: [],
      averageRating: 0,
      totalReviews: 0,
    });
  }

  // Obtener reseñas de las sucursales del provider
  const reviews = await prisma.reviews.findMany({
    where: {
      provider_branches: {
        provider_id: provider.id,
      },
    },
    include: {
      patients: {
        select: {
          id: true,
          full_name: true,
          users: {
            select: {
              profile_picture_url: true,
            },
          },
        },
      },
      provider_branches: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    : 0;

  console.log('✅ [DOCTORS] GET /api/doctors/reviews - Reseñas obtenidas exitosamente');
  return successResponse({
    reviews: reviews.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment || null,
      createdAt: r.created_at,
      patient: r.patients ? {
        id: r.patients.id,
        fullName: r.patients.full_name,
        profilePictureUrl: r.patients.users?.profile_picture_url || null,
      } : null,
      branch: r.provider_branches ? {
        id: r.provider_branches.id,
        name: r.provider_branches.name,
      } : null,
    })),
    averageRating: Number(averageRating.toFixed(2)),
    totalReviews: reviews.length,
  });
}

// Obtener pagos e ingresos del doctor
async function getPayments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/payments - Obteniendo pagos e ingresos');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/payments - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || authContext.user.id;

  // Buscar provider
  const provider = await prisma.providers.findFirst({
    where: { user_id: userId },
  });

  if (!provider) {
    console.log('⚠️ [DOCTORS] Provider no encontrado, retornando valores en 0 para pagos');
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

  // Obtener pagos
  const payments = await prisma.payments.findMany({
    where: {
      appointment_id: { in: appointmentIds },
    },
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
  });

  // Calcular totales
  const totalIncome = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
  
  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
  
  const totalCompleted = payments.filter(p => p.status === 'completed').length;

  // Agrupar por mes (últimos 6 meses)
  const monthlyIncome: Array<{ month: string; income: number }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthIncome = payments
      .filter(p => {
        if (!p.created_at || p.status !== 'completed') return false;
        const paymentDate = new Date(p.created_at);
        return paymentDate.getFullYear() === date.getFullYear() &&
               paymentDate.getMonth() === date.getMonth();
      })
      .reduce((sum, p) => sum + Number(p.provider_amount || 0), 0);
    
    monthlyIncome.push({
      month: monthKey,
      income: monthIncome,
    });
  }

  console.log('✅ [DOCTORS] GET /api/doctors/payments - Pagos obtenidos exitosamente');
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
  });
}

// Actualizar estado de cita
async function updateAppointmentStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] PUT /api/doctors/appointments/{id}/status - Actualizando estado de cita');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] PUT /api/doctors/appointments/{id}/status - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Extraer ID de la URL
    const appointmentId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/doctors/appointments/',
      '/status'
    );

    // Validar body
    const body = parseBody(event.body, updateAppointmentStatusSchema);

    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.error('❌ [DOCTORS] Provider no encontrado');
      return errorResponse('Provider not found', 404);
    }

    // Buscar la cita y verificar que pertenece al provider
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    if (!appointment) {
      console.error(`❌ [DOCTORS] Cita no encontrada: ${appointmentId}`);
      return notFoundResponse('Appointment not found');
    }

    if (appointment.provider_id !== provider.id) {
      console.error(`❌ [DOCTORS] La cita no pertenece al provider autenticado`);
      return errorResponse('Appointment does not belong to this provider', 403);
    }

    // Mapear estados del frontend a estados de la BD
    const statusMap: Record<string, string> = {
      'pending': 'CONFIRMED',
      'paid': 'CONFIRMED',
      'completed': 'COMPLETED',
      'cancelled': 'CANCELLED',
      'no-show': 'CANCELLED',
    };

    const dbStatus = statusMap[body.status] || body.status.toUpperCase();

    // Actualizar estado
    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        status: dbStatus,
      },
    });

    console.log(`✅ [DOCTORS] Estado de cita actualizado: ${appointmentId} -> ${body.status}`);
    return successResponse({
      id: updatedAppointment.id,
      status: body.status,
    });
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al actualizar estado de cita:`, error.message);
    logger.error('Error updating appointment status', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid appointment ID', 400);
    }
    return internalErrorResponse('Failed to update appointment status');
  }
}

// Crear diagnóstico
async function createDiagnosis(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] POST /api/doctors/appointments/{id}/diagnosis - Creando diagnóstico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] POST /api/doctors/appointments/{id}/diagnosis - Error de autenticación/autorización');
    return authResult;
  }

    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

  try {
    // Extraer ID de la URL
    const appointmentId = extractIdFromPath(
      event.requestContext.http.path,
      '/api/doctors/appointments/',
      '/diagnosis'
    );

    // Validar body
    const body = parseBody(event.body, createDiagnosisSchema);

    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
      include: {
        service_categories: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!provider) {
      console.error('❌ [DOCTORS] Provider no encontrado');
      return errorResponse('Provider not found', 404);
    }

    // Buscar la cita y verificar que pertenece al provider
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
      include: {
        patients: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    if (!appointment) {
      console.error(`❌ [DOCTORS] Cita no encontrada: ${appointmentId}`);
      return notFoundResponse('Appointment not found');
    }

    if (appointment.provider_id !== provider.id) {
      console.error(`❌ [DOCTORS] La cita no pertenece al provider autenticado`);
      return errorResponse('Appointment does not belong to this provider', 403);
    }

    if (!appointment.patient_id) {
      console.error(`❌ [DOCTORS] La cita no tiene paciente asociado`);
      return errorResponse('Appointment does not have an associated patient', 400);
    }

    // Crear diagnóstico en medical_history
    const diagnosis = await prisma.medical_history.create({
      data: {
        id: randomUUID(),
        patient_id: appointment.patient_id,
        provider_id: provider.id,
        doctor_name_snapshot: provider.commercial_name || null,
        specialty_snapshot: provider.service_categories?.name || null,
        diagnosis: body.diagnosis,
        treatment: body.treatment || null,
        indications: body.indications || null,
        observations: body.observations || null,
        date: appointment.scheduled_for || new Date(),
      },
    });

    console.log(`✅ [DOCTORS] Diagnóstico creado exitosamente: ${diagnosis.id}`);
    return successResponse({
      id: diagnosis.id,
      appointmentId: appointment.id,
      diagnosis: diagnosis.diagnosis,
      treatment: diagnosis.treatment,
      indications: diagnosis.indications,
      observations: diagnosis.observations,
      createdAt: diagnosis.created_at,
    }, 201);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al crear diagnóstico:`, error.message);
    logger.error('Error creating diagnosis', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid appointment ID', 400);
    }
    return internalErrorResponse('Failed to create diagnosis');
  }
}

// Obtener horario
async function getSchedule(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] GET /api/doctors/schedule - Obteniendo horario');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] GET /api/doctors/schedule - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [DOCTORS] Provider no encontrado, retornando horario vacío');
      return successResponse([]);
    }

    // Obtener todas las sucursales del provider
    const branches = await prisma.provider_branches.findMany({
      where: { provider_id: provider.id },
      include: {
        provider_schedules: {
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });

    // Mapear días de la semana
    const dayMap: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };

    // Crear un mapa de horarios por día (usando la sucursal principal o la primera)
    const mainBranch = branches.find(b => b.is_main) || branches[0];
    const schedulesByDay = new Map<string, any>();

    // Inicializar todos los días como deshabilitados
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    allDays.forEach(day => {
      schedulesByDay.set(day, {
        day,
        enabled: false,
        startTime: '09:00',
        endTime: '18:00',
        timeSlots: [],
        blockedHours: [],
      });
    });

    // Si hay sucursal principal, obtener sus horarios
    if (mainBranch && mainBranch.provider_schedules) {
      mainBranch.provider_schedules.forEach(schedule => {
        const dayName = dayMap[schedule.day_of_week || 1];
        if (dayName) {
          // Formatear hora de DateTime a string HH:mm
          const startTime = schedule.start_time 
            ? new Date(schedule.start_time).toTimeString().slice(0, 5)
            : '09:00';
          const endTime = schedule.end_time
            ? new Date(schedule.end_time).toTimeString().slice(0, 5)
            : '18:00';

          schedulesByDay.set(dayName, {
            day: dayName,
            enabled: true,
            startTime,
            endTime,
            timeSlots: [], // TODO: Implementar timeSlots si es necesario
            blockedHours: [], // TODO: Implementar blockedHours si es necesario
          });
        }
      });
    }

    const scheduleArray = Array.from(schedulesByDay.values());

    console.log(`✅ [DOCTORS] Horario obtenido exitosamente (${scheduleArray.length} días)`);
    return successResponse(scheduleArray);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al obtener horario:`, error.message);
    logger.error('Error getting schedule', error);
    return internalErrorResponse('Failed to get schedule');
  }
}

// Actualizar horario
async function updateSchedule(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [DOCTORS] PUT /api/doctors/schedule - Actualizando horario');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [DOCTORS] PUT /api/doctors/schedule - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Validar body
    const body = parseBody(event.body, updateScheduleSchema);

    // Buscar provider del usuario autenticado
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.error('❌ [DOCTORS] Provider no encontrado');
      return errorResponse('Provider not found', 404);
    }

    // Obtener sucursal principal
    const mainBranch = await prisma.provider_branches.findFirst({
      where: {
        provider_id: provider.id,
        is_main: true,
      },
    });

    if (!mainBranch) {
      console.error('❌ [DOCTORS] Sucursal principal no encontrada');
      return errorResponse('Main branch not found', 404);
    }

    // Mapear días de la semana
    const dayMap: Record<string, number> = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
    };

    // Eliminar horarios existentes de la sucursal principal
    await prisma.provider_schedules.deleteMany({
      where: { branch_id: mainBranch.id },
    });

    // Crear nuevos horarios
    for (const scheduleDay of body.schedule) {
      if (scheduleDay.enabled) {
        const dayOfWeek = dayMap[scheduleDay.day];
        if (dayOfWeek !== undefined) {
          // Convertir string HH:mm a DateTime (usando una fecha base)
          const startTime = new Date(`1970-01-01T${scheduleDay.startTime}:00`);
          const endTime = new Date(`1970-01-01T${scheduleDay.endTime}:00`);

          await prisma.provider_schedules.create({
            data: {
              id: randomUUID(),
              branch_id: mainBranch.id,
              day_of_week: dayOfWeek,
              start_time: startTime,
              end_time: endTime,
    },
  });
        }
      }
    }

    console.log(`✅ [DOCTORS] Horario actualizado exitosamente (${body.schedule.length} días)`);
    
    // Retornar el horario actualizado (usando la misma función de GET)
    return await getSchedule(event);
  } catch (error: any) {
    console.error(`❌ [DOCTORS] Error al actualizar horario:`, error.message);
    logger.error('Error updating schedule', error);
    if (error.message.includes('Validation error')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update schedule');
  }
}
>>>>>>> Stashed changes
