/**
 * Script de prueba para Gmail API
 * 
 * Este script prueba todos los endpoints de Gmail API
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function testGmailStatus() {
  logSection('📊 TEST 1: Verificar estado de autorización');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/gmail/status`);
    
    if (response.data.success) {
      log('✅ Estado obtenido correctamente', 'green');
      console.log('Respuesta:', JSON.stringify(response.data, null, 2));
      
      if (response.data.data.authorized) {
        log('✅ Gmail API está autorizada', 'green');
        return true;
      } else {
        log('⚠️  Gmail API NO está autorizada', 'yellow');
        log(`   Visita: ${BASE_URL}/api/gmail/authorize`, 'yellow');
        return false;
      }
    }
  } catch (error: any) {
    log('❌ Error al verificar estado', 'red');
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testGetAuthUrl() {
  logSection('🔑 TEST 2: Obtener URL de autorización');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/gmail/authorize`);
    
    if (response.data.success) {
      log('✅ URL de autorización obtenida', 'green');
      console.log('\nInstrucciones:');
      response.data.data.instructions.forEach((instruction: string) => {
        console.log(`   ${instruction}`);
      });
      console.log('\nURL de autorización:');
      log(response.data.data.authUrl, 'blue');
      return true;
    }
  } catch (error: any) {
    log('❌ Error al obtener URL de autorización', 'red');
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testSendEmail(testEmail: string) {
  logSection('📧 TEST 3: Enviar correo de prueba');
  
  try {
    const emailData = {
      to: testEmail,
      subject: '🧪 Correo de Prueba - MediConnect Backend',
      message: `
        <h1>¡Hola desde MediConnect!</h1>
        <p>Este es un correo de prueba enviado desde la API de Gmail.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Sistema:</strong> MediConnect Backend</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Si recibiste este correo, significa que la integración con Gmail API está funcionando correctamente. ✅
        </p>
      `,
      isHtml: true,
    };
    
    log(`Enviando correo a: ${testEmail}`, 'blue');
    
    const response = await axios.post(`${BASE_URL}/api/gmail/send`, emailData);
    
    if (response.data.success) {
      log('✅ Correo enviado exitosamente', 'green');
      console.log('Respuesta:', JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error: any) {
    log('❌ Error al enviar correo', 'red');
    console.error(error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      log('\n⚠️  No estás autorizado. Ejecuta primero:', 'yellow');
      log(`   ${BASE_URL}/api/gmail/authorize`, 'yellow');
    }
    return false;
  }
}

async function testSendPlainTextEmail(testEmail: string) {
  logSection('📝 TEST 4: Enviar correo de texto plano');
  
  try {
    const emailData = {
      to: testEmail,
      subject: 'Correo de Texto Plano - MediConnect',
      message: `
Hola desde MediConnect!

Este es un correo de texto plano (sin HTML).

Fecha: ${new Date().toLocaleString()}
Sistema: MediConnect Backend

Si recibiste este correo, la integración está funcionando correctamente.
      `,
      isHtml: false,
    };
    
    log(`Enviando correo de texto plano a: ${testEmail}`, 'blue');
    
    const response = await axios.post(`${BASE_URL}/api/gmail/send`, emailData);
    
    if (response.data.success) {
      log('✅ Correo de texto plano enviado exitosamente', 'green');
      console.log('Respuesta:', JSON.stringify(response.data, null, 2));
      return true;
    }
  } catch (error: any) {
    log('❌ Error al enviar correo de texto plano', 'red');
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testInvalidEmail() {
  logSection('🚫 TEST 5: Validación de email inválido');
  
  try {
    const emailData = {
      to: 'email-invalido',
      subject: 'Test',
      message: 'Test',
      isHtml: false,
    };
    
    log('Intentando enviar a email inválido...', 'blue');
    
    const response = await axios.post(`${BASE_URL}/api/gmail/send`, emailData);
    
    log('❌ Debería haber fallado pero no lo hizo', 'red');
    return false;
  } catch (error: any) {
    if (error.response?.status === 400) {
      log('✅ Validación funcionando correctamente', 'green');
      console.log('Error esperado:', error.response.data.message);
      return true;
    } else {
      log('❌ Error inesperado', 'red');
      console.error(error.response?.data || error.message);
      return false;
    }
  }
}

async function testMissingFields() {
  logSection('🚫 TEST 6: Validación de campos faltantes');
  
  try {
    const emailData = {
      to: 'test@example.com',
      // Falta subject y message
    };
    
    log('Intentando enviar sin campos requeridos...', 'blue');
    
    const response = await axios.post(`${BASE_URL}/api/gmail/send`, emailData);
    
    log('❌ Debería haber fallado pero no lo hizo', 'red');
    return false;
  } catch (error: any) {
    if (error.response?.status === 400) {
      log('✅ Validación de campos funcionando correctamente', 'green');
      console.log('Error esperado:', error.response.data.message);
      return true;
    } else {
      log('❌ Error inesperado', 'red');
      console.error(error.response?.data || error.message);
      return false;
    }
  }
}

async function runAllTests() {
  log('\n🚀 Iniciando pruebas de Gmail API', 'cyan');
  log('Servidor: ' + BASE_URL, 'blue');
  
  const results: { test: string; passed: boolean }[] = [];
  
  // Test 1: Verificar estado
  const statusResult = await testGmailStatus();
  results.push({ test: 'Verificar estado', passed: statusResult || false });
  
  // Test 2: Obtener URL de autorización
  const authUrlResult = await testGetAuthUrl();
  results.push({ test: 'Obtener URL de autorización', passed: authUrlResult || false });
  
  // Si no está autorizado, no continuar con los tests de envío
  if (!statusResult) {
    logSection('⚠️  AUTORIZACIÓN REQUERIDA');
    log('Para continuar con las pruebas de envío:', 'yellow');
    log('1. Visita la URL de autorización mostrada arriba', 'yellow');
    log('2. Autoriza la aplicación con tu cuenta de Gmail', 'yellow');
    log('3. Vuelve a ejecutar este script', 'yellow');
    
    printResults(results);
    return;
  }
  
  // Solicitar email de prueba
  const testEmail = process.argv[2] || 'test@example.com';
  
  if (testEmail === 'test@example.com') {
    log('\n⚠️  Usando email de prueba por defecto: test@example.com', 'yellow');
    log('Para usar tu email, ejecuta: npm run test:gmail tu-email@example.com', 'yellow');
  }
  
  // Test 3: Enviar correo HTML
  const sendHtmlResult = await testSendEmail(testEmail);
  results.push({ test: 'Enviar correo HTML', passed: sendHtmlResult || false });
  
  // Test 4: Enviar correo de texto plano
  const sendPlainResult = await testSendPlainTextEmail(testEmail);
  results.push({ test: 'Enviar correo texto plano', passed: sendPlainResult || false });
  
  // Test 5: Validación de email inválido
  const invalidEmailResult = await testInvalidEmail();
  results.push({ test: 'Validación email inválido', passed: invalidEmailResult });
  
  // Test 6: Validación de campos faltantes
  const missingFieldsResult = await testMissingFields();
  results.push({ test: 'Validación campos faltantes', passed: missingFieldsResult });
  
  // Mostrar resultados
  printResults(results);
}

function printResults(results: { test: string; passed: boolean }[]) {
  logSection('📊 RESULTADOS DE LAS PRUEBAS');
  
  let passed = 0;
  let failed = 0;
  
  results.forEach((result) => {
    if (result.passed) {
      log(`✅ ${result.test}`, 'green');
      passed++;
    } else {
      log(`❌ ${result.test}`, 'red');
      failed++;
    }
  });
  
  console.log('\n' + '='.repeat(60));
  log(`Total: ${results.length} pruebas`, 'cyan');
  log(`Exitosas: ${passed}`, 'green');
  log(`Fallidas: ${failed}`, 'red');
  console.log('='.repeat(60) + '\n');
  
  if (failed === 0) {
    log('🎉 ¡Todas las pruebas pasaron exitosamente!', 'green');
  } else {
    log('⚠️  Algunas pruebas fallaron. Revisa los logs arriba.', 'yellow');
  }
}

// Ejecutar pruebas
runAllTests().catch((error) => {
  log('\n❌ Error fatal en las pruebas:', 'red');
  console.error(error);
  process.exit(1);
});
