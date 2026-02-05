import { getPrismaClient } from '../src/shared/prisma';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

async function createTestClinic() {
  console.log('🏥 [CREATE CLINIC] Creando clínica de prueba...\n');
  
  const prisma = getPrismaClient();

  try {
    // 1. Verificar si ya existe una clínica
    const existingClinics = await prisma.clinics.findMany({
      include: {
        users: true,
      },
    });

    console.log(`📊 [INFO] Clínicas existentes en BD: ${existingClinics.length}`);
    
    if (existingClinics.length > 0) {
      console.log('\n🏥 [INFO] Clínicas encontradas:');
      existingClinics.forEach(c => {
        console.log(`  - ${c.name}`);
        console.log(`    Email: ${c.users?.email || 'Sin usuario'}`);
        console.log(`    User ID: ${c.user_id}`);
        console.log(`    Activa: ${c.is_active}`);
        console.log('');
      });
      
      console.log('✅ [INFO] Ya existen clínicas en la base de datos');
      console.log('💡 [INFO] Estas clínicas deberían aparecer en GET /api/admin/users');
      return;
    }

    console.log('⚠️  [INFO] No hay clínicas en la base de datos');
    console.log('📝 [INFO] Creando clínica de prueba...\n');

    // 2. Crear usuario para la clínica
    const userId = randomUUID();
    const hashedPassword = await bcrypt.hash('Clinica123!', 10);
    
    const user = await prisma.users.create({
      data: {
        id: userId,
        email: 'clinicacentral@mediconnect.com',
        password_hash: hashedPassword,
        role: 'user', // Las clínicas tienen role 'user'
        is_active: true,
        created_at: new Date(),
      },
    });
    
    console.log('✅ [CREATED] Usuario creado:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}\n`);
    
    // 3. Crear clínica
    const clinicId = randomUUID();
    const clinic = await prisma.clinics.create({
      data: {
        id: clinicId,
        user_id: userId,
        name: 'Clínica Central',
        address: 'Av. Principal 123, Quito, Ecuador',
        phone: '0999999999',
        whatsapp: '0999999999',
        description: 'Clínica médica con múltiples especialidades',
        is_active: true,
        created_at: new Date(),
      },
    });
    
    console.log('✅ [CREATED] Clínica creada:');
    console.log(`   Nombre: ${clinic.name}`);
    console.log(`   Dirección: ${clinic.address}`);
    console.log(`   Teléfono: ${clinic.phone}`);
    console.log(`   ID: ${clinic.id}\n`);
    
    console.log('🎉 [SUCCESS] Clínica de prueba creada exitosamente!\n');
    console.log('📋 [CREDENTIALS] Credenciales de acceso:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: Clinica123!`);
    console.log('');
    console.log('💡 [NEXT STEPS] Ahora puedes:');
    console.log('   1. Reiniciar el servidor: npm run dev');
    console.log('   2. Hacer login con las credenciales de arriba');
    console.log('   3. Verificar en GET /api/admin/users que aparece la clínica');

  } catch (error: any) {
    console.error('❌ [ERROR] Error al crear clínica:', error.message);
    
    if (error.code === 'P2002') {
      console.error('⚠️  [ERROR] El email ya existe en la base de datos');
      console.error('💡 [TIP] Cambia el email en el script o elimina el usuario existente');
    }
    
    throw error;
  }
}

// Ejecutar
createTestClinic()
  .then(() => {
    console.log('\n✅ [DONE] Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [FATAL] Error fatal:', error);
    process.exit(1);
  });
