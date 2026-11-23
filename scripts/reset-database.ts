/**
 * Deja la base lista para produccion: borra usuarios, servicios y todo lo que
 * cuelga de ellos, y conserva el catalogo que el sistema necesita para
 * funcionar mas un unico administrador.
 *
 * SE CONSERVA
 *   service_categories, cities, specialties, admin_settings, pharmacy_chains
 *   y el administrador que se indique por parametro.
 *
 * SE BORRA
 *   el resto de tablas de uso (usuarios, proveedores, citas, pagos,
 *   notificaciones, recordatorios, historial...).
 *
 * Uso:
 *   # 1. Simulacion: no escribe nada, solo dice que haria
 *   npx ts-node scripts/reset-database.ts --admin-email=admin@docalink.com
 *
 *   # 2. Ejecucion real
 *   npx ts-node scripts/reset-database.ts --admin-email=admin@docalink.com \
 *       --admin-password='TuClaveSegura123!' --apply
 *
 * El administrador se crea ANTES de borrar: si algo fallara a medias, nunca te
 * quedas sin forma de entrar.
 *
 * ESTO NO SE PUEDE DESHACER.
 */
import * as dotenv from "dotenv";
dotenv.config();

import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { getPrismaClient } from "../src/shared/prisma";

function argumento(nombre: string): string | undefined {
  const pref = `--${nombre}=`;
  const encontrado = process.argv.find((a) => a.startsWith(pref));
  return encontrado ? encontrado.slice(pref.length) : undefined;
}

const APLICAR = process.argv.includes("--apply");
const ADMIN_EMAIL = (argumento("admin-email") || "").trim().toLowerCase();
const ADMIN_PASSWORD = argumento("admin-password") || "";

/**
 * Orden de borrado: de las hojas hacia las raices, para no chocar con las
 * claves foraneas. Aunque varias relaciones son ON DELETE CASCADE, se borran
 * de forma explicita para que el recuento sea real y no dependa de la cascada.
 */
const ORDEN_BORRADO: string[] = [
  // dependen de pagos / clinicas / citas
  "clinic_payment_distributions",
  "reception_messages",
  "date_block_requests",
  "blocked_slots",
  "doctor_schedules",
  "clinic_doctors",
  "clinic_schedules",
  "clinic_specialties",
  "doctor_invitations",
  "comments",
  // dependen de pacientes / citas
  "reviews",
  "medical_history",
  "patient_reminders",
  "patient_favorites",
  "notifications",
  "clinic_notifications",
  // dinero
  "payments",
  "payouts",
  // citas
  "appointments",
  // perfil del proveedor
  "featured_branches",
  "consultation_prices",
  "provider_specialties",
  "provider_catalog",
  "provider_ads",
  "provider_bank_details",
  "provider_schedules",
  "provider_branches",
  "providers",
  "clinics",
  "doctor_bank_accounts",
  // cuentas
  "patients",
  "sessions",
  "password_resets",
];

async function main() {
  const prisma: any = getPrismaClient();

  if (!ADMIN_EMAIL || !ADMIN_EMAIL.includes("@")) {
    console.error("Falta --admin-email=<correo valido>");
    process.exit(1);
  }
  if (APLICAR && ADMIN_PASSWORD.length < 8) {
    console.error("Falta --admin-password= (minimo 8 caracteres) para aplicar");
    process.exit(1);
  }

  console.log(
    APLICAR
      ? "=== EJECUCION REAL — esto borra datos y no se puede deshacer ===\n"
      : "=== SIMULACION — no se escribe nada (agrega --apply para ejecutar) ===\n",
  );

  // ---------------------------------------------------------------- conservar
  console.log("SE CONSERVA (catalogo que el sistema necesita):");
  for (const t of ["service_categories", "cities", "specialties", "admin_settings", "pharmacy_chains"]) {
    console.log(`   ${t.padEnd(22)} ${await prisma[t].count()} filas`);
  }

  // ------------------------------------------------------- admin: crear antes
  console.log(`\nADMINISTRADOR: ${ADMIN_EMAIL}`);
  const existente = await prisma.users.findFirst({
    where: { email: { equals: ADMIN_EMAIL, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  let adminId = existente?.id;

  if (APLICAR) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    if (existente) {
      await prisma.users.update({
        where: { id: existente.id },
        data: { password_hash: hash, role: "admin", is_active: true },
      });
      console.log("   ya existia: se actualizo su contraseña y se dejo como admin activo");
    } else {
      const creado = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: ADMIN_EMAIL,
          password_hash: hash,
          role: "admin",
          is_active: true,
        },
      });
      adminId = creado.id;
      console.log("   creado");
    }
  } else {
    console.log(existente ? "   (ya existe: se le pondria la contraseña nueva)" : "   (se crearia)");
  }

  // -------------------------------------------- catalogo: dejarlo utilizable
  //
  // "Sin cadena" no es una cadena real: era el apaño para registrar farmacias
  // independientes cuando el formulario exigia elegir una. Ese formulario ya
  // acepta "No pertenezco a ninguna cadena", asi que la fila sobra.
  const sinCadena = await prisma.pharmacy_chains.findFirst({
    where: { name: { equals: "Sin cadena", mode: "insensitive" } },
    select: { id: true },
  });

  // Una cadena inactiva no aparece en el desplegable del registro, asi que
  // ninguna farmacia podria elegirla. Se activan todas las reales para que el
  // catalogo quede utilizable.
  const inactivas = await prisma.pharmacy_chains.count({
    where: { is_active: false, ...(sinCadena ? { NOT: { id: sinCadena.id } } : {}) },
  });

  console.log("\nCATALOGO — ajustes:");
  if (sinCadena) {
    console.log(`   cadena "Sin cadena"        ${APLICAR ? "borrada" : "se borraria"}`);
  } else {
    console.log('   cadena "Sin cadena"        no existe');
  }
  console.log(`   cadenas inactivas          ${inactivas} ${APLICAR ? "activadas" : "se activarian"}`);

  if (APLICAR) {
    if (sinCadena) {
      // Las farmacias que la usaban se borran mas abajo; se desvincula por si
      // quedara alguna, para que el borrado de la cadena no falle.
      await prisma.providers.updateMany({
        where: { chain_id: sinCadena.id },
        data: { chain_id: null },
      });
      await prisma.pharmacy_chains.delete({ where: { id: sinCadena.id } });
    }
    await prisma.pharmacy_chains.updateMany({
      where: { is_active: false },
      data: { is_active: true },
    });
  }

  // ---------------------------------------------------------------- borrar
  console.log("\nSE BORRA:");
  let total = 0;

  for (const tabla of ORDEN_BORRADO) {
    let n = 0;
    try {
      n = await prisma[tabla].count();
    } catch {
      console.log(`   ${tabla.padEnd(30)} (tabla no encontrada, se omite)`);
      continue;
    }
    if (n === 0) continue;

    if (APLICAR) {
      const r = await prisma[tabla].deleteMany({});
      console.log(`   ${tabla.padEnd(30)} ${r.count} borradas`);
      total += r.count;
    } else {
      console.log(`   ${tabla.padEnd(30)} ${n} se borrarian`);
      total += n;
    }
  }

  // usuarios: todos menos el admin que se conserva
  const filtroUsuarios = adminId
    ? { id: { not: adminId } }
    : { email: { not: ADMIN_EMAIL } };
  const usuarios = await prisma.users.count({ where: filtroUsuarios });

  if (APLICAR) {
    const r = await prisma.users.deleteMany({ where: filtroUsuarios });
    console.log(`   ${"users".padEnd(30)} ${r.count} borrados (se conserva el admin)`);
    total += r.count;
  } else {
    console.log(`   ${"users".padEnd(30)} ${usuarios} se borrarian (se conserva el admin)`);
    total += usuarios;
  }

  console.log(`\n   TOTAL: ${total} filas`);

  // ---------------------------------------------------------------- verificar
  if (APLICAR) {
    console.log("\n=== VERIFICACION ===");
    const quedanUsuarios = await prisma.users.findMany({
      select: { email: true, role: true, is_active: true },
    });
    console.log(`   usuarios restantes: ${quedanUsuarios.length}`);
    for (const u of quedanUsuarios) {
      console.log(`      ${u.email} (${u.role}) activo=${u.is_active}`);
    }

    let sobrantes = 0;
    for (const t of ORDEN_BORRADO) {
      try {
        const n = await prisma[t].count();
        if (n > 0) {
          console.log(`   ATENCION: ${t} todavia tiene ${n} filas`);
          sobrantes += n;
        }
      } catch {
        /* tabla inexistente */
      }
    }
    console.log(sobrantes === 0 ? "   sin restos en las tablas de uso" : `   quedan ${sobrantes} filas por revisar`);

    for (const t of ["service_categories", "cities", "specialties", "admin_settings", "pharmacy_chains"]) {
      console.log(`   catalogo ${t.padEnd(22)} ${await prisma[t].count()} filas`);
    }

    const cadenas = await prisma.pharmacy_chains.findMany({
      select: { name: true, is_active: true },
      orderBy: { name: "asc" },
    });
    console.log("   cadenas de farmacia que quedan:");
    for (const c of cadenas) {
      console.log(`      ${String(c.name).padEnd(24)} activa=${c.is_active}`);
    }
  } else {
    console.log("\nPara ejecutarlo de verdad, repite el comando agregando:");
    console.log("   --admin-password='TuClaveSegura' --apply");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
