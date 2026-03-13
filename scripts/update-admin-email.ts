import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function updateAdminEmail() {
  const prisma = getPrismaClient();

  try {
    console.log('🔍 Buscando usuario administrador...\n');

    const oldEmail = 'admin@medicones.com';
    const newEmail = 'panel.docalink@hotmail.com';

    // Buscar el usuario administrador con el email actual
    const adminUser = await prisma.users.findFirst({
      where: {
        email: oldEmail,
        role: 'admin',
      },
    });

    if (!adminUser) {
      console.error(`❌ No se encontró usuario administrador con email: ${oldEmail}`);
      console.log('\n📋 Usuarios administradores encontrados:');
      const allAdmins = await prisma.users.findMany({
        where: { role: 'admin' },
        select: { id: true, email: true, is_active: true },
      });
      allAdmins.forEach(admin => {
        console.log(`  - ${admin.email} (ID: ${admin.id}, Activo: ${admin.is_active})`);
      });
      return;
    }

    console.log('✅ Usuario administrador encontrado:');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email actual: ${adminUser.email}`);
    console.log(`   Rol: ${adminUser.role}`);
    console.log(`   Activo: ${adminUser.is_active}\n`);

    // Verificar si el nuevo email ya existe
    const existingUser = await prisma.users.findFirst({
      where: { email: newEmail },
    });

    if (existingUser) {
      console.error(`❌ ERROR: El email ${newEmail} ya está en uso por otro usuario (ID: ${existingUser.id})`);
      return;
    }

    // Actualizar el email
    console.log(`🔄 Actualizando email de ${oldEmail} a ${newEmail}...`);
    
    const updatedUser = await prisma.users.update({
      where: { id: adminUser.id },
      data: { email: newEmail },
    });

    console.log('\n✅ Email actualizado exitosamente:');
    console.log(`   ID: ${updatedUser.id}`);
    console.log(`   Email nuevo: ${updatedUser.email}`);
    console.log(`   Rol: ${updatedUser.role}`);
    console.log(`   Activo: ${updatedUser.is_active}`);
    console.log('\n💡 La contraseña se mantiene igual (no se modificó)');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('⚠️  El nuevo email ya existe en la base de datos');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
updateAdminEmail()
  .then(() => {
    console.log('\n🎉 Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
