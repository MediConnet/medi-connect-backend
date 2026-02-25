/**
 * Script de verificación rápida del endpoint de consultation prices
 * 
 * Este script verifica que el endpoint público funcione correctamente
 * 
 * Uso:
 * 1. Inicia el servidor: npm run dev
 * 2. Ejecuta: npx ts-node test/verify-consultation-prices-endpoint.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// ID del doctor Kevin (del contexto)
const KEVIN_DOCTOR_ID = '76820234-174a-4fa0-9221-404dd93a7e77';

async function verifyEndpoint() {
  console.log('🔍 Verificando endpoint de consultation prices...\n');

  try {
    // Test sin autenticación (endpoint público)
    console.log(`📤 GET ${BASE_URL}/api/public/doctors/${KEVIN_DOCTOR_ID}/consultation-prices`);
    
    const response = await axios.get(
      `${BASE_URL}/api/public/doctors/${KEVIN_DOCTOR_ID}/consultation-prices`,
      {
        validateStatus: () => true, // No lanzar error en ningún status
      }
    );

    console.log(`\n📊 Status: ${response.status}`);
    console.log(`📊 Headers:`, response.headers['content-type']);
    
    if (response.status === 200) {
      console.log('✅ Endpoint funciona correctamente');
      console.log('\n📋 Datos recibidos:');
      console.log(JSON.stringify(response.data, null, 2));
      
      if (response.data.success && Array.isArray(response.data.data)) {
        console.log(`\n✅ Formato correcto: Array con ${response.data.data.length} elementos`);
      }
    } else if (response.status === 404) {
      console.log('❌ Error 404 - Endpoint no encontrado');
      console.log('Respuesta:', response.data);
    } else {
      console.log(`⚠️ Status inesperado: ${response.status}`);
      console.log('Respuesta:', response.data);
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

verifyEndpoint();
