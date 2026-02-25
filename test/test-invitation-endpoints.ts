/**
 * Script para probar los endpoints de invitación
 * 
 * Uso:
 * 1. Asegúrate de tener el servidor corriendo: npm run dev
 * 2. Reemplaza el TOKEN con un token válido de clínica
 * 3. Ejecuta: npx ts-node test/test-invitation-endpoints.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Token de una clínica (reemplazar con un token válido)
const CLINIC_TOKEN = 'TU_TOKEN_AQUI';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${CLINIC_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testInvitationEndpoints() {
  console.log('🧪 Probando endpoints de invitación...\n');

  const testEmail = 'doctor.test@example.com';

  try {
    // Test 1: Generar link de invitación
    console.log('1️⃣ POST /api/clinics/doctors/invite/link');
    console.log(`📤 Email: ${testEmail}`);
    
    try {
      const response1 = await api.post('/api/clinics/doctors/invite/link', {
        email: testEmail,
      });
      
      console.log('✅ Status:', response1.status);
      console.log('✅ Respuesta:', JSON.stringify(response1.data, null, 2));
    } catch (error: any) {
      if (error.response) {
        console.error('❌ Error Status:', error.response.status);
        console.error('❌ Error Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('❌ Error:', error.message);
      }
    }

    console.log('\n---\n');

    // Test 2: Enviar invitación por email
    console.log('2️⃣ POST /api/clinics/doctors/invitation');
    console.log(`📤 Email: ${testEmail}`);
    
    try {
      const response2 = await api.post('/api/clinics/doctors/invitation', {
        email: testEmail,
      });
      
      console.log('✅ Status:', response2.status);
      console.log('✅ Respuesta:', JSON.stringify(response2.data, null, 2));
    } catch (error: any) {
      if (error.response) {
        console.error('❌ Error Status:', error.response.status);
        console.error('❌ Error Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('❌ Error:', error.message);
      }
    }

    console.log('\n---\n');

    // Test 3: Ruta alternativa
    console.log('3️⃣ POST /api/clinics/doctors/invite');
    console.log(`📤 Email: ${testEmail}`);
    
    try {
      const response3 = await api.post('/api/clinics/doctors/invite', {
        email: testEmail,
      });
      
      console.log('✅ Status:', response3.status);
      console.log('✅ Respuesta:', JSON.stringify(response3.data, null, 2));
    } catch (error: any) {
      if (error.response) {
        console.error('❌ Error Status:', error.response.status);
        console.error('❌ Error Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('❌ Error:', error.message);
      }
    }

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ No se pudo conectar al servidor');
      console.error('   Asegúrate de que el servidor esté corriendo: npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

console.log('⚠️  IMPORTANTE: Reemplaza CLINIC_TOKEN con un token válido antes de ejecutar\n');
testInvitationEndpoints();
