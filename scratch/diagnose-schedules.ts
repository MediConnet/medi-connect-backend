import * as dotenv from 'dotenv';
dotenv.config();
import { getPrismaClient } from '../src/shared/prisma';

/**
 * DIAGNOSTIC SCRIPT V2 - Correct column names
 */
async function main() {
  const prisma = getPrismaClient();

  try {
    console.log('📊 RAW DATABASE VALUES (bypassing Prisma timezone)\n');

    // ── clinic_schedules (no break columns) ──
    const clinicRaw = await prisma.$queryRaw<any[]>`
      SELECT id, clinic_id, day_of_week, enabled,
             start_time::text AS start_time_raw,
             end_time::text AS end_time_raw
      FROM clinic_schedules
      ORDER BY clinic_id, day_of_week
    `;
    console.log(`🏥 clinic_schedules (${clinicRaw.length} rows):`);
    for (const r of clinicRaw) {
      console.log(`  Day ${r.day_of_week} | ${r.start_time_raw} - ${r.end_time_raw} | enabled: ${r.enabled} | id: ${r.id}`);
    }

    // ── doctor_schedules (has break columns) ──
    const doctorRaw = await prisma.$queryRaw<any[]>`
      SELECT id, doctor_id, clinic_id, day_of_week, enabled,
             start_time::text AS start_time_raw,
             end_time::text AS end_time_raw,
             break_start::text AS break_start_raw,
             break_end::text AS break_end_raw
      FROM doctor_schedules
      ORDER BY doctor_id, day_of_week
    `;
    console.log(`\n👨‍⚕️ doctor_schedules (${doctorRaw.length} rows):`);
    for (const r of doctorRaw) {
      console.log(`  Day ${r.day_of_week} | ${r.start_time_raw} - ${r.end_time_raw} | break: ${r.break_start_raw ?? 'none'}-${r.break_end_raw ?? 'none'} | enabled: ${r.enabled}`);
    }

    // ── provider_schedules ──
    // Check columns first
    const provColumns = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'provider_schedules' 
      ORDER BY ordinal_position
    `;
    console.log(`\n🏢 provider_schedules columns: ${provColumns.map((c: any) => c.column_name).join(', ')}`);

    const providerRaw = await prisma.$queryRaw<any[]>`
      SELECT ps.id, ps.day_of_week, ps.is_active,
             ps.start_time::text AS start_time_raw,
             ps.end_time::text AS end_time_raw
      FROM provider_schedules ps
      ORDER BY ps.day_of_week
    `;
    console.log(`provider_schedules (${providerRaw.length} rows):`);
    for (const r of providerRaw) {
      console.log(`  Day ${r.day_of_week} | ${r.start_time_raw} - ${r.end_time_raw} | active: ${r.is_active}`);
    }

    // Also show current Prisma read values for Brandon's doctor record
    console.log('\n\n--- BRANDON DOCTOR SCHEDULES (via Prisma) ---');
    const brandonSchedules = await prisma.doctor_schedules.findMany({
      where: { doctor_id: 'dac50995-fd98-45fe-9464-97bc866ab315' }
    });
    for (const s of brandonSchedules) {
      const st = s.start_time;
      const et = s.end_time;
      console.log(`  Day ${s.day_of_week}: getHours()=${st?.getHours()}:${String(st?.getMinutes()).padStart(2,'0')} - ${et?.getHours()}:${String(et?.getMinutes()).padStart(2,'0')} (getUTCHours: ${st?.getUTCHours()}:${String(st?.getUTCMinutes()).padStart(2,'0')} - ${et?.getUTCHours()}:${String(et?.getUTCMinutes()).padStart(2,'0')}) | enabled: ${s.enabled}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
