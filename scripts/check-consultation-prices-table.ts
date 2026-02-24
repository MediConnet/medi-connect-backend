import { getPrismaClient } from '../src/shared/prisma';

async function checkTable() {
  const prisma = getPrismaClient();
  
  try {
    console.log('🔍 Verificando si la tabla consultation_prices existe...\n');
    
    // Intentar hacer una consulta simple
    const count = await prisma.consultation_prices.count();
    console.log('✅ La tabla consultation_prices EXISTE');
    console.log(`📊 Registros actuales: ${count}\n`);
    
    // Obtener estructura de la tabla
    const sample = await prisma.consultation_prices.findFirst();
    if (sample) {
      console.log('📋 Ejemplo de registro:');
      console.log(JSON.stringify(sample, null, 2));
    } else {
      console.log('📋 La tabla está vacía (sin registros)');
    }
    
  } catch (error: any) {
    console.error('❌ ERROR: La tabla consultation_prices NO EXISTE');
    console.error('Mensaje:', error.message);
    console.error('\n💡 Solución: Ejecuta el script SQL manualmente en tu base de datos');
    console.error('Archivo: scripts/create-consultation-prices-table.sql\n');
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
