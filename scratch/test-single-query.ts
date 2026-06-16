import * as dotenv from 'dotenv';
dotenv.config();
import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  try {
    const res = await prisma.doctor_schedules.findFirst({
      where: {
        doctor_id: 'dac50995-fd98-45fe-9464-97bc866ab315',
        clinic_id: 'cd097385-8d85-4147-97aa-4bfc67326f4f',
        day_of_week: 2,
        enabled: true
      }
    });
    console.log('Result for day_of_week 2:', res);

    const all = await prisma.doctor_schedules.findMany({
      where: {
        doctor_id: 'dac50995-fd98-45fe-9464-97bc866ab315',
      }
    });
    console.log('All schedules for this doctor in DB:', all);
  } catch (err: any) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
