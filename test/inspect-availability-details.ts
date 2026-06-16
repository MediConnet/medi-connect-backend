import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';
import { addMinutes, format, isBefore, isEqual, setHours, setMinutes, setSeconds } from 'date-fns';

const getEcuadorTime = (): Date => {
  const now = new Date();
  const ecuadorOffset = -5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * -5);
};

function mergeDateAndTime(baseDate: Date, timeDate: Date): Date {
  const hours = timeDate.getUTCHours();
  const minutes = timeDate.getUTCMinutes();

  let newDate = new Date(baseDate);
  newDate = setHours(newDate, hours);
  newDate = setMinutes(newDate, minutes);
  newDate = setSeconds(newDate, 0);
  newDate.setMilliseconds(0);

  return newDate;
}

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
      return;
    }

    const clinicDoctorId = user.clinic_doctors[0].id;
    const clinicId = user.clinic_doctors[0].clinic_id;

    // Get Tuesday (JS dayOfWeek = 2, DB dayOfWeek = 1)
    const customSchedule = await prisma.doctor_schedules.findFirst({
      where: {
        doctor_id: clinicDoctorId,
        clinic_id: clinicId ?? undefined,
        day_of_week: 1, // Tuesday in DB
        enabled: true,
      },
    });

    if (!customSchedule) {
      console.log('No custom schedule found for Tuesday');
      return;
    }

    console.log(`Custom Schedule Tuesday: start=${customSchedule.start_time}, end=${customSchedule.end_time}`);

    const dateString = '2026-06-16';
    const requestDate = new Date(`${dateString}T00:00:00`);
    console.log(`requestDate: ${requestDate.toISOString()} (local: ${requestDate.toString()})`);

    const startDateTime = mergeDateAndTime(requestDate, customSchedule.start_time!);
    const endDateTime = mergeDateAndTime(requestDate, customSchedule.end_time!);

    console.log(`startDateTime: ${startDateTime.toISOString()} (local: ${startDateTime.toString()})`);
    console.log(`endDateTime: ${endDateTime.toISOString()} (local: ${endDateTime.toString()})`);

    let allSlots: Date[] = [];
    let currentSlot = startDateTime;

    while (isBefore(currentSlot, endDateTime)) {
      const slotEnd = addMinutes(currentSlot, 30);
      if (isBefore(slotEnd, endDateTime) || isEqual(slotEnd, endDateTime)) {
        allSlots.push(currentSlot);
      }
      currentSlot = addMinutes(currentSlot, 30);
    }

    console.log('\n--- ALL GENERATED SLOTS (before busy & time filter) ---');
    allSlots.forEach(s => {
      console.log(`Slot: ${format(s, 'HH:mm')} -> ISO: ${s.toISOString()} -> local: ${s.toString()}`);
    });

    const ecuadorNow = getEcuadorTime();
    const bufferTime = addMinutes(ecuadorNow, 30);
    console.log(`\necuadorNow: ${ecuadorNow.toISOString()} (local: ${ecuadorNow.toString()})`);
    console.log(`bufferTime: ${bufferTime.toISOString()} (local: ${bufferTime.toString()})`);

    console.log('\n--- FILTERING SLOTS FOR TODAY ---');
    allSlots.forEach(slot => {
      const allowed = isBefore(bufferTime, slot);
      console.log(`Slot ${format(slot, 'HH:mm')} (${slot.toISOString()}): bufferTime (${bufferTime.toISOString()}) < slot? ${allowed}`);
    });

  } catch (e: any) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
