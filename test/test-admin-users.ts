import { getPrismaClient } from '../src/shared/prisma';

async function testAdminUsers() {
  console.log('🧪 [TEST] Probando endpoint de usuarios admin...\n');
  
  const prisma = getPrismaClient();

  try {
    // Obtener usuarios con sus relaciones
    const users = await prisma.users.findMany({
      include: {
        providers: {
          select: {
            id: true,
            commercial_name: true,
            verification_status: true,
            service_categories: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
          take: 1,
        },
        patients: {
          select: {
            id: true,
            full_name: true,
            phone: true,
          },
          take: 1,
        },
        clinics: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 20,
    });

    console.log(`📊 Total usuarios: ${users.length}\n`);
    
    // Contar por tipo
    const typeCounts = {
      withClinic: users.filter(u => u.clinics).length,
      withProvider: users.filter(u => u.providers.length > 0).length,
      withPatient: users.filter(u => u.patients.length > 0).length,
      admins: users.filter(u => u.role === 'admin').length,
    };
    console.log('📊 Distribución:', typeCounts, '\n');
    
    // Mostrar usuarios con clínica
    const usersWithClinic = users.filter(u => u.clinics);
    console.log(`🏥 Usuarios con clínica (${usersWithClinic.length}):`);
    usersWithClinic.forEach(u => {
      console.log(`  - ${u.email}`);
      console.log(`    Clínica: ${u.clinics?.name}`);
      console.log(`    Teléfono: ${u.clinics?.phone}`);
      console.log(`    Dirección: ${u.clinics?.address}\n`);
    });

    // Mostrar algunos providers
    const usersWithProvider = users.filter(u => u.providers.length > 0).slice(0, 3);
    console.log(`👨‍⚕️ Algunos providers (${usersWithProvider.length}):`);
    usersWithProvider.forEach(u => {
      const provider = u.providers[0];
      console.log(`  - ${u.email}`);
      console.log(`    Nombre: ${provider.commercial_name}`);
      console.log(`    Tipo: ${provider.service_categories?.name}`);
      console.log(`    Estado: ${provider.verification_status}\n`);
    });

    console.log('✅ [TEST] Prueba completada exitosamente');
  } catch (error: any) {
    console.error('❌ [TEST] Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testAdminUsers();
