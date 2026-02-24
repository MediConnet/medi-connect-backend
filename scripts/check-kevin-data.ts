/**
 * Script para verificar los datos de Kevin en la base de datos
 * Ejecutar: npx ts-node scripts/check-kevin-data.ts
 */

import { getPrismaClient } from '../src/shared/prisma';

const KEVIN_DOCTOR_ID = '76820234-174a-4fa0-9221-404dd93a7e77';

async function checkKevinData() {
  console.log('🔍 Verificando datos de Kevin en la base de datos...\n');
  
  const prisma = getPrismaClient();

  try {
    // 1. Verificar que el doctor existe
    console.log('1️⃣ Verificando doctor...');
    const doctor = await prisma.providers.findUnique({
      where: { id: KEVIN_DOCTOR_ID },
      include: {
        users: {
          select: { email: true },
        },
      },
    });

    if (!doctor) {
      console.log('❌ Doctor no encontrado con ID:', KEVIN_DOCTOR_ID);
      return;
    }

    console.log('✅ Doctor encontrado:');
    console.log(`   Nombre: ${doctor.commercial_name}`);
    console.log(`   Email: ${doctor.users?.email}`);
    console.log(`   Estado: ${doctor.verification_status}\n`);

    // 2. Buscar en consultation_prices
    console.log('2️⃣ Buscando en tabla consultation_prices...');
    const consultationPrices = await prisma.consultation_prices.findMany({
      where: {
        provider_id: KEVIN_DOCTOR_ID,
      },
      include: {
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`📊 Total de registros: ${consultationPrices.length}\n`);

    if (consultationPrices.length > 0) {
      console.log('📋 Datos encontrados:');
      consultationPrices.forEach((cp, index) => {
        console.log(`\n   ${index + 1}. ${cp.consultation_type}`);
        console.log(`      💰 Precio: $${cp.price}`);
        console.log(`      🏥 Especialidad: ${cp.specialties?.name || 'Sin especialidad'}`);
        console.log(`      🆔 ID: ${cp.id}`);
        console.log(`      ✅ Activo: ${cp.is_active}`);
        console.log(`      📅 Creado: ${cp.created_at}`);
      });
    } else {
      console.log('⚠️ No se encontraron registros en consultation_prices');
    }

    // 3. Verificar tipos inactivos
    console.log('\n3️⃣ Verificando tipos inactivos...');
    const inactiveCount = await prisma.consultation_prices.count({
      where: {
        provider_id: KEVIN_DOCTOR_ID,
        is_active: false,
      },
    });
    console.log(`📊 Tipos inactivos: ${inactiveCount}`);

    // 4. Verificar especialidades del doctor
    console.log('\n4️⃣ Verificando especialidades del doctor...');
    const specialties = await prisma.provider_specialties.findMany({
      where: {
        provider_id: KEVIN_DOCTOR_ID,
      },
      include: {
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`📊 Especialidades: ${specialties.length}`);
    specialties.forEach((ps) => {
      console.log(`   - ${ps.specialties.name} (Tarifa: $${ps.fee})`);
    });

    // 5. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`Doctor: ${doctor.commercial_name} (${doctor.users?.email})`);
    console.log(`Tipos de consulta activos: ${consultationPrices.filter(cp => cp.is_active).length}`);
    console.log(`Tipos de consulta inactivos: ${inactiveCount}`);
    console.log(`Total en BD: ${consultationPrices.length}`);
    console.log(`Especialidades: ${specialties.length}`);
    
    if (consultationPrices.length === 0) {
      console.log('\n⚠️ PROBLEMA: No hay datos en consultation_prices');
      console.log('   Posible causa: Los datos no se guardaron correctamente');
      console.log('   Solución: Crear el tipo de consulta desde la web nuevamente');
    } else if (consultationPrices.filter(cp => cp.is_active).length === 0) {
      console.log('\n⚠️ PROBLEMA: Todos los tipos están inactivos');
      console.log('   Solución: Activar los tipos de consulta');
    } else {
      console.log('\n✅ Los datos existen y están activos');
      console.log('   El endpoint debería funcionar correctamente');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKevinData();
