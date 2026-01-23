import { PrismaClient } from '../generated/prisma/client';

// Singleton pattern para Prisma Client en Lambda
// Evita crear múltiples conexiones por request
let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
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
}
