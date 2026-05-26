import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

let prisma: PrismaClient | null = null;
let pool: Pool | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const poolSize = Math.min(parseInt(process.env.PRISMA_POOL_SIZE || '5', 10), 10);
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({
      adapter,
      log: process.env.STAGE === 'dev' ? ['error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Disconnecting Prisma...');
  await disconnectPrisma();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Disconnecting Prisma...');
  await disconnectPrisma();
});
