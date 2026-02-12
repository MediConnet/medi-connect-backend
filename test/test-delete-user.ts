import { getPrismaClient } from '../src/shared/prisma';

/**
 * Script de prueba para verificar la eliminación completa de usuarios
 * 
 * Este script:
 * 1. Crea un usuario de prueba con datos relacionados
 * 2. Verifica que todos los datos existen
 * 3. Elimina el usuario
 * 4. Verifica que TODOS los datos relacionados fueron eliminados (CASCADE)
 */

async function testUserDeletion() {
  const prisma = getPrismaClient();

  console.log('🧪 Iniciando prueba de eliminación de usuario...\n');

  try {
    // 1. Crear usuario de prueba
    console.log('1️⃣ Creando usuario de prueba...');
    const testUser = await prisma.users.create({
      data: {
        id: '00000000-0000-0000-0000-000000000999',
        email: 'test-delete@example.com',
        password_hash: 'test_hash',
        role: 'patient',
        is_active: true,
      },
    });
    console.log(`✅ Usuario creado: ${testUser.email} (ID: ${testUser.id})\n`);

    // 2. Crear paciente asociado
    console.log('2️⃣ Creando paciente asociado...');
    const testPatient = await prisma.patients.create({
      data: {
        id: '00000000-0000-0000-0000-000000000998',
        user_id: testUser.id,
        full_name: 'Test Patient Delete',
        phone: '1234567890',
      },
    });
    console.log(`✅ Paciente creado: ${testPatient.full_name} (ID: ${testPatient.id})\n`);

    // 3. Crear sesión
    console.log('3️⃣ Creando sesión...');
    const testSession = await prisma.sessions.create({
      data: {
        id: '00000000-0000-0000-0000-000000000997',
        user_id: testUser.id,
        token: 'test_token_12345',
        expires_at: new Date(Date.now() + 86400000),
      },
    });
    console.log(`✅ Sesión creada (ID: ${testSession.id})\n`);

    // 4. Crear password reset
    console.log('4️⃣ Creando password reset...');
    const testPasswordReset = await prisma.password_resets.create({
      data: {
        id: '00000000-0000-0000-0000-000000000996',
        user_id: testUser.id,
        email: testUser.email,
        token: 'reset_token_12345',
        expires_at: new Date(Date.now() + 3600000),
      },
    });
    console.log(`✅ Password reset creado (ID: ${testPasswordReset.id})\n`);

    // 5. Crear notificación
    console.log('5️⃣ Creando notificación...');
    const testNotification = await prisma.notifications.create({
      data: {
        id: '00000000-0000-0000-0000-000000000995',
        patient_id: testPatient.id,
        type: 'SYSTEM',
        title: 'Test Notification',
        body: 'This is a test notification',
      },
    });
    console.log(`✅ Notificación creada (ID: ${testNotification.id})\n`);

    // 6. Verificar que todos los datos existen
    console.log('6️⃣ Verificando que todos los datos existen...');
    const userExists = await prisma.users.findUnique({ where: { id: testUser.id } });
    const patientExists = await prisma.patients.findUnique({ where: { id: testPatient.id } });
    const sessionExists = await prisma.sessions.findUnique({ where: { id: testSession.id } });
    const passwordResetExists = await prisma.password_resets.findUnique({ where: { id: testPasswordReset.id } });
    const notificationExists = await prisma.notifications.findUnique({ where: { id: testNotification.id } });

    console.log(`   Usuario: ${userExists ? '✅ Existe' : '❌ No existe'}`);
    console.log(`   Paciente: ${patientExists ? '✅ Existe' : '❌ No existe'}`);
    console.log(`   Sesión: ${sessionExists ? '✅ Existe' : '❌ No existe'}`);
    console.log(`   Password Reset: ${passwordResetExists ? '✅ Existe' : '❌ No existe'}`);
    console.log(`   Notificación: ${notificationExists ? '✅ Existe' : '❌ No existe'}\n`);

    // 7. ELIMINAR USUARIO
    console.log('7️⃣ 🗑️ ELIMINANDO USUARIO...');
    await prisma.users.delete({
      where: { id: testUser.id },
    });
    console.log(`✅ Usuario eliminado\n`);

    // 8. Verificar que TODOS los datos fueron eliminados (CASCADE)
    console.log('8️⃣ Verificando que TODOS los datos fueron eliminados (CASCADE)...');
    const userAfter = await prisma.users.findUnique({ where: { id: testUser.id } });
    const patientAfter = await prisma.patients.findUnique({ where: { id: testPatient.id } });
    const sessionAfter = await prisma.sessions.findUnique({ where: { id: testSession.id } });
    const passwordResetAfter = await prisma.password_resets.findUnique({ where: { id: testPasswordReset.id } });
    const notificationAfter = await prisma.notifications.findUnique({ where: { id: testNotification.id } });

    console.log(`   Usuario: ${userAfter ? '❌ AÚN EXISTE' : '✅ Eliminado'}`);
    console.log(`   Paciente: ${patientAfter ? '❌ AÚN EXISTE' : '✅ Eliminado (CASCADE)'}`);
    console.log(`   Sesión: ${sessionAfter ? '❌ AÚN EXISTE' : '✅ Eliminado (CASCADE)'}`);
    console.log(`   Password Reset: ${passwordResetAfter ? '❌ AÚN EXISTE' : '✅ Eliminado (CASCADE)'}`);
    console.log(`   Notificación: ${notificationAfter ? '❌ AÚN EXISTE' : '✅ Eliminado (CASCADE)'}\n`);

    // 9. Resultado final
    if (!userAfter && !patientAfter && !sessionAfter && !passwordResetAfter && !notificationAfter) {
      console.log('✅✅✅ PRUEBA EXITOSA: Todos los datos fueron eliminados correctamente\n');
      console.log('🎉 El CASCADE DELETE está funcionando perfectamente!');
    } else {
      console.log('❌❌❌ PRUEBA FALLIDA: Algunos datos NO fueron eliminados\n');
      console.log('⚠️ Revisa la configuración de CASCADE en las foreign keys');
    }

  } catch (error: any) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error(error);
  }
}

// Ejecutar prueba
testUserDeletion()
  .then(() => {
    console.log('\n✅ Prueba completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
