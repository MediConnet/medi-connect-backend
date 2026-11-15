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

/**
 * Minutos entre turnos cuando el proveedor no configuro una duracion propia.
 * La duracion real sale de providers.appointment_duration_minutes.
 */
const DURACION_POR_DEFECTO = 30;

function formatEcuadorDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatEcuadorTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guayaquil',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

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

    // IMPORTANTE: parsear la fecha como local (no UTC) para evitar
    // desfase de día en zonas horarias negativas como Ecuador (UTC-5).
    // "2026-06-09" + "T00:00:00" = medianoche local → día correcto.
    const requestDate = new Date(`${dateString}T00:00:00.000Z`);
    const dayOfWeek = new Date(`${dateString}T12:00:00.000Z`).getUTCDay(); // 0=Dom, 1=Lun, ... 6=Sáb

    console.log(`🗓️ [AVAILABILITY] Doctor: ${doctorId}, Fecha: ${dateString}, DíaSemana: ${dayOfWeek} (0=Dom,1=Lun,2=Mar,3=Mié,4=Jue,5=Vie,6=Sáb)`);

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

    console.log(`👨‍⚕️ [AVAILABILITY] Provider encontrado: ${provider ? 'Sí' : 'No'}`);
    console.log(`🏥 [AVAILABILITY] Es de clínica: ${provider?.users?.clinic_doctors && provider.users.clinic_doctors.length > 0 ? 'Sí' : 'No'}`);

    let scheduleSource: any = null;
    let isClinicFlow = false;

    if (
      provider?.users?.clinic_doctors &&
      provider.users.clinic_doctors.length > 0
    ) {
      isClinicFlow = true;
      const clinicDoctor = provider.users.clinic_doctors[0];
      const dbDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      console.log(`🏥 [AVAILABILITY] Buscando horario de clínica/doctor: doctor_id: ${clinicDoctor.id}, clinic_id: ${clinicDoctor.clinic_id}, día: ${dayOfWeek} (DB: ${dbDayOfWeek})`);

      // Verificar si el doctor tiene un horario personalizado configurado en esta clínica
      const hasCustomSchedule = await prisma.doctor_schedules.count({
        where: {
          doctor_id: clinicDoctor.id,
          clinic_id: clinicDoctor.clinic_id ?? undefined,
        },
      }) > 0;

      if (hasCustomSchedule) {
        console.log(`🏥 [AVAILABILITY] El doctor tiene horario personalizado. Buscando para el día: ${dayOfWeek} (DB: ${dbDayOfWeek})`);
        const customSchedule = await prisma.doctor_schedules.findFirst({
          where: {
            doctor_id: clinicDoctor.id,
            clinic_id: clinicDoctor.clinic_id ?? undefined,
            day_of_week: dbDayOfWeek,
            enabled: true,
          },
        });

        console.log(`🏥 [AVAILABILITY] Horario personalizado del doctor encontrado: ${customSchedule ? `${customSchedule.start_time} - ${customSchedule.end_time}` : 'NINGUNO'}`);

        if (
          customSchedule &&
          customSchedule.start_time &&
          customSchedule.end_time
        ) {
          scheduleSource = customSchedule;
        }
      } else {
        // Fallback al horario general de la clínica
        console.log(`🏥 [AVAILABILITY] El doctor NO tiene horario personalizado. Usando horario general de la clínica.`);
        const clinicSchedule = await prisma.clinic_schedules.findFirst({
          where: {
            clinic_id: clinicDoctor.clinic_id ?? undefined,
            day_of_week: dbDayOfWeek,
            enabled: true,
          },
        });

        console.log(`🏥 [AVAILABILITY] Horario de clínica encontrado: ${clinicSchedule ? `${clinicSchedule.start_time} - ${clinicSchedule.end_time}` : 'NINGUNO'}`);

        if (
          clinicSchedule &&
          clinicSchedule.start_time &&
          clinicSchedule.end_time
        ) {
          scheduleSource = clinicSchedule;
        }
      }
    } else {
      // Doctor Independiente (Flujo Normal)
      console.log(`👨‍⚕️ [AVAILABILITY] Buscando horario independiente para doctor: ${doctorId}, día: ${dayOfWeek}`);

      const provSchedule = await prisma.provider_schedules.findFirst({
        where: {
          provider_branches: {
            provider_id: doctorId,
          },
          day_of_week: dayOfWeek,
          is_active: true,
        },
      });

      console.log(`👨‍⚕️ [AVAILABILITY] Horario independiente encontrado: ${provSchedule ? `${provSchedule.start_time} - ${provSchedule.end_time}` : 'NINGUNO'}`);

      if (provSchedule && provSchedule.start_time && provSchedule.end_time) {
        scheduleSource = provSchedule;
      }
    }

    if (
      !scheduleSource ||
      !scheduleSource.start_time ||
      !scheduleSource.end_time
    ) {
      console.log(`⚠️ [AVAILABILITY] Sin horario configurado para este día → retornando slots vacíos`);
      return successResponse({
        date: dateString,
        availableSlots: [],
      });
    }


    let allSlots: Date[] = [];

    const startDateTime = mergeDateAndTime(
      dateString,
      scheduleSource.start_time,
    );
    const endDateTime = mergeDateAndTime(dateString, scheduleSource.end_time);

    let breakStart: Date | null = null;
    let breakEnd: Date | null = null;
    if (scheduleSource.break_start && scheduleSource.break_end) {
      breakStart = mergeDateAndTime(dateString, scheduleSource.break_start);
      breakEnd = mergeDateAndTime(dateString, scheduleSource.break_end);
    }

    let currentSlot = startDateTime;

    // Duracion de cita del proveedor: define cada cuanto arranca un turno.
    const { duracion: duracionCita } = await leerAgendaDelProveedor(prisma, doctorId);

    // Generación de slots
    while (isBefore(currentSlot, endDateTime)) {
      const slotEnd = addMinutes(currentSlot, duracionCita);

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
      currentSlot = addMinutes(currentSlot, duracionCita);
    }

    const existingAppointments = await prisma.appointments.findMany({
      where: {
        provider_id: doctorId,
        status: { notIn: ["CANCELLED", "REJECTED", "DELETED"] },
        scheduled_for: {
          // Se mira un poco antes del inicio de la jornada: una cita que
          // arranco antes puede seguir ocupando el primer turno.
          gte: addMinutes(startDateTime, -24 * 60),
          lte: endDateTime,
        },
      },
      select: { scheduled_for: true },
    });

    // Un turno esta ocupado si se SOLAPA con una cita, no solo si empieza en el
    // mismo minuto. Con citas de 60 min y turnos de 30, comparar solo el inicio
    // dejaba libre la media hora siguiente y permitia encimar dos citas.
    const rangosOcupados = existingAppointments
      .filter((app) => !!app.scheduled_for)
      .map((app) => {
        const inicio = app.scheduled_for!.getTime();
        return { inicio, fin: inicio + duracionCita * 60 * 1000 };
      });

    allSlots = allSlots.filter((slot) => {
      const inicio = slot.getTime();
      const fin = inicio + duracionCita * 60 * 1000;
      return !rangosOcupados.some((r) => inicio < r.fin && fin > r.inicio);
    });

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
            const blockStart = mergeDateAndTime(dateString, block.start_time);
            const blockEnd = mergeDateAndTime(dateString, block.end_time);
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
                  dateString,
                  block.start_time,
                );
                const blockEnd = mergeDateAndTime(dateString, block.end_time);
                return slot >= blockStart && slot < blockEnd;
              });
              return !isBlocked;
            });
          }
        }
      }
    }

    // Horas bloqueadas de forma recurrente desde el panel ("Bloquear horas
    // especificas"). Se guardan en providers.documents.blockedHoursByDay con la
    // clave del dia en ingles, y hasta ahora la agenda publica no las leia: el
    // panel mostraba la hora bloqueada y los pacientes la seguian viendo libre.
    const NOMBRES_DIA = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    const { documents: documentosProveedor } = await leerAgendaDelProveedor(
      prisma,
      doctorId,
    );

    const bloqueosPorDia =
      documentosProveedor && typeof documentosProveedor === "object"
        ? ((documentosProveedor as any).blockedHoursByDay as
            | Record<string, string[]>
            | undefined)
        : undefined;

    const claveDia = NOMBRES_DIA[dayOfWeek] || "";
    const horasBloqueadas = Array.isArray(bloqueosPorDia?.[claveDia])
      ? bloqueosPorDia![claveDia].filter((h) => typeof h === "string")
      : [];

    if (horasBloqueadas.length > 0) {
      const bloqueadas = new Set(horasBloqueadas);
      const antes = allSlots.length;
      allSlots = allSlots.filter((slot) => !bloqueadas.has(formatEcuadorTime(slot)));
      console.log(
        `\u{1F512} [AVAILABILITY] ${antes - allSlots.length} hora(s) descartadas por bloqueo recurrente del ${claveDia}: ${horasBloqueadas.join(", ")}`,
      );
    }

    const ecuadorNow = new Date();
    const ecuadorDateString = formatEcuadorDate(ecuadorNow);
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

    const availableTimes = allSlots.map((slot) => formatEcuadorTime(slot));

    return successResponse({
      date: dateString,
      availableSlots: availableTimes,
    });
  } catch (error: any) {
    console.error("❌ Error calculating availability:", error);
    return errorResponse("Error al calcular disponibilidad", 500);
  }
}

/**
 * Lee la duracion de cita del proveedor y sus bloqueos recurrentes.
 *
 * La consulta va protegida porque `appointment_duration_minutes` se agrega en
 * una migracion: entre que se despliega el codigo y se corre la migracion, la
 * columna no existe y Prisma falla (P2022). En esa ventana se usa la duracion
 * por defecto en vez de dejar la agenda caida.
 */
async function leerAgendaDelProveedor(
  prisma: any,
  providerId: string,
): Promise<{ duracion: number; documents: any }> {
  try {
    const proveedor = await prisma.providers.findUnique({
      where: { id: providerId },
      select: { appointment_duration_minutes: true, documents: true },
    });
    const duracion =
      proveedor?.appointment_duration_minutes && proveedor.appointment_duration_minutes > 0
        ? proveedor.appointment_duration_minutes
        : DURACION_POR_DEFECTO;
    return { duracion, documents: proveedor?.documents };
  } catch (error: any) {
    if (error?.code === "P2022") {
      console.warn(
        "[AVAILABILITY] Falta la columna appointment_duration_minutes: ejecuta la migracion. Se usa la duracion por defecto.",
      );
      const proveedor = await prisma.providers.findUnique({
        where: { id: providerId },
        select: { documents: true },
      });
      return { duracion: DURACION_POR_DEFECTO, documents: proveedor?.documents };
    }
    throw error;
  }
}

/**
 * Segunda capa: comprueba en el servidor que una hora pedida cae dentro del
 * horario real del proveedor.
 *
 * La app solo ofrece turnos validos, pero el alta de citas no miraba el horario
 * en absoluto: una peticion armada a mano podia agendar un domingo a las 3 de
 * la manana, fuera de la jornada, en el almuerzo o en una hora bloqueada.
 *
 * Devuelve null si todo esta bien, o el motivo del rechazo.
 */
export async function validarHorarioDelProveedor(
  prisma: any,
  providerId: string,
  scheduledFor: Date,
): Promise<string | null> {
  // El dia de la semana se calcula desde la fecha local de Ecuador.
  const fechaEcuador = formatEcuadorDate(scheduledFor);
  const [anio, mes, dia] = fechaEcuador.split("-").map(Number);
  const diaDeLaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();

  const horario = await prisma.provider_schedules.findFirst({
    where: {
      provider_branches: { provider_id: providerId },
      day_of_week: diaDeLaSemana,
      is_active: true,
    },
  });

  if (!horario || !horario.start_time || !horario.end_time) {
    return "El proveedor no atiende ese día.";
  }

  const inicio = mergeDateAndTime(fechaEcuador, horario.start_time);
  const fin = mergeDateAndTime(fechaEcuador, horario.end_time);

  const { duracion, documents: documentosProveedor } = await leerAgendaDelProveedor(
    prisma,
    providerId,
  );

  const finCita = addMinutes(scheduledFor, duracion);

  if (scheduledFor < inicio || finCita > fin) {
    return "La hora seleccionada está fuera del horario de atención.";
  }

  // Tiene que caer en la rejilla de turnos, contada desde la hora de apertura.
  const minutosDesdeInicio = (scheduledFor.getTime() - inicio.getTime()) / 60000;
  if (minutosDesdeInicio % duracion !== 0) {
    return "La hora seleccionada no corresponde a un turno válido.";
  }

  if (horario.break_start && horario.break_end) {
    const descansoInicio = mergeDateAndTime(fechaEcuador, horario.break_start);
    const descansoFin = mergeDateAndTime(fechaEcuador, horario.break_end);
    if (scheduledFor < descansoFin && finCita > descansoInicio) {
      return "La hora seleccionada cae en el horario de descanso.";
    }
  }

  // Bloqueos recurrentes guardados desde el panel.
  const NOMBRES_DIA = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const bloqueosPorDia =
    documentosProveedor && typeof documentosProveedor === "object"
      ? ((documentosProveedor as any).blockedHoursByDay as Record<string, string[]> | undefined)
      : undefined;
  const horasBloqueadas = bloqueosPorDia?.[NOMBRES_DIA[diaDeLaSemana]] || [];
  if (
    Array.isArray(horasBloqueadas) &&
    horasBloqueadas.includes(formatEcuadorTime(scheduledFor))
  ) {
    return "El proveedor bloqueó ese horario.";
  }

  // Bloqueos puntuales para esa fecha.
  const bloqueosFecha = await prisma.blocked_slots.findMany({
    where: {
      provider_branches: { provider_id: providerId },
      date: new Date(`${fechaEcuador}T00:00:00.000Z`),
    },
    select: { start_time: true, end_time: true },
  });

  for (const bloqueo of bloqueosFecha) {
    const bInicio = mergeDateAndTime(fechaEcuador, bloqueo.start_time);
    const bFin = mergeDateAndTime(fechaEcuador, bloqueo.end_time);
    if (scheduledFor < bFin && finCita > bInicio) {
      return "El proveedor bloqueó ese horario.";
    }
  }

  return null;
}

// --- HELPER FUNCTION ---
function mergeDateAndTime(dateStr: string, timeDate: Date): Date {
  const hours = timeDate.getUTCHours();
  const minutes = timeDate.getUTCMinutes();
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return new Date(`${dateStr}T${hh}:${mm}:00.000-05:00`);
}
