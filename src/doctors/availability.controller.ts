import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import {
  addMinutes,
  format,
  isBefore,
  isEqual,
  setHours,
  setMinutes,
  setSeconds,
} from "date-fns";
import { requireAuth } from "../shared/auth";
import { getPrismaClient } from "../shared/prisma";
import { errorResponse, successResponse } from "../shared/response";

const APPOINTMENT_DURATION = 30;

const getEcuadorTime = (): Date => {
  const now = new Date();
  const ecuadorOffset = -5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * -5);
};

export async function getDoctorAvailability(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) {
      return authResult;
    }
    const prisma = getPrismaClient();
    const queryParams = event.queryStringParameters || {};

    // 2. INPUTS
    const doctorId = queryParams.doctorId;
    const branchId = queryParams.branchId;
    const dateString = queryParams.date;

    if (!doctorId || !dateString) {
      return errorResponse(
        "Faltan parámetros requeridos: doctorId y date",
        400,
      );
    }

    const requestDate = new Date(`${dateString}T00:00:00`);
    const dayOfWeek = new Date(dateString).getUTCDay();

    const provider = await prisma.providers.findUnique({
      where: { id: doctorId },
      include: {
        users: {
          include: {
            clinic_doctors: {
              where: { is_active: true },
              take: 1,
            },
          },
        },
      },
    });

    let scheduleSource: any = null;
    let isClinicFlow = false;

    if (
      provider?.users?.clinic_doctors &&
      provider.users.clinic_doctors.length > 0
    ) {
      isClinicFlow = true;
      const clinicDoctor = provider.users.clinic_doctors[0];

      // Doctor de Clínica usando el Horario General de la Clínica
      const clinicSchedule = await prisma.clinic_schedules.findFirst({
        where: {
          clinic_id: clinicDoctor.clinic_id,
          day_of_week: dayOfWeek,
          enabled: true,
        },
      });

      if (
        clinicSchedule &&
        clinicSchedule.start_time &&
        clinicSchedule.end_time
      ) {
        scheduleSource = clinicSchedule;
      }
    } else {
      // Doctor Independiente (Flujo Normal)
      const provSchedule = await prisma.provider_schedules.findFirst({
        where: {
          provider_branches: {
            provider_id: doctorId,
            ...(branchId ? { id: branchId } : {}),
          },
          day_of_week: dayOfWeek,
          is_active: true,
        },
      });

      if (provSchedule && provSchedule.start_time && provSchedule.end_time) {
        scheduleSource = provSchedule;
      }
    }

    if (
      !scheduleSource ||
      !scheduleSource.start_time ||
      !scheduleSource.end_time
    ) {
      return successResponse({
        date: dateString,
        availableSlots: [],
      });
    }

    let allSlots: Date[] = [];

    const startDateTime = mergeDateAndTime(
      requestDate,
      scheduleSource.start_time,
    );
    const endDateTime = mergeDateAndTime(requestDate, scheduleSource.end_time);

    let breakStart: Date | null = null;
    let breakEnd: Date | null = null;
    if (scheduleSource.break_start && scheduleSource.break_end) {
      breakStart = mergeDateAndTime(requestDate, scheduleSource.break_start);
      breakEnd = mergeDateAndTime(requestDate, scheduleSource.break_end);
    }

    let currentSlot = startDateTime;

    // Generación de slots
    while (isBefore(currentSlot, endDateTime)) {
      const slotEnd = addMinutes(currentSlot, APPOINTMENT_DURATION);

      if (isBefore(slotEnd, endDateTime) || isEqual(slotEnd, endDateTime)) {
        let isLunchTime = false;
        if (breakStart && breakEnd) {
          if (
            (currentSlot >= breakStart && currentSlot < breakEnd) ||
            (slotEnd > breakStart && slotEnd <= breakEnd)
          ) {
            isLunchTime = true;
          }
        }

        if (!isLunchTime) {
          allSlots.push(currentSlot);
        }
      }
      currentSlot = addMinutes(currentSlot, APPOINTMENT_DURATION);
    }

    const existingAppointments = await prisma.appointments.findMany({
      where: {
        provider_id: doctorId,
        status: { notIn: ["CANCELLED", "REJECTED", "DELETED"] },
        scheduled_for: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      select: { scheduled_for: true },
    });

    const busyTimestamps = new Set(
      existingAppointments.map((app) => app.scheduled_for?.getTime()),
    );

    allSlots = allSlots.filter((slot) => !busyTimestamps.has(slot.getTime()));

    if (!isClinicFlow) {
      const blockedRanges = await prisma.blocked_slots.findMany({
        where: {
          provider_branches: {
            provider_id: doctorId,
            ...(branchId ? { id: branchId } : {}),
          },
          date: requestDate,
        },
        select: { start_time: true, end_time: true },
      });

      if (blockedRanges.length > 0) {
        allSlots = allSlots.filter((slot) => {
          const isBlocked = blockedRanges.some((block: any) => {
            const blockStart = mergeDateAndTime(requestDate, block.start_time);
            const blockEnd = mergeDateAndTime(requestDate, block.end_time);
            return slot >= blockStart && slot < blockEnd;
          });
          return !isBlocked;
        });
      }
    } else {
      const clinicDoctor = provider?.users?.clinic_doctors?.[0];
      if (clinicDoctor) {
        const blockRequests = await prisma.date_block_requests.findMany({
          where: {
            clinic_id: clinicDoctor.clinic_id,
            doctor_id: clinicDoctor.id,
            date: requestDate,
            status: "approved",
          },
          select: { start_time: true, end_time: true },
        });

        if (blockRequests.length > 0) {
          const isFullDayBlocked = blockRequests.some(
            (block) => !block.start_time || !block.end_time,
          );

          if (isFullDayBlocked) {
            allSlots = [];
          } else {
            allSlots = allSlots.filter((slot) => {
              const isBlocked = blockRequests.some((block: any) => {
                const blockStart = mergeDateAndTime(
                  requestDate,
                  block.start_time,
                );
                const blockEnd = mergeDateAndTime(requestDate, block.end_time);
                return slot >= blockStart && slot < blockEnd;
              });
              return !isBlocked;
            });
          }
        }
      }
    }

    const ecuadorNow = getEcuadorTime();
    const ecuadorDateString = format(ecuadorNow, "yyyy-MM-dd");
    const isToday = dateString === ecuadorDateString;

    if (isToday) {
      const bufferTime = addMinutes(ecuadorNow, 30);

      allSlots = allSlots.filter((slot) => {
        return isBefore(bufferTime, slot);
      });
    } else {
      if (dateString < ecuadorDateString) {
        allSlots = [];
      }
    }

    const availableTimes = allSlots.map((slot) => format(slot, "HH:mm"));

    return successResponse({
      date: dateString,
      availableSlots: availableTimes,
    });
  } catch (error: any) {
    console.error("❌ Error calculating availability:", error);
    return errorResponse("Error al calcular disponibilidad", 500);
  }
}

// --- HELPER FUNCTION ---
function mergeDateAndTime(baseDate: Date, timeDate: Date): Date {
  const hours = timeDate.getUTCHours();
  const minutes = timeDate.getUTCMinutes();

  let newDate = new Date(baseDate);
  newDate = setHours(newDate, hours);
  newDate = setMinutes(newDate, minutes);
  newDate = setSeconds(newDate, 0);
  newDate.setMilliseconds(0);

  return newDate;
}
