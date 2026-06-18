import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  try {
    const appointments = await prisma.appointments.findMany({
      include: {
        patients: {
          select: {
            full_name: true,
          }
        },
        providers: {
          select: {
            commercial_name: true,
          }
        }
      }
    });

    console.log('--- ALL APPOINTMENTS ---');
    console.log(appointments.map(a => ({
      id: a.id,
      patientName: a.patients?.full_name,
      doctorName: a.providers?.commercial_name,
      scheduled_for: a.scheduled_for,
      status: a.status,
      clinic_id: (a as any).clinic_id,
      provider_id: a.provider_id
    })));

    const clinicDoctors = await prisma.clinic_doctors.findMany({
      include: {
        clinics: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    console.log('--- CLINIC DOCTORS ASSOCIATIONS ---');
    console.log(clinicDoctors);

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
