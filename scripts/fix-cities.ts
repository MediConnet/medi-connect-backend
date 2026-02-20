import { getPrismaClient } from '../src/shared/prisma';

async function fixCities() {
  const prisma = getPrismaClient();

  try {
    console.log('🔍 Verificando ciudades en la base de datos...\n');

    // Obtener todas las ciudades
    const allCities = await prisma.cities.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`📊 Total de ciudades: ${allCities.length}\n`);
    console.log('📋 Ciudades actuales:');
    allCities.forEach(city => {
      console.log(`  - ${city.name} (${city.state || 'Sin provincia'})`);
    });

    // Buscar "Queti" (error de tipeo)
    const quetiCity = await prisma.cities.findFirst({
      where: { name: 'Queti' }
    });

    if (quetiCity) {
      console.log('\n⚠️  ERROR ENCONTRADO: Ciudad "Queti" existe en la base de datos');
      console.log('🔧 Corrigiendo a "Quito"...');

      // Verificar si ya existe "Quito"
      const quitoCity = await prisma.cities.findFirst({
        where: { name: 'Quito' }
      });

      if (quitoCity) {
        console.log('⚠️  "Quito" ya existe. Eliminando "Queti"...');
        await prisma.cities.delete({
          where: { id: quetiCity.id }
        });
        console.log('✅ "Queti" eliminado correctamente');
      } else {
        console.log('🔄 Actualizando "Queti" a "Quito"...');
        await prisma.cities.update({
          where: { id: quetiCity.id },
          data: { 
            name: 'Quito',
            state: 'Pichincha'
          }
        });
        console.log('✅ Ciudad corregida correctamente');
      }
    } else {
      console.log('\n✅ No se encontró el error "Queti"');
    }

    // Verificar que las ciudades principales existan
    console.log('\n🔍 Verificando ciudades principales...');
    const mainCities = [
      { name: 'Quito', state: 'Pichincha' },
      { name: 'Guayaquil', state: 'Guayas' },
      { name: 'Cuenca', state: 'Azuay' }
    ];

    for (const cityData of mainCities) {
      const city = await prisma.cities.findFirst({
        where: { name: cityData.name }
      });

      if (city) {
        console.log(`  ✅ ${cityData.name} existe`);
      } else {
        console.log(`  ⚠️  ${cityData.name} NO existe. Creando...`);
        await prisma.cities.create({
          data: {
            id: require('crypto').randomUUID(),
            name: cityData.name,
            state: cityData.state,
            country: 'Ecuador'
          }
        });
        console.log(`  ✅ ${cityData.name} creada`);
      }
    }

    // Mostrar ciudades finales
    console.log('\n📋 Ciudades finales:');
    const finalCities = await prisma.cities.findMany({
      orderBy: { name: 'asc' }
    });
    finalCities.forEach(city => {
      console.log(`  - ${city.name} (${city.state || 'Sin provincia'})`);
    });

    console.log('\n✅ Verificación y corrección completada');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
fixCities()
  .then(() => {
    console.log('\n🎉 Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
