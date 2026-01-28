import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updateDoctorScheduleSchema, extractIdFromPath } from '../shared/validators';

// Helper para convertir número de día a nombre
function dayNumberToName(day: number): string {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days[day] || 'monday';
}

// Helper para convertir nombre de día a número (0=Lunes, 6=Domingo)
function dayNameToNumber(day: string): number {
  const map: Record<string, number> = {
    'monday': 0,
    'tuesday': 1,
    'wednesday': 2,
    'thursday': 3,
    'friday': 4,
    'saturday': 5,
    'sunday': 6,
  };
  return map[day.toLowerCase()] ?? 0;
}

// Helper para formatear Time a string HH:mm
function formatTime(time: Date | null): string {
  if (!time) return '09:00';
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// GET /api/clinics/doctors/:doctorId/schedule
export async function getDoctorSchedule(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/doctors/{id}/schedule - Obteniendo horarios del médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/doctors/{id}/schedule - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const doctorId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/doctors/', '/schedule');

    // Buscar médico
    const doctor = await prisma.clinic_doctors.findFirst({
      where: { id: doctorId },
      include: {
        clinics: true,
      },
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado: ${doctorId}`);
      return notFoundResponse('Doctor not found');
    }

    // Verificar permisos: solo el médico o el administrador de la clínica pueden ver
    if (doctor.user_id !== authContext.user.id) {
      // Verificar si el usuario es administrador de la clínica
      if (!doctor.clinic_id) {
        console.error('❌ [CLINICS] Doctor no tiene clínica asignada');
        return errorResponse('Doctor has no clinic assigned', 400);
      }
      
      const clinic = await prisma.clinics.findFirst({
        where: {
          id: doctor.clinic_id,
          user_id: authContext.user.id,
        },
      });

      if (!clinic) {
        console.error('❌ [CLINICS] No tiene permisos para ver este horario');
        return errorResponse('Forbidden', 403);
      }
    }

    // Obtener horarios del médico
    if (!doctor.clinic_id) {
      console.error('❌ [CLINICS] Doctor no tiene clínica asignada');
      return errorResponse('Doctor has no clinic assigned', 400);
    }
    
    const schedules = await prisma.doctor_schedules.findMany({
      where: {
        doctor_id: doctorId,
        clinic_id: doctor.clinic_id,
      },
      orderBy: {
        day_of_week: 'asc',
      },
    });

    // Construir objeto de horarios
    const scheduleObj: Record<string, any> = {
      monday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      tuesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      wednesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      thursday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      friday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      saturday: { enabled: false, startTime: '09:00', endTime: '13:00' },
      sunday: { enabled: false, startTime: '09:00', endTime: '13:00' },
    };

    schedules.forEach((sched) => {
      const dayName = dayNumberToName(sched.day_of_week);
      scheduleObj[dayName] = {
        enabled: sched.enabled ?? false,
        startTime: formatTime(sched.start_time),
        endTime: formatTime(sched.end_time),
        breakStart: sched.break_start ? formatTime(sched.break_start) : undefined,
        breakEnd: sched.break_end ? formatTime(sched.break_end) : undefined,
      };
    });

    console.log('✅ [CLINICS] Horarios del médico obtenidos exitosamente');
    return successResponse({
      doctorId: doctor.id,
      clinicId: doctor.clinic_id,
      schedule: scheduleObj,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener horarios del médico:`, error.message);
    logger.error('Error getting doctor schedule', error);
    if (error.message.includes('Invalid path format')) {
      return errorResponse('Invalid doctor ID', 400);
    }
    return internalErrorResponse('Failed to get doctor schedule');
  }
}

// PUT /api/clinics/doctors/:doctorId/schedule
export async function updateDoctorSchedule(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PUT /api/clinics/doctors/{id}/schedule - Actualizando horarios del médico');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PUT /api/clinics/doctors/{id}/schedule - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const doctorId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/doctors/', '/schedule');
    const body = parseBody(event.body, updateDoctorScheduleSchema);

    // Buscar médico
    const doctor = await prisma.clinic_doctors.findFirst({
      where: { id: doctorId },
      include: {
        clinics: {
          include: {
            clinic_schedules: true,
          },
        },
      },
    });

    if (!doctor) {
      console.error(`❌ [CLINICS] Médico no encontrado: ${doctorId}`);
      return notFoundResponse('Doctor not found');
    }

    if (!doctor.clinic_id) {
      console.error('❌ [CLINICS] Doctor no tiene clínica asignada');
      return errorResponse('Doctor has no clinic assigned', 400);
    }

    // Verificar permisos: solo el médico puede actualizar sus horarios
    if (doctor.user_id !== authContext.user.id) {
      console.error('❌ [CLINICS] Solo el médico puede actualizar sus propios horarios');
      return errorResponse('Forbidden', 403);
    }

    // Validar que los horarios del médico estén dentro de los horarios de la clínica
    // TODO: Implementar validación de horarios de clínica

    // TRANSACCIÓN: Eliminar horarios existentes y crear nuevos
    await prisma.$transaction(async (tx) => {
      // Eliminar horarios existentes
      await tx.doctor_schedules.deleteMany({
        where: {
          doctor_id: doctorId,
          clinic_id: doctor.clinic_id,
        },
      });

      // Crear nuevos horarios
      const scheduleEntries = Object.entries(body.schedule);
      for (const [dayName, daySchedule] of scheduleEntries) {
        if (daySchedule.enabled) {
          const dayOfWeek = dayNameToNumber(dayName);
          const startTime = new Date(`1970-01-01T${daySchedule.startTime}:00Z`);
          const endTime = new Date(`1970-01-01T${daySchedule.endTime}:00Z`);
          const breakStart = daySchedule.breakStart ? new Date(`1970-01-01T${daySchedule.breakStart}:00Z`) : null;
          const breakEnd = daySchedule.breakEnd ? new Date(`1970-01-01T${daySchedule.breakEnd}:00Z`) : null;

          await tx.doctor_schedules.create({
            data: {
              id: randomUUID(),
              doctor_id: doctorId,
              clinic_id: doctor.clinic_id!,
              day_of_week: dayOfWeek,
              enabled: true,
              start_time: startTime,
              end_time: endTime,
              break_start: breakStart,
              break_end: breakEnd,
            },
          });
        }
      }
    });

    // Retornar horarios actualizados
    return await getDoctorSchedule(event);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al actualizar horarios del médico:`, error.message);
    logger.error('Error updating doctor schedule', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update doctor schedule');
  }
}
