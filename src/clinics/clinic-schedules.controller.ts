import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from '../shared/response';
import { parseBody, clinicScheduleSchema } from '../shared/validators';
import { resolveClinicForAuthUser } from './clinic-context';

// Helper para convertir número de día a nombre
function dayNumberToName(day: number): string {
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  if (day >= 0 && day <= 6) {
    return days[day];
  }
  return 'monday';
}

// Helper para convertir nombre de día a número
function dayNameToNumber(day: string): number {
  const map: Record<string, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };
  return map[day.toLowerCase()] ?? 0;
}

// Helper para formatear Time a string HH:mm
function formatTime(time: Date | null): string {
  if (!time) return '09:00';
  const date = new Date(time);
  // Usar UTC para evitar problemas de zona horaria
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

// GET /api/clinics/schedule
export async function getClinicSchedule(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/schedule - Obteniendo horarios de la clínica');

  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/schedule - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const { clinic: baseClinic } = await resolveClinicForAuthUser(
      authContext.user.id,
    );
    if (!baseClinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    const clinic = await prisma.clinics.findFirst({
      where: { id: baseClinic.id },
      include: {
        clinic_schedules: {
          orderBy: {
            day_of_week: 'asc',
          },
        },
      },
    });

    if (!clinic) {
      return notFoundResponse('Clinic not found');
    }

    // Construir objeto de horarios con valores por defecto
    const schedule: Record<string, any> = {
      monday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      tuesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      wednesday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      thursday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      friday: { enabled: false, startTime: '09:00', endTime: '17:00' },
      saturday: { enabled: false, startTime: '09:00', endTime: '13:00' },
      sunday: { enabled: false, startTime: '09:00', endTime: '13:00' },
    };

    // Mapear horarios de la BD
    console.log(`📊 [CLINICS] Horarios encontrados en BD: ${clinic.clinic_schedules.length}`);
    clinic.clinic_schedules.forEach((sched) => {
      console.log(`   - day_of_week: ${sched.day_of_week}, enabled: ${sched.enabled}, start: ${sched.start_time}, end: ${sched.end_time}`);
      const dayName = dayNumberToName(sched.day_of_week);
      if (schedule[dayName]) {
        schedule[dayName] = {
          enabled: sched.enabled ?? false,
          startTime: formatTime(sched.start_time),
          endTime: formatTime(sched.end_time),
        };
      }
    });

    console.log('✅ [CLINICS] Horarios de la clínica obtenidos exitosamente');
    console.log('📤 [CLINICS] Horarios a enviar:', JSON.stringify(schedule, null, 2));
    return successResponse({
      clinicId: clinic.id,
      schedule,
    });
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al obtener horarios de la clínica:', error.message);
    logger.error('Error getting clinic schedule', error);
    return internalErrorResponse('Failed to get clinic schedule');
  }
}

// PUT /api/clinics/schedule
export async function updateClinicSchedule(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PUT /api/clinics/schedule - Actualizando horarios de la clínica');

  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PUT /api/clinics/schedule - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Parsear body - espera { schedule: { monday: {...}, ... } }
    const bodySchema = z.object({
      schedule: clinicScheduleSchema,
    });
    const body = parseBody(event.body, bodySchema);

    const { clinic } = await resolveClinicForAuthUser(authContext.user.id);

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    console.log('📝 [CLINICS] Horarios recibidos:', JSON.stringify(body.schedule, null, 2));

    // TRANSACCIÓN: Eliminar horarios existentes y crear nuevos
    await prisma.$transaction(async (tx) => {
      // Eliminar horarios existentes
      await tx.clinic_schedules.deleteMany({
        where: { clinic_id: clinic.id },
      });

      console.log('🗑️ [CLINICS] Horarios anteriores eliminados');

      // Crear nuevos horarios
      const scheduleEntries = Object.entries(body.schedule);
      for (const [dayName, daySchedule] of scheduleEntries) {
        if (!daySchedule || typeof daySchedule !== 'object') {
          console.warn(`⚠️ [CLINICS] Horario inválido para ${dayName}, omitiendo...`);
          continue;
        }

        const isEnabled = daySchedule.enabled === true;

        if (isEnabled) {
          const dayOfWeek = dayNameToNumber(dayName);
          const startTime = daySchedule.startTime
            ? new Date(`1970-01-01T${daySchedule.startTime}:00Z`)
            : new Date('1970-01-01T09:00:00Z');
          const endTime = daySchedule.endTime
            ? new Date(`1970-01-01T${daySchedule.endTime}:00Z`)
            : new Date('1970-01-01T17:00:00Z');

          // Validar horarios
          // Permitir horarios nocturnos que cruzan medianoche (ej: 21:00 - 07:00)
          // Solo rechazar si son exactamente iguales
          if (startTime.getTime() === endTime.getTime()) {
            throw new Error(`Invalid time range for ${dayName}: startTime and endTime cannot be the same`);
          }

          // Log para debugging de horarios nocturnos
          if (startTime > endTime) {
            console.log(`🌙 [CLINICS] ${dayName}: Horario nocturno detectado (${daySchedule.startTime} - ${daySchedule.endTime})`);
          }

          await tx.clinic_schedules.create({
            data: {
              id: randomUUID(),
              clinic_id: clinic.id,
              day_of_week: dayOfWeek,
              enabled: true,
              start_time: startTime,
              end_time: endTime,
            },
          });

          console.log(`✅ [CLINICS] Horario guardado para ${dayName}: ${daySchedule.startTime} - ${daySchedule.endTime}`);
        } else {
          console.log(`⏭️ [CLINICS] ${dayName} deshabilitado, no se guarda`);
        }
      }
    });

    console.log('✅ [CLINICS] Todos los horarios actualizados exitosamente');

    // Retornar horarios actualizados
    return await getClinicSchedule(event);
  } catch (error: any) {
    console.error('❌ [CLINICS] Error al actualizar horarios de la clínica:', error.message);
    logger.error('Error updating clinic schedule', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid time range')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update clinic schedule');
  }
}
