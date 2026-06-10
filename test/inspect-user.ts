import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  const email = 'darckslinguer05@gmail.com';
  
  try {
    const user = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        providers: {
          include: {
            service_categories: true,
            provider_branches: true,
          }
        },
        clinics: true,
        clinic_doctors: true,
      }
    });

    console.log('--- USER DATA ---');
    console.log(JSON.stringify(user, null, 2));
    
    // Also look for categories
    const categories = await prisma.service_categories.findMany();
    console.log('--- CATEGORIES ---');
    console.log(JSON.stringify(categories, null, 2));

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
