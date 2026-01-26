// test/test-appointments.ts
import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from '../src/doctors/handler';
import { getPrismaClient } from '../src/shared/prisma';

const runTest = async () => {
  console.log('🔄 Preparando prueba...');

  const prisma = getPrismaClient();

  const doctorUser = await prisma.users.findFirst({
    where: { email: 'doctor@medicones.com' } 
  });

  if (!doctorUser) {
    console.error('❌ Error: No se encontró al doctor. Ejecuta "npx prisma db seed" primero.');
    return;
  }

  console.log(`👨‍⚕️ Probando con el doctor: ${doctorUser.email} (${doctorUser.id})`);

  const mockEvent: any = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': doctorUser.email,
      'authorization': '' 
    },
    requestContext: {
      http: { method: 'GET', path: '/api/doctors/appointments' },
      authorizer: {
        lambda: {
          user: {
            id: doctorUser.id,
            email: doctorUser.email,
            role: 'provider'
          }
        }
      }
    },
    queryStringParameters: { limit: '10' }
  };

  console.log('🚀 Ejecutando Lambda...');
  try {
    const result = await handler(mockEvent);
    
    console.log('\n--- RESULTADO ---');
    console.log('Status:', result.statusCode);
    if (result.body) {
      const body = JSON.parse(result.body);
      console.dir(body, { depth: null, colors: true }); 
    }
  } catch (error) {
    console.error('❌ Error ejecutando el handler:', error);
  }
};

runTest();