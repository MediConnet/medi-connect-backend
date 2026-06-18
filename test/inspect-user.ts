import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  
  try {
    const provider = await prisma.providers.findFirst({
      where: { id: 'b0a59efe-6825-4675-a031-5baf490fe258' },
      include: {
        users: {
          include: {
            clinic_doctors: {
              include: {
                clinics: true
              }
            }
          }
        }
      }
    });

    console.log('--- PROVIDER BRANDON DATA ---');
    console.log(JSON.stringify(provider, null, 2));

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
