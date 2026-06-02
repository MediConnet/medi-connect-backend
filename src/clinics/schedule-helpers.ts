export const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekDayName = (typeof WEEK_DAYS)[number];

export type DaySchedulePayload = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
};

export type WeekSchedulePayload = Record<WeekDayName, DaySchedulePayload>;

export function dayNumberToName(day: number): WeekDayName {
  return WEEK_DAYS[day] ?? "monday";
}

export function dayNameToNumber(day: string): number {
  const index = WEEK_DAYS.indexOf(day.toLowerCase() as WeekDayName);
  return index >= 0 ? index : 0;
}

export function formatTime(time: Date | null): string {
  if (!time) return "09:00";
  const date = new Date(time);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export function parseTimeToDate(time: string): Date {
  return new Date(`1970-01-01T${time}:00Z`);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

export function buildDefaultWeekSchedule(
  weekendEnd = "13:00",
  weekdayEnd = "17:00",
): WeekSchedulePayload {
  const base = (endTime: string): DaySchedulePayload => ({
    enabled: false,
    startTime: "09:00",
    endTime,
    breakStart: null,
    breakEnd: null,
  });

  return {
    monday: base(weekdayEnd),
    tuesday: base(weekdayEnd),
    wednesday: base(weekdayEnd),
    thursday: base(weekdayEnd),
    friday: base(weekdayEnd),
    saturday: base(weekendEnd),
    sunday: base(weekendEnd),
  };
}

export function mapDbSchedulesToWeek(
  rows: Array<{
    day_of_week: number;
    enabled: boolean | null;
    start_time: Date | null;
    end_time: Date | null;
    break_start?: Date | null;
    break_end?: Date | null;
  }>,
  defaults: WeekSchedulePayload,
): WeekSchedulePayload {
  const scheduleObj: WeekSchedulePayload = { ...defaults };

  rows.forEach((sched) => {
    const dayName = dayNumberToName(sched.day_of_week ?? 0);
    scheduleObj[dayName] = {
      enabled: sched.enabled ?? false,
      startTime: formatTime(sched.start_time),
      endTime: formatTime(sched.end_time),
      breakStart: sched.break_start ? formatTime(sched.break_start) : null,
      breakEnd: sched.break_end ? formatTime(sched.break_end) : null,
    };
  });

  return scheduleObj;
}

const dayLabelsEs: Record<WeekDayName, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export function validateDoctorScheduleWithinClinic(
  doctorSchedule: WeekSchedulePayload,
  clinicSchedule: WeekSchedulePayload,
): string | null {
  for (const day of WEEK_DAYS) {
    const doctorDay = doctorSchedule[day];
    const clinicDay = clinicSchedule[day];
    const label = dayLabelsEs[day];

    if (!doctorDay?.enabled) {
      continue;
    }

    if (!clinicDay?.enabled) {
      return `No puedes habilitar ${label}: la clínica está cerrada ese día.`;
    }

    const clinicStart = timeToMinutes(clinicDay.startTime);
    const clinicEnd = timeToMinutes(clinicDay.endTime);
    const doctorStart = timeToMinutes(doctorDay.startTime);
    const doctorEnd = timeToMinutes(doctorDay.endTime);

    if (doctorStart >= doctorEnd) {
      return `El horario de ${label} debe terminar después de iniciar.`;
    }

    if (doctorStart < clinicStart || doctorEnd > clinicEnd) {
      return `El horario de ${label} (${doctorDay.startTime}–${doctorDay.endTime}) debe estar dentro del horario de la clínica (${clinicDay.startTime}–${clinicDay.endTime}).`;
    }

    const hasBreakStart = Boolean(doctorDay.breakStart);
    const hasBreakEnd = Boolean(doctorDay.breakEnd);

    if (hasBreakStart !== hasBreakEnd) {
      return `Completa el almuerzo en ${label} o déjalo vacío.`;
    }

    if (hasBreakStart && hasBreakEnd) {
      const breakStart = timeToMinutes(doctorDay.breakStart!);
      const breakEnd = timeToMinutes(doctorDay.breakEnd!);

      if (breakStart >= breakEnd) {
        return `El almuerzo de ${label} debe terminar después de iniciar.`;
      }

      if (breakStart < doctorStart || breakEnd > doctorEnd) {
        return `El almuerzo de ${label} debe estar dentro de tu horario de atención.`;
      }
    }
  }

  return null;
}
