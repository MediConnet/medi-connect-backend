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

let disconnectPromise: Promise<void> | null = null;

export function disconnectPrisma(): Promise<void> {
  if (!disconnectPromise) {
    disconnectPromise = (async () => {
      if (prisma) {
        await prisma.$disconnect().catch(e => console.error('Error disconnecting Prisma:', e));
        prisma = null;
      }
      if (pool) {
        await pool.end().catch((e: any) => {
          if (e && e.message !== 'Called end on pool more than once') {
            console.error('Error ending pg pool:', e);
          }
        });
        pool = null;
      }
    })();
  }
  return disconnectPromise;
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Disconnecting Prisma...');
  await disconnectPrisma();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Disconnecting Prisma...');
  await disconnectPrisma();
});
