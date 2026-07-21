import 'dotenv/config';
import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();

  const countClinicDoctors = await prisma.clinic_doctors.count();
  const clinicDoctors = await prisma.clinic_doctors.findMany({
    take: 20,
    include: {
      clinics: { select: { name: true } },
      users: { select: { email: true } },
    },
  });

  console.log(`📌 Se encontraron ${countClinicDoctors} registros en clinic_doctors:`);
  console.dir(clinicDoctors, { depth: null });

  const invitationsCount = await prisma.doctor_invitations.count();
  console.log(`📌 Se encontraron ${invitationsCount} invitaciones en doctor_invitations.`);

  if (countClinicDoctors > 0) {
    const deletedClinicDoctors = await prisma.clinic_doctors.deleteMany({});
    console.log(`✅ Se eliminaron ${deletedClinicDoctors.count} registros de clinic_doctors.`);
  }

  if (invitationsCount > 0) {
    const updatedInvitations = await prisma.doctor_invitations.updateMany({
      data: { status: 'cancelled' },
    });
    console.log(`✅ Se actualizaron ${updatedInvitations.count} invitaciones a 'cancelled'.`);
  }

  console.log('✅ Limpieza de vinculaciones de clínicas finalizada.');
}

main()
  .catch((e) => {
    console.error('❌ Error executing cleanup script:', e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });
