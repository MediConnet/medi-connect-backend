/**
 * Script de prueba para Mailjet
 * 
 * Ejecutar con: npm run test:mailjet tu-email@example.com
 */

import { sendEmail, sendTestEmail, getMailjetStatus } from '../src/shared/mailjet';
import { getAdapterStatus } from '../src/shared/email-adapter';

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

async function runTests() {
  log('\n🚀 Iniciando pruebas de Mailjet', 'cyan');
  
  const testEmail = process.argv[2] || 'test@example.com';
  
  if (testEmail === 'test@example.com') {
    log('\n⚠️  Usando email de prueba por defecto: test@example.com', 'yellow');
    log('Para usar tu email, ejecuta: npm run test:mailjet tu-email@example.com', 'yellow');
  }
  
  // Test 1: Verificar configuración
  logSection('📊 TEST 1: Verificar configuración de Mailjet');
  
  const mailjetStatus = getMailjetStatus();
  console.log('Estado de Mailjet:');
  console.log(`  Configurado: ${mailjetStatus.configured ? '✅' : '❌'}`);
  console.log(`  API Key: ${mailjetStatus.apiKey}`);
  console.log(`  Email remitente: ${mailjetStatus.fromEmail}`);
  console.log(`  Listo para usar: ${mailjetStatus.ready ? '✅' : '❌'}`);
  
  if (!mailjetStatus.configured) {
    log('\n❌ Mailjet no está configurado correctamente', 'red');
    log('Verifica que las variables de entorno estén configuradas en .env', 'yellow');
    return;
  }
  
  // Test 2: Verificar adaptador
  logSection('📊 TEST 2: Verificar adaptador de email');
  
  const adapterStatus = getAdapterStatus();
  console.log('Estado del adaptador:');
  console.log(`  Proveedor actual: ${adapterStatus.currentProvider}`);
  console.log(`  Mailjet disponible: ${adapterStatus.mailjetAvailable ? '✅' : '❌'}`);
  console.log(`  Resend disponible: ${adapterStatus.resendAvailable ? '✅' : '❌'}`);
  console.log(`  Fallback habilitado: ${adapterStatus.fallbackEnabled ? '✅' : '❌'}`);
  
  // Test 3: Enviar correo de prueba
  logSection('📧 TEST 3: Enviar correo de prueba');
  
  log(`Enviando correo de prueba a: ${testEmail}`, 'blue');
  
  const result = await sendTestEmail(testEmail);
  
  if (result) {
    log('✅ Correo de prueba enviado exitosamente', 'green');
    log(`\nRevisa la bandeja de entrada de ${testEmail}`, 'yellow');
  } else {
    log('❌ Error al enviar correo de prueba', 'red');
  }
  
  // Test 4: Enviar correo personalizado
  logSection('📧 TEST 4: Enviar correo personalizado');
  
  log(`Enviando correo personalizado a: ${testEmail}`, 'blue');
  
  const customResult = await sendEmail({
    to: testEmail,
    subject: 'Correo Personalizado - MediConnect',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #667eea;">¡Hola desde MediConnect!</h1>
        <p>Este es un correo personalizado enviado con Mailjet.</p>
        <p><strong>Características:</strong></p>
        <ul>
          <li>✅ Envío instantáneo</li>
          <li>✅ Sin configuración OAuth</li>
          <li>✅ Fácil de usar</li>
          <li>✅ Confiable</li>
        </ul>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          Este correo fue enviado desde MediConnect Backend usando Mailjet.
        </p>
      </div>
    `,
    text: `
¡Hola desde MediConnect!

Este es un correo personalizado enviado con Mailjet.

Características:
- Envío instantáneo
- Sin configuración OAuth
- Fácil de usar
- Confiable

Fecha: ${new Date().toLocaleString()}

Este correo fue enviado desde MediConnect Backend usando Mailjet.
    `,
  });
  
  if (customResult) {
    log('✅ Correo personalizado enviado exitosamente', 'green');
  } else {
    log('❌ Error al enviar correo personalizado', 'red');
  }
  
  // Resumen
  logSection('📊 RESUMEN');
  
  const totalTests = 4;
  const passedTests = [
    mailjetStatus.configured,
    adapterStatus.mailjetAvailable,
    result,
    customResult,
  ].filter(Boolean).length;
  
  log(`Total de pruebas: ${totalTests}`, 'cyan');
  log(`Exitosas: ${passedTests}`, 'green');
  log(`Fallidas: ${totalTests - passedTests}`, 'red');
  
  if (passedTests === totalTests) {
    log('\n🎉 ¡Todas las pruebas pasaron exitosamente!', 'green');
    log('\nMailjet está configurado y funcionando correctamente.', 'green');
    log('Ahora puedes usar sendEmail() en tu código para enviar correos.', 'blue');
  } else {
    log('\n⚠️  Algunas pruebas fallaron. Revisa los logs arriba.', 'yellow');
  }
}

runTests().catch((error) => {
  log('\n❌ Error fatal en las pruebas:', 'red');
  console.error(error);
  process.exit(1);
});
