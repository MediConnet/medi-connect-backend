import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from '../src/clinics/handler';
import { getPrismaClient } from '../src/shared/prisma';

const runTest = async () => {
  console.log('🔄 Preparando prueba de citas de clínica...');

  const prisma = getPrismaClient();

  const clinicUser = await prisma.users.findFirst({
    where: { email: 'clinic@medicones.com' } 
  });

  if (!clinicUser) {
    console.error('❌ Error: No se encontró al usuario de la clínica. Ejecuta "npx prisma db seed" primero.');
    return;
  }

  console.log(`🏥 Probando con la clínica de: ${clinicUser.email} (${clinicUser.id})`);

  const mockEvent: any = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': clinicUser.email,
      'authorization': ''
    },
    requestContext: {
      http: { method: 'GET', path: '/api/clinics/appointments' },
      authorizer: {
        lambda: {
          user: {
            id: clinicUser.id,
            email: clinicUser.email,
            role: 'provider'
          }
        }
      }
    },
    queryStringParameters: { limit: '10' }
  };

  console.log('🚀 Ejecutando handler de clínicas (Citas)...');
  try {
    const result = await handler(mockEvent);
    
    console.log('\n--- RESULTADO CITAS ---');
    console.log('Status:', result.statusCode);
    if (result.body) {
      const body = JSON.parse(result.body);
      if (body.success && Array.isArray(body.data)) {
        console.log(`Encontradas ${body.data.length} citas.`);
        body.data.slice(0, 3).forEach((apt: any) => {
          console.log(`ID: ${apt.id}`);
          console.log(`  Fecha original: ${apt.originalDate || 'No devuelta'}`);
          console.log(`  Fecha (Ecuador): ${apt.date}`);
          console.log(`  Hora (Ecuador): ${apt.time}`);
          console.log(`  Paciente: ${apt.patientName}`);
        });
      } else {
        console.dir(body, { depth: null, colors: true }); 
      }
    }
  } catch (error) {
    console.error('❌ Error ejecutando el handler:', error);
  }

  // Ahora probamos recepción de hoy
  console.log('\n🚀 Ejecutando handler de clínicas (Recepción Hoy)...');
  mockEvent.requestContext.http.path = '/api/clinics/reception/today';
  try {
    const result = await handler(mockEvent);
    console.log('\n--- RESULTADO RECEPCIÓN ---');
    console.log('Status:', result.statusCode);
    if (result.body) {
      const body = JSON.parse(result.body);
      if (body.success && Array.isArray(body.data)) {
        console.log(`Encontradas ${body.data.length} citas en recepción.`);
        body.data.slice(0, 3).forEach((apt: any) => {
          console.log(`ID: ${apt.id}`);
          console.log(`  Hora (Ecuador): ${apt.time}`);
          console.log(`  Paciente: ${apt.patientName}`);
        });
      } else {
        console.dir(body, { depth: null, colors: true }); 
      }
    }
  } catch (error) {
    console.error('❌ Error ejecutando el handler:', error);
  }
};

runTest()
  .finally(() => getPrismaClient().$disconnect());
