/**
 * Script para limpiar invitaciones pendientes
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getPrismaClient } from '../src/shared/prisma';

async function cleanInvitations() {
  console.log('🧹 Limpiando invitaciones pendientes...\n');

  const prisma = getPrismaClient();
  const email = 'bobbie.conroy491@mazun.org';

  try {
    // Buscar invitaciones pendientes
    const pendingInvitations = await prisma.doctor_invitations.findMany({
      where: {
        email: email,
        status: 'pending',
      },
    });

    console.log(`📊 Invitaciones pendientes encontradas: ${pendingInvitations.length}`);

    if (pendingInvitations.length > 0) {
      console.log('\n📋 Detalles:');
      pendingInvitations.forEach((inv, index) => {
        console.log(`\n${index + 1}. ID: ${inv.id}`);
        console.log(`   Email: ${inv.email}`);
        console.log(`   Clínica: ${inv.clinic_id}`);
        console.log(`   Estado: ${inv.status}`);
        console.log(`   Expira: ${inv.expires_at.toLocaleString('es-ES')}`);
        if (inv.created_at) {
          console.log(`   Creada: ${inv.created_at.toLocaleString('es-ES')}`);
        }
      });

      // Marcar como expiradas
      console.log('\n🔄 Marcando invitaciones como expiradas...');
      const result = await prisma.doctor_invitations.updateMany({
        where: {
          email: email,
          status: 'pending',
        },
        data: {
          status: 'expired',
        },
      });

      console.log(`✅ ${result.count} invitaciones marcadas como expiradas`);

      // También limpiar registros de clinic_doctors con is_invited=true
      console.log('\n🔄 Limpiando registros de médicos invitados...');
      const deletedDoctors = await prisma.clinic_doctors.deleteMany({
        where: {
          users: {
            email: email
          },
          is_invited: true,
        },
      });

      console.log(`✅ ${deletedDoctors.count} registros de médicos invitados eliminados`);
    } else {
      console.log('\n✅ No hay invitaciones pendientes para limpiar');
    }

    console.log('\n✅ Limpieza completada');
    console.log('\n💡 Ahora puedes enviar una nueva invitación');
  } catch (error: any) {
    console.error('\n❌ Error al limpiar invitaciones:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar limpieza
cleanInvitations()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
