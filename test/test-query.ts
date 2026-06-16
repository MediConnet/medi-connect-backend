import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getPrismaClient } from '../src/shared/prisma';

const prisma = getPrismaClient();

async function main() {
  console.log('--- BUSCANDO TODOS LOS MEDICOS EN CLINIC_DOCTORS ---');
  const associations = await prisma.clinic_doctors.findMany({
    include: {
      clinics: {
        include: {
          clinic_schedules: true,
        }
      },
      users: {
        select: {
          id: true,
          email: true,
        }
      },
      doctor_schedules: true,
    }
  });

  console.log(`Encontradas ${associations.length} asociaciones:`);
  for (const assoc of associations) {
    console.log(`\nAsociación ID: ${assoc.id}`);
    console.log(`Médico email: ${assoc.users?.email} (User ID: ${assoc.user_id})`);
    console.log(`Clínica: ${assoc.clinics?.name} (Clinic ID: ${assoc.clinic_id})`);
    console.log(`Is Active: ${assoc.is_active}, Is Invited: ${assoc.is_invited}`);
    
    console.log('--- Horarios de la Clínica ---');
    if (assoc.clinics?.clinic_schedules) {
      console.log(`Total horarios clínica: ${assoc.clinics.clinic_schedules.length}`);
      for (const sched of assoc.clinics.clinic_schedules) {
        console.log(`  Día: ${sched.day_of_week}, Enabled: ${sched.enabled}, Start: ${sched.start_time?.toISOString()}, End: ${sched.end_time?.toISOString()}`);
      }
    } else {
      console.log('  No tiene horarios configurados');
    }

    console.log('--- Horarios del Médico (doctor_schedules) ---');
    if (assoc.doctor_schedules) {
      console.log(`Total horarios médico: ${assoc.doctor_schedules.length}`);
      for (const sched of assoc.doctor_schedules) {
        console.log(`  Día: ${sched.day_of_week}, Enabled: ${sched.enabled}, Start: ${sched.start_time?.toISOString()}, End: ${sched.end_time?.toISOString()}`);
      }
    } else {
      console.log('  No tiene horarios configurados');
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
