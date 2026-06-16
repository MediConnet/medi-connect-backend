import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from '../src/doctors/handler';
import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  const prisma = getPrismaClient();
  const clinicId = 'cd097385-8d85-4147-97aa-4bfc67326f4f'; // clinica
  
  try {
    const associates = await prisma.clinic_doctors.findMany({
      where: { clinic_id: clinicId, is_active: true },
      include: {
        users: {
          include: {
            providers: true
          }
        }
      }
    });

    console.log(`Encontrados ${associates.length} médicos activos en la clínica.`);

    for (const assoc of associates) {
      const provider = assoc.users?.providers?.[0];
      if (!provider) continue;

      console.log(`\n--------------------------------------------`);
      console.log(`Médico: ${provider.commercial_name} (User Email: ${assoc.users?.email})`);
      console.log(`Provider ID: ${provider.id}, Clinic Doctor ID: ${assoc.id}`);

      // Query availability via doctor handler
      const event: any = {
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': 'paciente@test.com',
          'authorization': ''
        },
        requestContext: {
          http: { method: 'GET', path: '/api/doctors/availability' },
          authorizer: {
            lambda: {
              user: { id: 'patient-id', email: 'paciente@test.com', role: 'patient' }
            }
          }
        },
        queryStringParameters: {
          doctorId: provider.id,
          date: '2026-06-16'
        }
      };

      const result = await handler(event);
      if (result.body) {
        const body = JSON.parse(result.body);
        console.log(`Disponibilidad Martes 16 Jun:`, body.data?.availableSlots || 'Ninguna');
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
