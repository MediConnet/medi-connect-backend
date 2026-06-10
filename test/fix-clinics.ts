import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  
  try {
    // Find clinic category
    const clinicCategory = await prisma.service_categories.findFirst({
      where: {
        slug: { in: ['clinic', 'clinica'] }
      }
    });

    if (!clinicCategory) {
      console.error('Clinic category not found in service_categories table');
      return;
    }

    console.log(`Clinic Category found: ID = ${clinicCategory.id}, slug = ${clinicCategory.slug}`);

    // Find all providers with category_id = null and whose user has a clinic
    const providersToFix = await prisma.providers.findMany({
      where: {
        category_id: null,
        users: {
          clinics: { isNot: null }
        }
      },
      include: {
        users: {
          select: {
            email: true,
            clinics: true
          }
        }
      }
    });

    console.log(`Found ${providersToFix.length} providers with null category_id that have clinics:`);

    for (const provider of providersToFix) {
      console.log(`- Provider ID: ${provider.id}, Name: ${provider.commercial_name}, User Email: ${provider.users?.email}`);
      
      await prisma.providers.update({
        where: { id: provider.id },
        data: {
          category_id: clinicCategory.id
        }
      });
      
      console.log(`  Updated category_id to ${clinicCategory.id}`);
    }

    console.log('Done!');
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
