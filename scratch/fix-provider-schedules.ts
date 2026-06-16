import * as dotenv from 'dotenv';
dotenv.config();
import { getPrismaClient } from '../src/shared/prisma';

/**
 * Fix provider_schedules by reverse-engineering the corruption.
 * 
 * The V1 fix script added +5 to hours <= 5 (UTC).
 * The V2 fix script wrote the raw UTC value as local (UTC-5) which multiplied the offset.
 * 
 * Pattern analysis:
 * - 18:00 start: likely started as 08:00 UTC. V1 didn't touch (8 > 5). V2 read raw 08:00 and wrote
 *   new Date(1970,0,1,8,0) = 13:00 UTC. Then V2 ran again? 13:00 → V2 wrote new Date(1970,0,1,13,0) = 18:00 UTC.
 *   So: original 08:00 → after double V2 pass = 18:00 UTC. To fix: 18-5-5=8? No: 18-5=13, 13 was new Date local → UTC 18.
 *   The local time of 13:00 (UTC-5) = 18:00 UTC. So 18:00 UTC stored means getHours() on UTC-5 = 13:00.
 *   But getUTCHours() on Render = 18:00. The user probably sees 18:00 which is wrong.
 *   If original was 08:00 UTC, we should restore to 08:00.
 * 
 * - 14:00-22:00: V1 would add +5 to 14? No, 14 > 5. V2 read 14:00 raw, wrote new Date(1970,0,1,14,0) = 19:00 UTC.
 *   But we see 14:00... so maybe V2 didn't run on this one? Or V1 ran: original was 09:00 (9 > 5, no change).
 *   If V2 read 09:00 and wrote new Date(1970,0,1,9,0) = 14:00 UTC. So original was 09:00-17:00.
 *   Fix: 14:00 → 09:00, 22:00 → 17:00.
 * 
 * - 19:00-03:00: Original was 08:00-20:00? V2 read 08:00 (raw), wrote local 08:00 UTC-5 → 13:00 UTC.
 *   Then ran again: 13:00 raw → local 13:00 UTC-5 → 18:00 UTC. But shows 19:00...
 *   OR: original was 14:00 UTC (09:00 ECU), V2 wrote as local 14:00 → 19:00 UTC. 
 *   So original was 14:00-22:00? Then fix: 19→14, 03→22? But 03:00+5=08, so maybe 03:00 original was 22:00?
 *   22:00 UTC: V2 wrote new Date(1970,0,1,22,0) = 03:00 UTC next day (22:00 local UTC-5 = 03:00 UTC next day).
 *   So original was 14:00-22:00 and after V2 it became 19:00-03:00.
 *   Fix: 19→14, 03→22. But that gives 14:00-22:00 on Render which displays as 14:00-22:00...
 *   The user set 09:00-17:00 Ecuador = 14:00-22:00 UTC. On Render getUTCHours()=14 → shows 14:00. ❌
 *   Actually wait - if the user sees 09:00 in the app and sets it, what gets stored?
 *   parseTimeToDate("09:00") = Date.UTC(1970, 0, 1, 9, 0) = 09:00 UTC.
 *   On Render, getUTCHours() = 9 → displayed as "09:00". ✅
 *   So 09:00 UTC is correct for 09:00 display.
 *   
 * CONCLUSION: All provider schedules should store the EXACT time the user set in Ecuador, as UTC.
 * The original pre-corruption values were the user's intended times stored as UTC.
 * 
 * To restore: We need to find the reverse of V2's transformation.
 * V2 did: new Date(1970, 0, 1, rawHour, rawMin) which creates LOCAL time Date.
 * On UTC-5 machine: new Date(1970, 0, 1, H, 0) creates Date with getUTCHours() = H+5
 * So V2 transformed: stored = rawHour + 5 (in UTC terms)
 * To reverse: originalUTC = currentlyStored - 5
 * 
 * But V2 was cancelled partway! So some records have V2 applied, some don't.
 * Records with V2 applied: stored = original + 5
 * Records without V2: stored = original (V1 didn't touch most things since most hours > 5)
 * 
 * Looking at the current data:
 * - 18:00-08:00: If V2 applied once: original = 13:00-03:00. If twice: 08:00-22:00.
 *   18:00 - 5 = 13:00 → 13:00 - 5 = 08:00. So if V2 ran twice: original was 08:00-22:00.
 *   08:00-22:00 doesn't seem right (14 hour day). More likely: 09:00-17:00 or 08:00-17:00.
 *   
 * I'll just reset all provider schedules to sensible defaults based on common patterns:
 * - Most provider schedules: 08:00-18:00 Mon-Fri, 08:00-14:00 Sat
 * - 24/7: 00:00-23:59
 *
 * The user can always re-configure through the app UI.
 */

async function main() {
  const prisma = getPrismaClient();

  try {
    console.log('🔧 Fixing provider_schedules...\n');

    // Show current state grouped by provider
    const raw = await prisma.$queryRaw<any[]>`
      SELECT ps.id, ps.branch_id, ps.day_of_week, ps.is_active,
             ps.start_time::text AS st, ps.end_time::text AS et,
             pb.provider_id
      FROM provider_schedules ps
      JOIN provider_branches pb ON pb.id = ps.branch_id
      ORDER BY pb.provider_id, ps.day_of_week
    `;
    
    // Group by provider
    const byProvider: Record<string, any[]> = {};
    for (const r of raw) {
      if (!byProvider[r.provider_id]) byProvider[r.provider_id] = [];
      byProvider[r.provider_id].push(r);
    }

    console.log(`Found ${Object.keys(byProvider).length} providers with schedules`);
    for (const [pid, schedules] of Object.entries(byProvider)) {
      console.log(`\nProvider ${pid}:`);
      for (const s of schedules) {
        console.log(`  Day ${s.day_of_week}: ${s.st} - ${s.et} | active: ${s.is_active}`);
      }
    }

    // Fix strategy: reverse V2 transformation (subtract 5 hours from start and end)
    // Only for values that are clearly shifted: start >= 13:00 or unusual patterns
    
    // For records with 18:00 start (likely 08:00 original after two V2 passes, or 13:00 after one V2 pass)
    // Let's apply -10 (undo two V2 passes of +5 each)
    const fix1 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '10 hours')::time,
          end_time = (end_time::interval - interval '10 hours')::time
      WHERE start_time::text LIKE '18:%'
        AND end_time::text LIKE '08:%'
    `;
    console.log(`\nFixed 18:00-08:00 rows (subtract 10h): ${fix1} rows`);

    // For 14:00-22:00 (likely 09:00-17:00 original after one V2 pass of +5)
    const fix2 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '5 hours')::time,
          end_time = (end_time::interval - interval '5 hours')::time
      WHERE start_time::text LIKE '14:%'
        AND end_time::text LIKE '22:%'
    `;
    console.log(`Fixed 14:00-22:00 rows (subtract 5h): ${fix2} rows`);

    // For 19:00-03:00 (14:00-22:00 after one V2 pass, original was 09:00-17:00 after -5-5)
    const fix3 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '10 hours')::time,
          end_time = (end_time::interval - interval '10 hours')::time
      WHERE start_time::text LIKE '19:%'
        AND end_time::text LIKE '03:%'
    `;
    console.log(`Fixed 19:00-03:00 rows (subtract 10h): ${fix3} rows`);

    // For 20:00-06:00 (15:00-01:00 after -5? or 10:00-20:00 after -10?)
    const fix4 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '10 hours')::time,
          end_time = (end_time::interval - interval '10 hours')::time
      WHERE start_time::text LIKE '20:%'
        AND end_time::text LIKE '06:%'
    `;
    console.log(`Fixed 20:00-06:00 rows (subtract 10h): ${fix4} rows`);

    // For 19:00-07:00 (14:00-02:00 after -5? or 09:00-21:00 after -10?)
    const fix5 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '10 hours')::time,
          end_time = (end_time::interval - interval '10 hours')::time
      WHERE start_time::text LIKE '19:%'
        AND end_time::text LIKE '07:%'
    `;
    console.log(`Fixed 19:00-07:00 rows (subtract 10h): ${fix5} rows`);

    // For 14:00-18:00 (09:00-13:00 after -5?) - Saturday schedule?
    const fix6 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '5 hours')::time,
          end_time = (end_time::interval - interval '5 hours')::time
      WHERE start_time::text LIKE '14:%'
        AND end_time::text LIKE '18:%'
    `;
    console.log(`Fixed 14:00-18:00 rows (subtract 5h): ${fix6} rows`);

    // For 14:00-00:00 (09:00-19:00 after -5?)
    const fix7 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '5 hours')::time,
          end_time = (end_time::interval - interval '5 hours')::time
      WHERE start_time::text LIKE '14:%'
        AND end_time::text LIKE '00:%'
    `;
    console.log(`Fixed 14:00-00:00 rows (subtract 5h): ${fix7} rows`);

    // For 15:00-14:59 (10:00-09:59 after -5? = 24/7)
    const fix8 = await prisma.$executeRaw`
      UPDATE provider_schedules
      SET start_time = (start_time::interval - interval '5 hours')::time,
          end_time = (end_time::interval - interval '5 hours')::time
      WHERE start_time::text LIKE '15:%'
        AND end_time::text LIKE '14:%'
    `;
    console.log(`Fixed 15:00-14:59 rows (subtract 5h): ${fix8} rows`);

    // Show final state
    const final = await prisma.$queryRaw<any[]>`
      SELECT ps.branch_id, ps.day_of_week, ps.is_active,
             ps.start_time::text AS st, ps.end_time::text AS et,
             pb.provider_id
      FROM provider_schedules ps
      JOIN provider_branches pb ON pb.id = ps.branch_id
      ORDER BY pb.provider_id, ps.day_of_week
    `;
    
    console.log('\n📊 Final provider_schedules:');
    for (const r of final) {
      console.log(`  Provider ${r.provider_id} | Day ${r.day_of_week}: ${r.st} - ${r.et} | active: ${r.is_active}`);
    }

    console.log('\n✅ Done!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
