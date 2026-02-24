/**
 * Script de prueba para el endpoint público de tipos de consulta
 * 
 * Uso:
 * 1. Asegúrate de tener el servidor corriendo: npm run dev
 * 2. Ejecuta: npx ts-node test/test-public-consultation-prices.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Token de un paciente (reemplazar con un token válido)
const PATIENT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// ID del doctor de ejemplo (del mensaje del frontend)
const DOCTOR_ID = '76820234-174a-4fa0-9221-404dd93a7e77';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${PATIENT_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testPublicConsultationPrices() {
  console.log('🧪 Iniciando pruebas del endpoint público de tipos de consulta...\n');

  try {
    // Test 1: Obtener tipos de consulta de un médico
    console.log('1️⃣ GET /api/public/doctors/:doctorId/consultation-prices');
    console.log(`📤 Doctor ID: ${DOCTOR_ID}`);
    
    const response = await api.get(`/api/public/doctors/${DOCTOR_ID}/consultation-prices`);
    
    console.log('✅ Status:', response.status);
    console.log('✅ Respuesta:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      const prices = response.data.data;
      console.log(`📊 Total de tipos de consulta: ${prices.length}`);
      
      if (prices.length > 0) {
        console.log('\n📋 Tipos de consulta encontrados:');
        prices.forEach((price: any, index: number) => {
          console.log(`\n  ${index + 1}. ${price.consultationType}`);
          console.log(`     💰 Precio: $${price.price}`);
          console.log(`     🏥 Especialidad: ${price.specialtyName || 'N/A'}`);
          console.log(`     🆔 ID: ${price.id}`);
          console.log(`     ✅ Activo: ${price.isActive}`);
        });
      } else {
        console.log('ℹ️ El médico no tiene tipos de consulta configurados (array vacío)');
      }
    }
    
    console.log('\n✅ Test 1 completado exitosamente\n');

    // Test 2: Verificar estructura de respuesta
    console.log('2️⃣ Verificando estructura de respuesta...');
    
    if (response.data.data && Array.isArray(response.data.data)) {
      console.log('✅ data es un array');
      
      if (response.data.data.length > 0) {
        const firstItem = response.data.data[0];
        const requiredFields = ['id', 'specialtyId', 'specialtyName', 'consultationType', 'price', 'isActive'];
        
        console.log('\n📋 Verificando campos requeridos:');
        requiredFields.forEach(field => {
          const hasField = field in firstItem;
          console.log(`  ${hasField ? '✅' : '❌'} ${field}: ${hasField ? typeof firstItem[field] : 'FALTA'}`);
        });
      }
    } else {
      console.log('❌ data no es un array');
    }
    
    console.log('\n✅ Test 2 completado\n');

    // Test 3: Probar con doctor inexistente
    console.log('3️⃣ Probando con doctor inexistente...');
    
    try {
      await api.get('/api/public/doctors/00000000-0000-0000-0000-000000000000/consultation-prices');
      console.log('❌ ERROR: Debería haber retornado 404');
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctamente retorna 404 para doctor inexistente');
      } else {
        console.log('⚠️ Error inesperado:', error.message);
      }
    }
    
    console.log('\n✅ Test 3 completado\n');

    console.log('🎉 ¡Todas las pruebas completadas!');

  } catch (error: any) {
    console.error('❌ Error en las pruebas:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No se recibió respuesta del servidor');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Ejecutar pruebas
testPublicConsultationPrices();
