import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from '../src/doctors/handler';
import { getPrismaClient } from '../src/shared/prisma';

async function main() {
  console.log('🔄 Iniciando prueba de disponibilidad...');
  const prisma = getPrismaClient();

  try {
    const user = await prisma.users.findFirst({
      where: { email: 'brandonalexpesantez@gmail.com' },
      include: {
        providers: true
      }
    });

    if (!user || !user.providers || user.providers.length === 0) {
      console.error('❌ Doctor brandonalexpesantez@gmail.com no encontrado');
      return;
    }

    const doctorId = user.providers[0].id;
    console.log(`👨‍⚕️ Doctor: ${user.email} (ID: ${doctorId})`);

    // Crear evento mock
    const event: any = {
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'paciente@test.com', // Cualquiera que esté logueado
        'authorization': ''
      },
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/doctors/availability'
        },
        authorizer: {
          lambda: {
            user: {
              id: 'paciente-user-id',
              email: 'paciente@test.com',
              role: 'patient'
            }
          }
        }
      },
      queryStringParameters: {
        doctorId: doctorId,
        date: '2026-06-16' // Martes
      }
    };

    console.log('🚀 Llamando al handler de disponibilidad...');
    const result = await handler(event);
    console.log('📊 Status Code:', result.statusCode);
    
    if (result.body) {
      const response = JSON.parse(result.body);
      console.log('📦 Respuesta:', JSON.stringify(response, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error en la prueba:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
