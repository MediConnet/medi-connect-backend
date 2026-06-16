import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getPrismaClient } from '../src/shared/prisma';

const prisma = getPrismaClient();

async function main() {
  const email = 'brandonalexpesantez@gmail.com';
  
  console.log(`Buscando usuario: ${email}`);
  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  if (!user) {
    console.error('Usuario no encontrado');
    return;
  }

  console.log(`Desactivando asociaciones antiguas excepto con la clínica 'clinica'...`);
  
  // Buscar la clínica 'clinica'
  const targetClinic = await prisma.clinics.findFirst({
    where: { name: 'clinica' },
  });

  if (!targetClinic) {
    console.error("Clínica 'clinica' no encontrada.");
    return;
  }

  console.log(`Clínica activa objetivo ID: ${targetClinic.id}`);

  // Desactivar todas las demás asociaciones para este médico
  const result = await prisma.clinic_doctors.updateMany({
    where: {
      user_id: user.id,
      clinic_id: { not: targetClinic.id },
      is_active: true,
    },
    data: {
      is_active: false,
      updated_at: new Date(),
    },
  });

  console.log(`Desactivadas ${result.count} asociaciones antiguas.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
