/**
 * Script de prueba para el sistema de invitaciones de médicos
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { sendInvitation } from '../src/clinics/invitations.controller';
import { generateJWT } from '../src/shared/auth';

async function testInvitation() {
  console.log('🧪 Iniciando prueba de invitación de médicos...\n');

  // Simular un usuario clínica autenticado
  // Necesitamos un userId real de una clínica en la base de datos
  const testUserId = 'test-user-id'; // Reemplazar con un userId real
  const testEmail = 'bobbie.conroy491@mazun.org';

  // Generar token JWT
  const token = generateJWT({
    userId: testUserId,
    email: 'clinic@test.com',
    role: 'provider',
  });

  // Crear evento simulado
  const event: Partial<APIGatewayProxyEventV2> = {
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: testEmail,
    }),
    requestContext: {
      http: {
        method: 'POST',
        path: '/api/clinics/doctors/invite',
      },
    } as any,
  };

  try {
    console.log('📧 Enviando invitación a:', testEmail);
    console.log('🔑 Token generado:', token.substring(0, 50) + '...\n');

    const result = await sendInvitation(event as APIGatewayProxyEventV2);
    
    console.log('\n📊 Resultado:');
    console.log('Status:', result.statusCode);
    console.log('Body:', JSON.parse(result.body || '{}'));

    if (result.statusCode === 201) {
      console.log('\n✅ ¡Invitación enviada exitosamente!');
    } else {
      console.log('\n❌ Error al enviar invitación');
    }
  } catch (error: any) {
    console.error('\n❌ Error en la prueba:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar prueba
testInvitation()
  .then(() => {
    console.log('\n✅ Prueba completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
