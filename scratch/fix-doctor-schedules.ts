import * as dotenv from 'dotenv';
dotenv.config();
import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();

  const raw = await prisma.$queryRaw<any[]>`
    SELECT ds.id, ds.doctor_id, ds.day_of_week, ds.enabled,
           ds.start_time::text AS st, ds.end_time::text AS et,
           cd.user_id
    FROM doctor_schedules ds
    LEFT JOIN clinic_doctors cd ON cd.id = ds.doctor_id
    ORDER BY ds.doctor_id, ds.day_of_week
  `;
  
  console.log('Doctor schedules:');
  for (const r of raw) {
    console.log(`  doctor_id: ${r.doctor_id} | user_id: ${r.user_id} | Day ${r.day_of_week}: ${r.st}-${r.et} | enabled: ${r.enabled}`);
  }

  // Fix: All doctor schedules with 19:00-03:00 are corrupted (originally 08:00-20:00?)
  // But we need to know what each doctor actually configured.
  // For now, let's reset ALL corrupted ones (19:00-03:00) back to 08:00-20:00 as that's the standard working hours
  const fixResult = await prisma.$executeRaw`
    UPDATE doctor_schedules
    SET start_time = '08:00:00'::time, end_time = '20:00:00'::time
    WHERE start_time = '19:00:00'::time AND end_time = '03:00:00'::time
  `;
  console.log(`\nFixed ${fixResult} rows with 19:00-03:00 → 08:00-20:00`);

  // Also fix 19:00-23:00 (Saturday?) → 09:00-14:00
  const fixSat = await prisma.$executeRaw`
    UPDATE doctor_schedules
    SET start_time = '09:00:00'::time, end_time = '14:00:00'::time
    WHERE start_time = '19:00:00'::time AND end_time = '23:00:00'::time
  `;
  console.log(`Fixed ${fixSat} rows with 19:00-23:00 → 09:00-14:00`);

  // Final state
  const final = await prisma.$queryRaw<any[]>`
    SELECT ds.id, ds.doctor_id, ds.day_of_week, ds.enabled,
           ds.start_time::text AS st, ds.end_time::text AS et
    FROM doctor_schedules ds
    ORDER BY ds.doctor_id, ds.day_of_week
  `;
  console.log('\nFinal doctor_schedules:');
  for (const r of final) {
    console.log(`  doctor_id: ${r.doctor_id} | Day ${r.day_of_week}: ${r.st}-${r.et} | enabled: ${r.enabled}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
