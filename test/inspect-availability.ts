import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  const doctorEmail = 'brandonalexpesantez@gmail.com';
  
  try {
    const user = await prisma.users.findFirst({
      where: { email: doctorEmail },
      include: {
        providers: true,
        clinic_doctors: {
          where: { is_active: true }
        }
      }
    });

    if (!user || !user.providers || user.providers.length === 0) {
      console.error('Doctor not found');
      return;
    }

    const doctorId = user.providers[0].id;
    const clinicDoctorId = user.clinic_doctors[0].id;
    const clinicId = user.clinic_doctors[0].clinic_id;

    console.log(`Doctor ID: ${doctorId}`);
    console.log(`Clinic Doctor ID: ${clinicDoctorId}`);
    console.log(`Clinic ID: ${clinicId}`);

    // Query doctor schedules
    const doctorSchedules = await prisma.doctor_schedules.findMany({
      where: { doctor_id: clinicDoctorId }
    });

    console.log('\n--- DOCTOR SCHEDULES ---');
    doctorSchedules.forEach((ds: any) => {
      console.log(`Day: ${ds.day_of_week} (${['Dom','Lun','Mar','Mie','Jue','Vie','Sab'][ds.day_of_week]})`);
      console.log(`  Enabled: ${ds.enabled}`);
      console.log(`  Start Time: ${ds.start_time}`);
      console.log(`  End Time: ${ds.end_time}`);
      console.log(`  Break Start: ${ds.break_start}`);
      console.log(`  Break End: ${ds.break_end}`);
    });

    // Query clinic schedules
    const clinicSchedules = await prisma.clinic_schedules.findMany({
      where: { clinic_id: clinicId }
    });

    console.log('\n--- CLINIC SCHEDULES ---');
    clinicSchedules.forEach((cs: any) => {
      console.log(`Day: ${cs.day_of_week} (${['Dom','Lun','Mar','Mie','Jue','Vie','Sab'][cs.day_of_week]})`);
      console.log(`  Enabled: ${cs.enabled}`);
      console.log(`  Start Time: ${cs.start_time}`);
      console.log(`  End Time: ${cs.end_time}`);
    });

    // Query appointments for June 16, 2026
    const startOfDay = new Date('2026-06-16T00:00:00Z');
    const endOfDay = new Date('2026-06-16T23:59:59Z');

    const appointments = await prisma.appointments.findMany({
      where: {
        provider_id: doctorId,
        scheduled_for: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    console.log('\n--- APPOINTMENTS FOR 2026-06-16 ---');
    appointments.forEach((apt: any) => {
      console.log(`ID: ${apt.id}`);
      console.log(`  Scheduled For: ${apt.scheduled_for}`);
      console.log(`  Status: ${apt.status}`);
      console.log(`  Patient: ${apt.patient_id}`);
    });

    // Query date block requests
    const blockRequests = await prisma.date_block_requests.findMany({
      where: {
        doctor_id: clinicDoctorId,
        date: new Date('2026-06-16T00:00:00')
      }
    });

    console.log('\n--- DATE BLOCK REQUESTS ---');
    blockRequests.forEach((br: any) => {
      console.log(`ID: ${br.id}`);
      console.log(`  Date: ${br.date}`);
      console.log(`  Start: ${br.start_time}`);
      console.log(`  End: ${br.end_time}`);
      console.log(`  Status: ${br.status}`);
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
