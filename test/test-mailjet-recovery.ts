/**
 * Test rápido de Mailjet para recuperación de contraseña
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testMailjetRecovery() {
  console.log('🔐 Probando recuperación de contraseña con Mailjet...\n');

  try {
    // Solicitar recuperación
    const response = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
      email: 'kevincata2005@gmail.com',
    });

    console.log('✅ Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n📧 Revisa tu email: kevincata2005@gmail.com');
    console.log('📝 Busca el email de "Recuperación de Contraseña - DOCALINK"');
    console.log('🔗 Copia el token del enlace y úsalo para resetear la contraseña\n');

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testMailjetRecovery();
