// Importación que funciona tanto en desarrollo como en producción compilada
// En desarrollo: desde src/shared -> ../generated/prisma/client
// En producción: desde dist/src/shared -> ./generated/prisma/client (mismo nivel)
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Singleton pattern para Prisma Client en Lambda
// Evita crear múltiples conexiones por request
let prisma: PrismaClient | null = null;
let pool: Pool | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Crear pool de PostgreSQL si no existe
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }

    // Crear el adapter de Prisma para PostgreSQL
    const adapter = new PrismaPg(pool);

    prisma = new PrismaClient({
      adapter: adapter,
      log: process.env.STAGE === 'dev' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

// Helper para cerrar conexión (útil en tests o shutdown)
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