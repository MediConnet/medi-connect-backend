/**
 * Script de prueba para endpoints de tipos de consulta
 * 
 * Uso:
 * 1. Asegúrate de tener el servidor corriendo: npm run dev
 * 2. Ejecuta: npx ts-node test/test-consultation-prices.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Token de un médico (reemplazar con un token válido)
const DOCTOR_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${DOCTOR_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testConsultationPrices() {
  console.log('🧪 Iniciando pruebas de tipos de consulta...\n');

  try {
    // 1. Listar tipos de consulta existentes
    console.log('1️⃣ GET /api/doctors/consultation-prices');
    const listResponse = await api.get('/api/doctors/consultation-prices');
    console.log('✅ Respuesta:', JSON.stringify(listResponse.data, null, 2));
    console.log(`📊 Total de tipos: ${listResponse.data.data?.length || 0}\n`);

    // 2. Crear un nuevo tipo de consulta
    console.log('2️⃣ POST /api/doctors/consultation-prices');
    const createData = {
      consultationType: 'Consulta de prueba',
      price: 25.00,
      description: 'Tipo de consulta creado para pruebas',
      durationMinutes: 30,
    };
    console.log('📤 Enviando:', JSON.stringify(createData, null, 2));
    
    const createResponse = await api.post('/api/doctors/consultation-prices', createData);
    console.log('✅ Respuesta:', JSON.stringify(createResponse.data, null, 2));
    
    const createdId = createResponse.data.data?.id;
    console.log(`📝 ID creado: ${createdId}\n`);

    if (!createdId) {
      console.error('❌ No se pudo obtener el ID del tipo de consulta creado');
      return;
    }

    // 3. Actualizar el tipo de consulta
    console.log('3️⃣ PUT /api/doctors/consultation-prices/:id');
    const updateData = {
      consultationType: 'Consulta de prueba (actualizada)',
      price: 30.00,
      description: 'Descripción actualizada',
      durationMinutes: 45,
    };
    console.log('📤 Enviando:', JSON.stringify(updateData, null, 2));
    
    const updateResponse = await api.put(`/api/doctors/consultation-prices/${createdId}`, updateData);
    console.log('✅ Respuesta:', JSON.stringify(updateResponse.data, null, 2));
    console.log('');

    // 4. Eliminar el tipo de consulta
    console.log('4️⃣ DELETE /api/doctors/consultation-prices/:id');
    console.log(`🗑️ Eliminando ID: ${createdId}`);
    
    const deleteResponse = await api.delete(`/api/doctors/consultation-prices/${createdId}`);
    console.log('✅ Respuesta:', JSON.stringify(deleteResponse.data, null, 2));
    console.log('');

    // 5. Verificar que ya no aparece en la lista
    console.log('5️⃣ Verificar eliminación - GET /api/doctors/consultation-prices');
    const verifyResponse = await api.get('/api/doctors/consultation-prices');
    const stillExists = verifyResponse.data.data?.some((item: any) => item.id === createdId);
    
    if (stillExists) {
      console.log('❌ ERROR: El tipo de consulta aún aparece en la lista');
    } else {
      console.log('✅ CORRECTO: El tipo de consulta ya no aparece en la lista (soft delete funcionó)');
    }
    console.log('');

    console.log('🎉 ¡Todas las pruebas completadas exitosamente!');

  } catch (error: any) {
    console.error('❌ Error en las pruebas:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Ejecutar pruebas
testConsultationPrices();
