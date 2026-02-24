import { getPrismaClient } from '../src/shared/prisma';

async function createTable() {
  const prisma = getPrismaClient();
  
  try {
    console.log('🔧 Creando tabla consultation_prices...\n');
    
    // Ejecutar SQL directamente
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "consultation_prices" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "provider_id" UUID NOT NULL,
        "specialty_id" UUID,
        "consultation_type" VARCHAR(255) NOT NULL,
        "price" DECIMAL(10,2) NOT NULL,
        "description" TEXT,
        "duration_minutes" INTEGER,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "consultation_prices_pkey" PRIMARY KEY ("id")
      );
    `);
    
    console.log('✅ Tabla consultation_prices creada\n');
    
    // Crear índices
    console.log('🔧 Creando índices...\n');
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "consultation_prices_provider_id_idx" 
      ON "consultation_prices"("provider_id");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "consultation_prices_specialty_id_idx" 
      ON "consultation_prices"("specialty_id");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "consultation_prices_is_active_idx" 
      ON "consultation_prices"("is_active");
    `);
    
    console.log('✅ Índices creados\n');
    
    // Agregar foreign keys
    console.log('🔧 Agregando foreign keys...\n');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "consultation_prices" 
      DROP CONSTRAINT IF EXISTS "consultation_prices_provider_id_fkey";
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "consultation_prices" 
      ADD CONSTRAINT "consultation_prices_provider_id_fkey" 
      FOREIGN KEY ("provider_id") REFERENCES "providers"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION;
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "consultation_prices" 
      DROP CONSTRAINT IF EXISTS "consultation_prices_specialty_id_fkey";
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "consultation_prices" 
      ADD CONSTRAINT "consultation_prices_specialty_id_fkey" 
      FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION;
    `);
    
    console.log('✅ Foreign keys agregadas\n');
    
    // Verificar
    const count = await prisma.consultation_prices.count();
    console.log('✅ TABLA CREADA EXITOSAMENTE');
    console.log(`📊 Registros actuales: ${count}\n`);
    
  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n✅ La tabla ya existe, verificando...\n');
      const count = await prisma.consultation_prices.count();
      console.log(`📊 Registros actuales: ${count}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTable();
