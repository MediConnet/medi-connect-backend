import 'dotenv/config';
import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe(
    `ALTER TABLE providers ADD COLUMN IF NOT EXISTS profile_views INT DEFAULT 0;`
  );
  console.log('✅ Columna profile_views agregada exitosamente a la tabla providers.');
}

main()
  .catch((e) => {
    console.error('❌ Error agregando columna:', e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });
