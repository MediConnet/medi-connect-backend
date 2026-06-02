import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updateDoctorScheduleSchema, extractIdFromPath } from '../shared/validators';
import {
  buildDefaultWeekSchedule,
  dayNameToNumber,
  mapDbSchedulesToWeek,
  parseTimeToDate,
  validateDoctorScheduleWithinClinic,
  type WeekSchedulePayload,
  type DaySchedulePayload,
  WEEK_DAYS,
} from '../clinics/schedule-helpers';

const LOG = '[ASSOCIATION SCHEDULE]';

async function resolveClinicDoctor(
  doctorIdParam: string,
  authContext: AuthContext,
) {
  const prisma = getPrismaClient();

  if (doctorIdParam === 'me') {
    return prisma.clinic_doctors.findFirst({
      where: {
        user_id: authContext.user.id,
        is_active: true,
      },
      include: {
        clinics: {
          include: {
            clinic_schedules: {
              orderBy: { day_of_week: 'asc' },
            },
          },
        },
      },
    });
  }

  return prisma.clinic_doctors.findFirst({
    where: { id: doctorIdParam },
    include: {
      clinics: {
        include: {
          clinic_schedules: {
            orderBy: { day_of_week: 'asc' },
          },
        },
      },
    },
  });
}

function buildClinicWeekSchedule(doctor: NonNullable<Awaited<ReturnType<typeof resolveClinicDoctor>>>): WeekSchedulePayload {
  const defaults = buildDefaultWeekSchedule('13:00', '18:00');
  const rows = doctor.clinics?.clinic_schedules ?? [];
  return mapDbSchedulesToWeek(rows, defaults);
}

async function loadDoctorWeekSchedule(
  doctorId: string,
  clinicId: string,
): Promise<WeekSchedulePayload> {
  const prisma = getPrismaClient();
  const defaults = buildDefaultWeekSchedule();

  const schedules = await prisma.doctor_schedules.findMany({
    where: {
      doctor_id: doctorId,
      clinic_id: clinicId,
    },
    orderBy: {
      day_of_week: 'asc',
    },
  });

  return mapDbSchedulesToWeek(schedules, defaults);
}

// GET /api/clinics/doctors/:doctorId/schedule  (doctorId puede ser "me")
export async function getDoctorSchedule(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log(`${LOG} GET /api/association/doctors/{id}/schedule`);

  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const authContext = authResult as AuthContext;
    console.log(`${LOG} Usuario autenticado: ${authContext.user.email} (${authContext.user.role})`);

    const path = event.requestContext.http.path;
    const doctorIdParam = extractIdFromPath(
      path,
      '/api/association/doctors/',
      '/schedule',
    );
    console.log(`${LOG} doctorIdParam: ${doctorIdParam}, path: ${path}`);

    const doctor = await resolveClinicDoctor(doctorIdParam, authContext);
    console.log(`${LOG} resolveClinicDoctor result:`, doctor ? `id=${doctor.id}, clinic_id=${doctor.clinic_id}, user_id=${doctor.user_id}` : 'null');

    if (!doctor) {
      console.log(`${LOG} Doctor no encontrado en clinic_doctors`);
      return notFoundResponse('Doctor no encontrado. Debes estar asociado a una clínica.');
    }

    if (!doctor.clinic_id) {
      console.log(`${LOG} Doctor sin clinic_id`);
      return errorResponse('Doctor no asociado a una clínica', 400);
    }

    if (doctor.user_id !== authContext.user.id) {
      const clinic = await getPrismaClient().clinics.findFirst({
        where: {
          id: doctor.clinic_id,
          user_id: authContext.user.id,
        },
      });

      if (!clinic) {
        return errorResponse('Forbidden', 403);
      }
    }

    const clinicSchedule = buildClinicWeekSchedule(doctor);
    console.log(`${LOG} Clinic schedule built:`, Object.keys(clinicSchedule).length > 0 ? 'ok' : 'defaults');

    const schedule = await loadDoctorWeekSchedule(doctor.id, doctor.clinic_id);
    console.log(`${LOG} Doctor schedule loaded`);

    return successResponse({
      doctorId: doctor.id,
      clinicId: doctor.clinic_id,
      clinicSchedule,
      schedule,
    });
  } catch (error: any) {
    console.error(`${LOG} Error al obtener horarios del médico:`, error.message);
    console.error(`${LOG} Stack:`, error.stack?.substring(0, 1000));
    console.error(`${LOG} Error props:`, { message: error.message, name: error.name, code: error.code, meta: error.meta });
    logger.error('Error getting doctor schedule', error);
    if (error.message?.includes('Invalid path format')) {
      return errorResponse('Invalid doctor ID', 400);
    }
    return internalErrorResponse('Error interno al cargar horarios');
  }
}

// PUT /api/clinics/doctors/:doctorId/schedule
export async function updateDoctorSchedule(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log(`${LOG} PUT /api/association/doctors/{id}/schedule`);

  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    const path = event.requestContext.http.path;
    const doctorIdParam = extractIdFromPath(
      path,
      '/api/association/doctors/',
      '/schedule',
    );
    const body = parseBody(event.body, updateDoctorScheduleSchema);

    const doctor = await resolveClinicDoctor(doctorIdParam, authContext);

    if (!doctor) {
      return notFoundResponse('Doctor no encontrado. Debes estar asociado a una clínica.');
    }

    if (!doctor.clinic_id) {
      return errorResponse('Doctor no asociado a una clínica', 400);
    }

    if (doctor.user_id !== authContext.user.id) {
      return errorResponse('Forbidden', 403);
    }

    const clinicSchedule = buildClinicWeekSchedule(doctor);
    const validationError = validateDoctorScheduleWithinClinic(
      body.schedule as WeekSchedulePayload,
      clinicSchedule,
    );

    if (validationError) {
      return errorResponse(validationError, 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.doctor_schedules.deleteMany({
        where: {
          doctor_id: doctor.id,
          clinic_id: doctor.clinic_id!,
        },
      });

      for (const [dayName, daySchedule] of Object.entries(body.schedule)) {
        if (!daySchedule || typeof daySchedule !== 'object' || daySchedule.enabled !== true) {
          continue;
        }

        await tx.doctor_schedules.create({
          data: {
            id: randomUUID(),
            doctor_id: doctor.id,
            clinic_id: doctor.clinic_id!,
            day_of_week: dayNameToNumber(dayName),
            enabled: true,
            start_time: parseTimeToDate(daySchedule.startTime),
            end_time: parseTimeToDate(daySchedule.endTime),
            break_start: daySchedule.breakStart
              ? parseTimeToDate(daySchedule.breakStart)
              : null,
            break_end: daySchedule.breakEnd
              ? parseTimeToDate(daySchedule.breakEnd)
              : null,
          },
        });
      }
    });

    return await getDoctorSchedule(event);
  } catch (error: any) {
    console.error(`${LOG} Error al actualizar horarios del médico:`, error.message);
    console.error(`${LOG} Stack:`, error.stack?.substring(0, 1000));
    logger.error('Error updating doctor schedule', error);
    if (error.message?.includes('Validation error') || error.message?.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Error interno al guardar horarios');
  }
}
