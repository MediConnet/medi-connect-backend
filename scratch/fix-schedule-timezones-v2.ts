import * as dotenv from 'dotenv';
dotenv.config();
import { getPrismaClient } from '../src/shared/prisma';

/**
 * FIX SCRIPT V2
 *
 * Problem: PostgreSQL TIME columns are timezone-unaware. Prisma reads them
 * as Date objects at epoch 1970-01-01 UTC. When the server is in UTC-5 (Ecuador),
 * a time of "20:00" stored as "20:00:00" in PostgreSQL is read by Prisma as
 * a UTC timestamp "1970-01-01T20:00:00Z", which in local time (UTC-5) = "19:00"
 * — but worse, a time like "00:00" UTC becomes "1969-12-31T19:00:00 UTC-5".
 *
 * After our code fix (using getHours() instead of getUTCHours()), times that were
 * correctly stored (e.g., 08:00 stored as 08:00 UTC) are read fine as 03:00 UTC-5
 * → getHours() returns 3.
 *
 * Wait — this is confusing. Let's use RAW SQL to see what's actually in the DB.
 * 
 * The key insight: we read the raw TEXT representation from PG to see the TRUE stored value,
 * then we write back the correct local-time value using Prisma's new behavior.
 */

async function getRawTime(prisma: any, table: string, id: string, col: string): Promise<string> {
  const result = await prisma.$queryRawUnsafe(
    `SELECT ${col}::text AS t FROM ${table} WHERE id = $1::uuid`,
    id
  );
  return result[0]?.t ?? null;
}

async function fixTable(
  prisma: any,
  tableName: string,
  records: any[],
  timeColumns: string[],
  updateFn: (id: string, updates: Record<string, Date | null>) => Promise<void>
) {
  let fixedCount = 0;

  for (const rec of records) {
    const updates: Record<string, Date | null> = {};
    let needsUpdate = false;

    for (const col of timeColumns) {
      if (!rec[col]) continue;
      
      // Get the raw value from DB (e.g. "20:00:00")
      const rawTime = await getRawTime(prisma, tableName, rec.id, col);
      if (!rawTime) continue;

      // Parse the raw HH:MM:SS from the DB
      const [h, m, s] = rawTime.split(':').map(Number);
      
      // Get what Prisma currently reads via getHours() (local UTC-5)
      const prismaLocalHour = rec[col].getHours();
      const prismaLocalMin = rec[col].getMinutes();

      console.log(`  ${col}: raw="${rawTime}", prisma.getHours()=${prismaLocalHour}:${String(prismaLocalMin).padStart(2,'0')}`);
      
      // The raw DB value is the TRUE intended time (e.g. 08:00, 20:00)
      // We need to write it back as a local-time Date so that Prisma
      // stores it correctly going forward with the new code.
      // 
      // If rawTime hour matches getHours(), the record is already correct → skip.
      // If they differ, we need to fix.
      if (h !== prismaLocalHour || m !== prismaLocalMin) {
        console.log(`    ⚠️  MISMATCH! Raw=${h}:${String(m).padStart(2,'0')}, Prisma reads as ${prismaLocalHour}:${String(prismaLocalMin).padStart(2,'0')}`);
        console.log(`    → Will write back: new Date(1970, 0, 1, ${h}, ${m}) = local time ${h}:${String(m).padStart(2,'0')}`);
        updates[col] = new Date(1970, 0, 1, h, m, 0, 0);
        needsUpdate = true;
      } else {
        console.log(`    ✅ OK (raw matches getHours())`);
      }
    }

    if (needsUpdate) {
      await updateFn(rec.id, updates);
      fixedCount++;
      console.log(`  ✅ Fixed record ${rec.id}`);
    }
  }

  console.log(`  Total fixed: ${fixedCount}/${records.length}\n`);
}

async function main() {
  const prisma = getPrismaClient();

  try {
    console.log('🔄 Iniciando corrección V2 de horarios...\n');

    // ── 1. clinic_schedules ──
    console.log('🏥 Revisando clinic_schedules...');
    const clinicSchedules = await prisma.clinic_schedules.findMany();
    await fixTable(
      prisma,
      'clinic_schedules',
      clinicSchedules,
      ['start_time', 'end_time', 'break_start', 'break_end'],
      async (id, updates) => {
        await prisma.clinic_schedules.update({ where: { id }, data: updates });
      }
    );

    // ── 2. doctor_schedules ──
    console.log('👨‍⚕️ Revisando doctor_schedules...');
    const doctorSchedules = await prisma.doctor_schedules.findMany();
    await fixTable(
      prisma,
      'doctor_schedules',
      doctorSchedules,
      ['start_time', 'end_time', 'break_start', 'break_end'],
      async (id, updates) => {
        await prisma.doctor_schedules.update({ where: { id }, data: updates });
      }
    );

    // ── 3. provider_schedules ──
    console.log('🏢 Revisando provider_schedules...');
    const providerSchedules = await prisma.provider_schedules.findMany();
    await fixTable(
      prisma,
      'provider_schedules',
      providerSchedules,
      ['start_time', 'end_time', 'break_start', 'break_end'],
      async (id, updates) => {
        await prisma.provider_schedules.update({ where: { id }, data: updates });
      }
    );

    console.log('✅ Corrección completada.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
