import { getPrismaClient } from '../src/shared/prisma';

async function checkCurrentData() {
  const prisma = getPrismaClient();

  console.log('🔍 Revisando estado actual de la base de datos...\n');

  // 1. Contar providers que son doctores
  const doctorProviders = await prisma.providers.count({
    where: {
      service_categories: {
        slug: 'doctor'
      }
    }
  });
  console.log(`👨‍⚕️ Total de doctores (providers): ${doctorProviders}`);

  // 2. Verificar si existe la tabla provider_specialties
  try {
    const providerSpecialties = await prisma.provider_specialties.findMany({
      take: 5,
      include: {
        providers: {
          select: { commercial_name: true }
        },
        specialties: {
          select: { name: true }
        }
      }
    });
    
    console.log(`\n✅ Tabla provider_specialties existe`);
    console.log(`📊 Registros en provider_specialties: ${providerSpecialties.length > 0 ? 'Sí hay datos' : 'Vacía'}`);
    
    if (providerSpecialties.length > 0) {
      console.log('\n📋 Primeros 5 registros:');
      providerSpecialties.forEach((ps, i) => {
        console.log(`  ${i + 1}. ${ps.providers?.commercial_name} - ${ps.specialties?.name} - $${ps.fee}`);
      });
    }
  } catch (error) {
    console.log(`\n❌ Error con provider_specialties: ${error}`);
  }

  // 3. Verificar specialties disponibles
  const specialties = await prisma.specialties.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          provider_specialties: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });
  
  console.log(`\n📚 Total de especialidades disponibles: ${specialties.length}`);
  console.log('\n🏥 Especialidades:');
  specialties.slice(0, 10).forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (${s._count.provider_specialties} doctores)`);
  });

  // 4. Verificar doctores con sus datos actuales
  const doctors = await prisma.providers.findMany({
    where: {
      service_categories: {
        slug: 'doctor'
      }
    },
    take: 5,
    include: {
      users: {
        select: { email: true }
      },
      provider_branches: {
        select: { name: true },
        take: 1
      },
      provider_specialties: {
        include: {
          specialties: {
            select: { name: true }
          }
        }
      }
    }
  });

  console.log(`\n👨‍⚕️ Primeros 5 doctores:`);
  doctors.forEach((doc, i) => {
    console.log(`\n  ${i + 1}. ${doc.commercial_name || 'Sin nombre'}`);
    console.log(`     Email: ${doc.users?.email || 'N/A'}`);
    console.log(`     Sucursal: ${doc.provider_branches[0]?.name || 'N/A'}`);
    console.log(`     Especialidades: ${doc.provider_specialties.length}`);
    doc.provider_specialties.forEach(ps => {
      console.log(`       - ${ps.specialties?.name}: $${ps.fee}`);
    });
  });

  // 5. Verificar clinic_doctors
  const clinicDoctors = await prisma.clinic_doctors.findMany({
    take: 3,
    include: {
      users: {
        select: { email: true }
      },
      clinics: {
        select: { name: true }
      }
    }
  });

  console.log(`\n🏥 Doctores asociados a clínicas: ${clinicDoctors.length > 0 ? 'Sí hay' : 'No hay'}`);
  if (clinicDoctors.length > 0) {
    console.log('\n📋 Primeros 3:');
    clinicDoctors.forEach((cd, i) => {
      console.log(`  ${i + 1}. ID: ${cd.id}`);
      console.log(`     Email: ${cd.users?.email || 'N/A'}`);
      console.log(`     User ID: ${cd.user_id || 'No vinculado'}`);
      console.log(`     Clínica: ${cd.clinics?.name || 'N/A'}`);
    });
  }

  await prisma.$disconnect();
}

checkCurrentData()
  .then(() => {
    console.log('\n✅ Revisión completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
