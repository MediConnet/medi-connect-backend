import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';

async function linkClinicsToUsers() {
  console.log('🔗 [LINK CLINICS] Vinculando clínicas con usuarios...\n');
  
  dotenv.config();

  // Usar PrismaClient directamente sin adaptador
  const prisma = new PrismaClient() as any;

  try {
    // 1. Obtener todas las clínicas sin user_id
    const clinicsWithoutUser = await prisma.clinics.findMany({
      where: {
        user_id: null,
      },
    });

    console.log(`📊 [INFO] Clínicas sin usuario: ${clinicsWithoutUser.length}`);

    if (clinicsWithoutUser.length === 0) {
      console.log('✅ [INFO] Todas las clínicas ya tienen usuario asignado');
      
      // Mostrar clínicas existentes
      const allClinics = await prisma.clinics.findMany({
        include: {
          users: {
            select: {
              email: true,
              role: true,
            },
          },
        },
      });
      
      console.log('\n🏥 [INFO] Clínicas existentes:');
      allClinics.forEach((c: any) => {
        console.log(`  - ${c.name}`);
        console.log(`    Email: ${c.users?.email || 'Sin usuario'}`);
        console.log(`    User ID: ${c.user_id || 'NULL'}`);
        console.log('');
      });
      
      return;
    }

    console.log('\n🏥 [INFO] Clínicas a vincular:');
    clinicsWithoutUser.forEach((c: any) => {
      console.log(`  - ${c.name} (ID: ${c.id})`);
    });

    console.log('\n📝 [INFO] Creando usuarios para cada clínica...\n');

    // 2. Crear un usuario para cada clínica
    for (const clinic of clinicsWithoutUser) {
      // Generar email basado en el nombre de la clínica
      const emailName = clinic.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/\s+/g, '') // Quitar espacios
        .replace(/[^a-z0-9]/g, ''); // Solo letras y números
      
      const email = `${emailName}@mediconnect.com`;
      
      // Verificar si el email ya existe
      const existingUser = await prisma.users.findFirst({
        where: { email },
      });

      let userId: string;

      if (existingUser) {
        console.log(`⚠️  [INFO] Usuario con email ${email} ya existe, usando ese usuario`);
        userId = existingUser.id;
      } else {
        // Crear nuevo usuario
        userId = randomUUID();
        const hashedPassword = await bcrypt.hash('Clinica123!', 10);
        
        const user = await prisma.users.create({
          data: {
            id: userId,
            email: email,
            password_hash: hashedPassword,
            role: 'user', // Las clínicas tienen role 'user'
            is_active: true,
            created_at: new Date(),
          },
        });
        
        console.log(`✅ [CREATED] Usuario creado: ${user.email}`);
      }

      // 3. Vincular clínica con usuario
      await prisma.clinics.update({
        where: { id: clinic.id },
        data: { user_id: userId },
      });

      console.log(`🔗 [LINKED] Clínica "${clinic.name}" vinculada con usuario ${email}`);
      console.log(`   Password: Clinica123!\n`);
    }

    console.log('\n🎉 [SUCCESS] Todas las clínicas han sido vinculadas con usuarios!\n');
    
    // 4. Mostrar resumen
    const allClinics = await prisma.clinics.findMany({
      include: {
        users: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });
    
    console.log('📋 [SUMMARY] Resumen de clínicas:');
    console.log('═'.repeat(60));
    allClinics.forEach((c: any) => {
      console.log(`\n🏥 ${c.name}`);
      console.log(`   Email: ${c.users?.email || 'Sin usuario'}`);
      console.log(`   Password: Clinica123!`);
      console.log(`   User ID: ${c.user_id || 'NULL'}`);
      console.log(`   Activa: ${c.is_active ? 'Sí' : 'No'}`);
    });
    console.log('\n' + '═'.repeat(60));

    console.log('\n💡 [NEXT STEPS] Ahora puedes:');
    console.log('   1. Reiniciar el servidor: npm run dev');
    console.log('   2. Las clínicas aparecerán en GET /api/admin/users');
    console.log('   3. Puedes hacer login con cualquiera de los emails de arriba');
    console.log('   4. Password para todas: Clinica123!');

  } catch (error: any) {
    console.error('❌ [ERROR] Error al vincular clínicas:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
linkClinicsToUsers()
  .then(() => {
    console.log('\n✅ [DONE] Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [FATAL] Error fatal:', error);
    process.exit(1);
  });
