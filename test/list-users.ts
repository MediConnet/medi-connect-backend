import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  try {
    const users = await prisma.users.findMany({
      include: {
        providers: true,
        clinics: true,
        clinic_doctors: {
          include: {
            clinics: true
          }
        }
      }
    });

    console.log('--- ALL USERS ---');
    for (const u of users) {
      console.log(`Email: ${u.email}`);
      console.log(`Role: ${u.role}`);
      console.log(`ID: ${u.id}`);
      if (u.providers && u.providers.length > 0) {
        console.log(`  Provider Commercial Name: ${u.providers[0].commercial_name}`);
      }
      if (u.clinics) {
        console.log(`  Clinic Name: ${u.clinics.name} (Active: ${u.clinics.is_active})`);
      }
      if (u.clinic_doctors && u.clinic_doctors.length > 0) {
        console.log('  Clinic Doctor Associations:');
        for (const cd of u.clinic_doctors) {
          console.log(`    - Clinic: ${cd.clinics?.name || 'N/A'} (ID: ${cd.clinic_id})`);
          console.log(`      Active: ${cd.is_active}`);
          console.log(`      Doctor ID in clinic_doctors: ${cd.id}`);
        }
      }
      console.log('-----------------');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
