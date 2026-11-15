/**
 * Comprueba que la validacion de horario del backend acepta exactamente los
 * turnos que la agenda ofrece, y rechaza lo que esta fuera.
 *
 * SOLO LECTURA: no crea ni modifica nada.
 *
 *   npx ts-node scripts/test-schedule-validation.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import { getPrismaClient } from "../src/shared/prisma";
import { validarHorarioDelProveedor } from "../src/doctors/availability.controller";

const resultados: boolean[] = [];
function probar(nombre: string, ok: boolean, detalle = "") {
  resultados.push(ok);
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre}${detalle ? "  -> " + detalle : ""}`);
}

/** Construye la fecha/hora en Ecuador (UTC-5), igual que el alta de citas. */
const enEcuador = (fecha: string, hora: string) =>
  new Date(`${fecha}T${hora}:00-05:00`);

/** Proxima fecha (YYYY-MM-DD) para un dia de la semana dado. */
function proximaFechaPara(diaSemana: number): string {
  const hoy = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(hoy.getTime() + i * 24 * 60 * 60 * 1000);
    const iso = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const [a, m, dd] = iso.split("-").map(Number);
    if (new Date(Date.UTC(a, m - 1, dd)).getUTCDay() === diaSemana) return iso;
  }
  return "";
}

const hhmm = (t: Date) =>
  `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;

async function main() {
  const prisma = getPrismaClient();

  // Se prefiere un proveedor que tenga horas bloqueadas desde el panel, para
  // que esa parte de la prueba no quede sin ejercitar.
  const conBloqueos = await prisma.providers.findMany({
    select: { id: true, documents: true },
  });
  const idsConBloqueos = conBloqueos
    .filter((p) => {
      const d = p.documents && typeof p.documents === "object" ? (p.documents as any) : {};
      const porDia = d.blockedHoursByDay;
      return (
        porDia &&
        typeof porDia === "object" &&
        Object.values(porDia).some((h) => Array.isArray(h) && h.length > 0)
      );
    })
    .map((p) => p.id);

  // Y dentro de ese proveedor, el dia que tiene bloqueos.
  const NOMBRES_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const diasConBloqueos = new Set<number>();
  for (const p of conBloqueos) {
    const d = p.documents && typeof p.documents === "object" ? (p.documents as any) : {};
    for (const [dia, horas] of Object.entries(d.blockedHoursByDay || {})) {
      if (Array.isArray(horas) && horas.length > 0) {
        const idx = NOMBRES_EN.indexOf(String(dia).toLowerCase());
        if (idx >= 0) diasConBloqueos.add(idx);
      }
    }
  }

  const horario =
    (idsConBloqueos.length > 0
      ? await prisma.provider_schedules.findFirst({
          where: {
            is_active: true,
            start_time: { not: null },
            end_time: { not: null },
            provider_branches: { provider_id: { in: idsConBloqueos } },
            ...(diasConBloqueos.size > 0
              ? { day_of_week: { in: [...diasConBloqueos] } }
              : {}),
          },
          include: { provider_branches: { select: { provider_id: true } } },
        })
      : null) ||
    (await prisma.provider_schedules.findFirst({
      where: { is_active: true, start_time: { not: null }, end_time: { not: null } },
      include: { provider_branches: { select: { provider_id: true } } },
    }));

  if (!horario?.provider_branches?.provider_id) {
    console.log("No hay ningun horario activo en la base; nada que probar.");
    return;
  }

  const providerId = horario.provider_branches.provider_id;
  // La columna de duracion puede no existir todavia (migracion pendiente).
  let prov: any;
  try {
    prov = await prisma.providers.findUnique({
      where: { id: providerId },
      select: { commercial_name: true, appointment_duration_minutes: true, documents: true },
    });
  } catch (e: any) {
    if (e?.code !== "P2022") throw e;
    console.log("(aviso) falta la columna appointment_duration_minutes: migracion pendiente");
    prov = await prisma.providers.findUnique({
      where: { id: providerId },
      select: { commercial_name: true, documents: true },
    });
  }

  const dia = horario.day_of_week ?? 1;
  const fecha = proximaFechaPara(dia);
  const apertura = hhmm(horario.start_time!);
  const cierre = hhmm(horario.end_time!);
  const duracion = prov?.appointment_duration_minutes ?? 30;

  const nombresDia = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  console.log(`Proveedor: ${prov?.commercial_name}`);
  console.log(`Dia: ${nombresDia[dia]} (${fecha})  Jornada: ${apertura}-${cierre}  Turnos de ${duracion} min\n`);

  // --- Lo que debe ACEPTAR ---
  console.log("=== horas validas ===");
  const r1 = await validarHorarioDelProveedor(prisma, providerId, enEcuador(fecha, apertura));
  probar(`primera hora de la jornada (${apertura})`, r1 === null, r1 || "");

  // Siguiente turno que NO este bloqueado por el proveedor: si se tomara el
  // siguiente sin mas, podria coincidir con una hora bloqueada y el rechazo
  // seria correcto, no un fallo.
  const docsPrev = prov?.documents && typeof prov.documents === "object" ? (prov.documents as any) : {};
  const bloqueadasDelDia: string[] =
    docsPrev.blockedHoursByDay?.[
      ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dia]
    ] || [];

  const [h, m] = apertura.split(":").map(Number);
  let siguiente = "";
  for (let i = 1; i <= 6; i++) {
    const t = new Date(Date.UTC(2000, 0, 1, h, m) + i * duracion * 60000);
    const hhmmT = `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
    if (hhmmT >= cierre) break;
    if (!bloqueadasDelDia.includes(hhmmT)) {
      siguiente = hhmmT;
      break;
    }
  }

  if (siguiente) {
    const r2 = await validarHorarioDelProveedor(prisma, providerId, enEcuador(fecha, siguiente));
    probar(`siguiente turno libre (${siguiente})`, r2 === null, r2 || "");
  } else {
    console.log("     (no hay un segundo turno libre ese dia)");
  }

  // --- Lo que debe RECHAZAR ---
  console.log("\n=== horas invalidas ===");
  const r3 = await validarHorarioDelProveedor(prisma, providerId, enEcuador(fecha, "03:00"));
  probar("madrugada (03:00)", r3 !== null, r3 || "la acepto");

  const r4 = await validarHorarioDelProveedor(prisma, providerId, enEcuador(fecha, cierre));
  probar(`la hora de cierre (${cierre}) no cabe`, r4 !== null, r4 || "la acepto");

  const desalineado = `${apertura.split(":")[0]}:${apertura.endsWith("00") ? "07" : "37"}`;
  const r5 = await validarHorarioDelProveedor(prisma, providerId, enEcuador(fecha, desalineado));
  probar(`fuera de la rejilla (${desalineado})`, r5 !== null, r5 || "la acepto");

  // --- Bloqueos recurrentes ---
  const docs = prov?.documents && typeof prov.documents === "object" ? (prov.documents as any) : {};
  const nombresEn = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const bloqueadas: string[] = docs.blockedHoursByDay?.[nombresEn[dia]] || [];
  console.log("\n=== bloqueos recurrentes del panel ===");
  if (bloqueadas.length === 0) {
    console.log("     (este proveedor no tiene horas bloqueadas ese dia)");
  } else {
    for (const hora of bloqueadas) {
      const r = await validarHorarioDelProveedor(prisma, providerId, enEcuador(fecha, hora));
      probar(`hora bloqueada ${hora} se rechaza`, r !== null, r || "la acepto");
    }
  }

  const fallos = resultados.filter((x) => !x).length;
  console.log(`\n=== ${resultados.length - fallos}/${resultados.length} correctos ===`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
