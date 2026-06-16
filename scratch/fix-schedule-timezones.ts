import * as dotenv from 'dotenv';
dotenv.config();
import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();

  try {
    console.log('🔄 Iniciando corrección de horarios desfasados...');

    // 1. Corregir clinic_schedules
    const clinicSchedules = await prisma.clinic_schedules.findMany();
    console.log(`🏥 Encontrados ${clinicSchedules.length} horarios de clínicas.`);

    let updatedClinicsCount = 0;
    for (const sched of clinicSchedules) {
      const startLocalHour = sched.start_time?.getHours();
      const endLocalHour = sched.end_time?.getHours();

      // Si la hora local de inicio es menor o igual a 5, está desfasada (ej. 3 para indicar 8)
      // Si la hora local de fin es menor o igual a 15, está desfasada (ej. 15 para indicar 20)
      if (startLocalHour !== undefined && startLocalHour <= 5) {
        const newStartHours = startLocalHour + 5;
        const newEndHours = (endLocalHour ?? 0) + 5;

        console.log(`  Updating clinic schedule ${sched.id}:`);
        console.log(`    Start: ${startLocalHour}:00 -> ${newStartHours}:00`);
        console.log(`    End: ${endLocalHour}:00 -> ${newEndHours}:00`);

        await prisma.clinic_schedules.update({
          where: { id: sched.id },
          data: {
            start_time: new Date(1970, 0, 1, newStartHours, sched.start_time?.getMinutes() ?? 0, 0, 0),
            end_time: sched.end_time 
              ? new Date(1970, 0, 1, newEndHours, sched.end_time.getMinutes(), 0, 0)
              : null,
          }
        });
        updatedClinicsCount++;
      }
    }
    console.log(`✅ Se actualizaron ${updatedClinicsCount} horarios de clínicas.\n`);

    // 2. Corregir doctor_schedules
    const doctorSchedules = await prisma.doctor_schedules.findMany();
    console.log(`👨‍⚕️ Encontrados ${doctorSchedules.length} horarios de doctores.`);

    let updatedDoctorsCount = 0;
    for (const sched of doctorSchedules) {
      const startLocalHour = sched.start_time?.getHours();
      const endLocalHour = sched.end_time?.getHours();

      if (startLocalHour !== undefined && startLocalHour <= 5) {
        const newStartHours = startLocalHour + 5;
        const newEndHours = (endLocalHour ?? 0) + 5;

        console.log(`  Updating doctor schedule ${sched.id}:`);
        console.log(`    Start: ${startLocalHour}:00 -> ${newStartHours}:00`);
        console.log(`    End: ${endLocalHour}:00 -> ${newEndHours}:00`);

        // Corregir break_start y break_end si existen
        let newBreakStart: Date | null = null;
        let newBreakEnd: Date | null = null;

        if (sched.break_start) {
          const bsLocalHour = sched.break_start.getHours();
          newBreakStart = new Date(1970, 0, 1, bsLocalHour + 5, sched.break_start.getMinutes(), 0, 0);
        }
        if (sched.break_end) {
          const beLocalHour = sched.break_end.getHours();
          newBreakEnd = new Date(1970, 0, 1, beLocalHour + 5, sched.break_end.getMinutes(), 0, 0);
        }

        await prisma.doctor_schedules.update({
          where: { id: sched.id },
          data: {
            start_time: new Date(1970, 0, 1, newStartHours, sched.start_time?.getMinutes() ?? 0, 0, 0),
            end_time: sched.end_time 
              ? new Date(1970, 0, 1, newEndHours, sched.end_time.getMinutes(), 0, 0)
              : null,
            break_start: newBreakStart,
            break_end: newBreakEnd,
          }
        });
        updatedDoctorsCount++;
      }
    }
    console.log(`✅ Se actualizaron ${updatedDoctorsCount} horarios de doctores.\n`);

    // 3. Corregir provider_schedules (Horarios independientes)
    const providerSchedules = await prisma.provider_schedules.findMany();
    console.log(`🏢 Encontrados ${providerSchedules.length} horarios de proveedores independientes.`);

    let updatedProvidersCount = 0;
    for (const sched of providerSchedules) {
      const startLocalHour = sched.start_time?.getHours();
      const endLocalHour = sched.end_time?.getHours();

      if (startLocalHour !== undefined && startLocalHour <= 5) {
        const newStartHours = startLocalHour + 5;
        const newEndHours = (endLocalHour ?? 0) + 5;

        console.log(`  Updating provider schedule ${sched.id}:`);
        console.log(`    Start: ${startLocalHour}:00 -> ${newStartHours}:00`);
        console.log(`    End: ${endLocalHour}:00 -> ${newEndHours}:00`);

        let newBreakStart: Date | null = null;
        let newBreakEnd: Date | null = null;

        if (sched.break_start) {
          const bsLocalHour = sched.break_start.getHours();
          newBreakStart = new Date(1970, 0, 1, bsLocalHour + 5, sched.break_start.getMinutes(), 0, 0);
        }
        if (sched.break_end) {
          const beLocalHour = sched.break_end.getHours();
          newBreakEnd = new Date(1970, 0, 1, beLocalHour + 5, sched.break_end.getMinutes(), 0, 0);
        }

        await prisma.provider_schedules.update({
          where: { id: sched.id },
          data: {
            start_time: new Date(1970, 0, 1, newStartHours, sched.start_time?.getMinutes() ?? 0, 0, 0),
            end_time: sched.end_time 
              ? new Date(1970, 0, 1, newEndHours, sched.end_time.getMinutes(), 0, 0)
              : null,
            break_start: newBreakStart,
            break_end: newBreakEnd,
          }
        });
        updatedProvidersCount++;
      }
    }
    console.log(`✅ Se actualizaron ${updatedProvidersCount} horarios de proveedores independientes.`);

  } catch (error: any) {
    console.error('❌ Error ejecutando corrección de base de datos:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
