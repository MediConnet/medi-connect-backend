import { getPrismaClient } from '../src/shared/prisma';

async function testAmbulanceProfile() {
  const prisma = getPrismaClient();

  console.log('🔍 [TEST] Iniciando diagnóstico de ambulancias...\n');

  try {
    // 1. Buscar todos los usuarios con ambulancias
    console.log('1️⃣ Buscando usuarios de ambulancias...');
    const ambulanceUsers = await prisma.users.findMany({
      where: {
        role: 'provider',
      },
      select: {
        id: true,
        email: true,
        role: true,
        is_active: true,
      },
    });

    console.log(`   ✅ Encontrados ${ambulanceUsers.length} usuarios provider\n`);

    // 2. Para cada usuario, buscar su provider
    for (const user of ambulanceUsers) {
      console.log(`📧 Usuario: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.is_active}`);

      // Buscar provider
      const provider = await prisma.providers.findFirst({
        where: { user_id: user.id },
        include: {
          service_categories: {
            select: { slug: true, name: true },
          },
          provider_branches: {
            where: { is_active: true },
          },
        },
      });

      if (!provider) {
        console.log(`   ❌ NO TIENE PROVIDER\n`);
        continue;
      }

      console.log(`   ✅ Provider encontrado:`);
      console.log(`      ID: ${provider.id}`);
      console.log(`      Nombre: ${provider.commercial_name}`);
      console.log(`      Categoría: ${provider.service_categories?.slug || 'N/A'}`);
      console.log(`      Status: ${provider.verification_status}`);
      console.log(`      Branches activas: ${provider.provider_branches.length}`);

      if (provider.provider_branches.length > 0) {
        const mainBranch = provider.provider_branches.find((b) => b.is_main) || provider.provider_branches[0];
        console.log(`      Branch principal:`);
        console.log(`         ID: ${mainBranch.id}`);
        console.log(`         Nombre: ${mainBranch.name}`);
        console.log(`         Teléfono: ${mainBranch.phone_contact || 'N/A'}`);
        console.log(`         Dirección: ${mainBranch.address_text || 'N/A'}`);
        console.log(`         is_main: ${mainBranch.is_main}`);
        console.log(`         is_active: ${mainBranch.is_active}`);
      } else {
        console.log(`      ❌ NO TIENE BRANCHES ACTIVAS`);
      }

      console.log('');
    }

    // 3. Buscar específicamente ambulancias
    console.log('\n2️⃣ Buscando providers de ambulancias específicamente...');
    const ambulanceCategory = await prisma.service_categories.findFirst({
      where: { slug: 'ambulance' },
    });

    if (!ambulanceCategory) {
      console.log('   ❌ NO EXISTE LA CATEGORÍA "ambulance"');
      console.log('   📋 Categorías disponibles:');
      const categories = await prisma.service_categories.findMany();
      categories.forEach((cat) => {
        console.log(`      - ${cat.slug}: ${cat.name}`);
      });
    } else {
      console.log(`   ✅ Categoría ambulance encontrada: ${ambulanceCategory.id}`);

      const ambulanceProviders = await prisma.providers.findMany({
        where: { category_id: ambulanceCategory.id },
        include: {
          users: {
            select: { email: true },
          },
          provider_branches: {
            where: { is_active: true },
          },
        },
      });

      console.log(`   ✅ Encontrados ${ambulanceProviders.length} providers de ambulancia\n`);

      ambulanceProviders.forEach((provider) => {
        console.log(`   📍 Ambulancia: ${provider.commercial_name}`);
        console.log(`      Email: ${provider.users?.email}`);
        console.log(`      Status: ${provider.verification_status}`);
        console.log(`      Branches: ${provider.provider_branches.length}`);
      });
    }

    // 4. Probar el endpoint simulado
    console.log('\n3️⃣ Simulando llamada al endpoint...');
    const testEmail = 'ambulancia21@gmail.com'; // Cambia esto por el email que estás probando
    
    const testUser = await prisma.users.findFirst({
      where: { email: testEmail },
    });

    if (!testUser) {
      console.log(`   ❌ Usuario ${testEmail} no encontrado`);
    } else {
      console.log(`   ✅ Usuario encontrado: ${testUser.id}`);

      const testProvider = await prisma.providers.findFirst({
        where: { user_id: testUser.id },
        include: {
          provider_branches: {
            where: { is_active: true },
          },
        },
      });

      if (!testProvider) {
        console.log(`   ❌ Provider no encontrado para este usuario`);
        console.log(`   🔧 SOLUCIÓN: Crear provider y branch para este usuario`);
      } else {
        console.log(`   ✅ Provider encontrado: ${testProvider.id}`);
        console.log(`   ✅ Branches activas: ${testProvider.provider_branches.length}`);

        if (testProvider.provider_branches.length === 0) {
          console.log(`   ❌ NO TIENE BRANCHES ACTIVAS`);
          console.log(`   🔧 SOLUCIÓN: Crear branch para este provider`);
        } else {
          console.log(`   ✅ TODO CORRECTO - El endpoint debería funcionar`);
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Error en el diagnóstico:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAmbulanceProfile();
