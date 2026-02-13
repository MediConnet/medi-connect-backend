/**
 * Script simple para probar eliminación de usuario
 * Ejecutar con: npx ts-node test/test-delete-simple.ts USER_ID
 */

import { getPrismaClient } from '../src/shared/prisma';

async function testDelete() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('❌ Debes proporcionar un USER_ID');
    console.log('Uso: npx ts-node test/test-delete-simple.ts USER_ID');
    process.exit(1);
  }

  const prisma = getPrismaClient();

  try {
    console.log(`🔍 Buscando usuario ${userId}...`);
    
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        patients: true,
        providers: true,
        clinics: true,
        sessions: true,
        password_resets: true,
      },
    });

    if (!user) {
      console.error(`❌ Usuario ${userId} no encontrado`);
      process.exit(1);
    }

    console.log(`✅ Usuario encontrado: ${user.email}`);
    console.log(`   - Pacientes: ${user.patients.length}`);
    console.log(`   - Proveedores: ${user.providers.length}`);
    console.log(`   - Clínicas: ${user.clinics ? 1 : 0}`);
    console.log(`   - Sesiones: ${user.sessions.length}`);
    console.log(`   - Password resets: ${user.password_resets.length}`);

    console.log(`\n🗑️ Intentando eliminar usuario...`);
    
    await prisma.users.delete({
      where: { id: userId },
    });

    console.log(`✅ Usuario eliminado exitosamente`);

    // Verificar que se eliminó
    const userAfter = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (userAfter) {
      console.error(`❌ ERROR: El usuario AÚN EXISTE en la base de datos`);
    } else {
      console.log(`✅ CONFIRMADO: El usuario fue eliminado de la base de datos`);
    }

  } catch (error: any) {
    console.error(`❌ Error al eliminar usuario:`, error.message);
    console.error(`Código de error:`, error.code);
    console.error(`Detalles:`, error);
    
    if (error.code === 'P2003') {
      console.error(`\n⚠️ ERROR DE FOREIGN KEY CONSTRAINT`);
      console.error(`Hay datos relacionados que están bloqueando la eliminación.`);
      console.error(`Necesitas configurar CASCADE en las foreign keys.`);
    }
  }
}

testDelete()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
