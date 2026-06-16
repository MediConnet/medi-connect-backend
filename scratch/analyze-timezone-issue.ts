import * as dotenv from 'dotenv';
dotenv.config();
import { getPrismaClient } from '../src/shared/prisma';

/**
 * RESET SCRIPT - Resets all schedules using direct SQL
 *
 * After the code fix (using getHours() instead of getUTCHours()), the backend
 * reads TIME values from PostgreSQL using local time (UTC-5 in Ecuador).
 *
 * Since the backend on Render runs in UTC, and our local machine runs in UTC-5:
 * - To show "08:00" in Ecuador, we store "13:00 UTC" in the DB (08:00 + 5h offset)
 * - BUT our new code reads via getHours() which is local time (UTC-5)
 * - So "13:00 UTC" stored in DB → Prisma returns Date at epoch+13h UTC
 * - In UTC-5 local, that's 08:00 local → getHours() = 8 ✅
 *
 * Current DB state (corrupted by fix scripts):
 * - clinic_schedules: 18:00 UTC stored (should be 13:00 UTC for 08:00 Ecuador)
 * - doctor_schedules: 18:00 UTC stored (should be 13:00 UTC for 08:00 Ecuador)
 *
 * The key formula: desiredLocalHour + 5 = UTC hour to store in DB
 * (because Ecuador UTC-5: local = UTC - 5, so UTC = local + 5)
 *
 * But WAIT - on Render (UTC server), getHours() == getUTCHours()!
 * So on Render, "13:00 UTC" → getHours() = 13, NOT 8.
 * This means the fix to use getHours() instead of getUTCHours() will BREAK on Render!
 *
 * The CORRECT solution for Render (UTC server):
 * - Store "08:00 UTC" in DB (the actual intended hour, no offset)
 * - getHours() on UTC server = 8 ✅
 * - getUTCHours() on UTC server = 8 ✅ (same result)
 * 
 * The CORRECT solution for LOCAL (UTC-5 server):
 * - Store "08:00 UTC" in DB
 * - getUTCHours() = 8 ✅ (correct but we changed code to use getHours())
 * - getHours() = 3 ❌ (wrong - shows as 03:00)
 *
 * CONCLUSION: The right fix is to REVERT to using getUTCHours() (which works on Render)
 * and fix the DB to store times as UTC directly (no offset).
 * 
 * The DB should store: 08:00:00 UTC for an 08:00 Ecuador appointment
 * (because Render runs UTC and getUTCHours() was the original code)
 *
 * Current corrupted state analysis:
 * - clinic_schedules: 18:00 UTC (was 13:00 UTC before V2 ran, original was probably 08:00 UTC)
 * - doctor_schedules: 18:00 - 06:00 UTC
 *
 * WHAT THE USER CONFIGURED:
 * - Clinic: 08:00 - 20:00 Ecuador time
 * - Doctor (Brandon): 08:00 - 20:00 Ecuador time
 *
 * Since Render uses UTC and original code used getUTCHours():
 * The ORIGINAL correct DB values should be: 08:00:00 and 20:00:00 (UTC = Ecuador time in this system)
 *
 * ACTION: Reset all schedules to what the user actually set up:
 * - clinic_schedules for cd097385: 08:00 - 20:00 UTC  
 * - doctor_schedules for Brandon: 08:00 - 20:00 UTC
 * - All other clinic schedules: 01:00 - 23:59 (24/7 clinics) → 01:00 and 23:59 UTC
 *
 * Better approach: Use raw SQL with the actual intended times as UTC values
 */

async function main() {
  const prisma = getPrismaClient();

  try {
    console.log('🔄 Resetting schedules to correct UTC values...\n');

    // First, show current state
    console.log('📊 Current state:');
    const current = await prisma.$queryRaw<any[]>`
      SELECT 'clinic' as type, id, day_of_week, enabled,
             start_time::text, end_time::text
      FROM clinic_schedules
      UNION ALL
      SELECT 'doctor' as type, id, day_of_week, enabled,
             start_time::text, end_time::text
      FROM doctor_schedules
      ORDER BY type, day_of_week
    `;
    for (const r of current) {
      console.log(`  [${r.type}] Day ${r.day_of_week}: ${r.start_time} - ${r.end_time} (enabled: ${r.enabled})`);
    }

    // The user set clinic hours as 08:00 - 20:00 on RENDER (UTC server).
    // On Render, getUTCHours() was used. So they were stored as 08:00 UTC.
    // But then fix scripts ran and shifted things.
    //
    // Now with new code using getHours(), and local machine in UTC-5:
    // 08:00 UTC stored → getHours() in UTC-5 = 03:00 (wrong, shows as 3am)
    // 
    // APPROACH: Revert the code changes (back to getUTCHours()) AND reset DB to original values.
    // This is the cleanest approach for Render deployment.
    //
    // But since we already changed the code... let me just reset the DB to store the 
    // correct UTC values that match what the user intended.
    //
    // After analyzing the corrupted data and original user config:
    // - Clinic cd097385 (Brandon's clinic): 08:00-20:00 Ecuador → 13:00-01:00 UTC (for local getHours())
    //   OR 08:00-20:00 UTC (for Render getUTCHours())
    //
    // Since we need to decide: which server timezone are we fixing for?
    // The app points to api.docalink.com (Render = UTC).
    // So we should revert code to getUTCHours() and store 08:00 UTC.
    //
    // Let me just show the analysis and ask the user / set correctly.
    
    console.log('\n\n💡 ANALYSIS:');
    console.log('The production server (Render) runs in UTC timezone.');
    console.log('Original code used getUTCHours() which worked correctly on Render.');
    console.log('The schedule change to getHours() only works correctly on local UTC-5 machines.');
    console.log('');
    console.log('RECOMMENDATION: Revert getHours() back to getUTCHours() in the backend code.');
    console.log('Then reset all schedule times to the intended times as UTC values.');
    console.log('');
    
    // Show what the intended times were based on the user's configurations
    console.log('For the production fix, the DB should store times as UTC directly.');
    console.log('This script will NOT make changes - please review the analysis above.');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
