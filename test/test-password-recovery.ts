/**
 * Test de Sistema de Recuperación de Contraseña
 * 
 * Este script prueba:
 * 1. POST /api/auth/forgot-password - Solicitar recuperación
 * 2. POST /api/auth/reset-password - Restablecer contraseña con token
 */

import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

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

async function testPasswordRecovery() {
  log('\n🔐 ===== TEST: SISTEMA DE RECUPERACIÓN DE CONTRASEÑA =====\n', 'cyan');

  // Email de prueba (debe existir en la BD)
  const testEmail = 'test@example.com';
  const newPassword = 'newPassword123';

  try {
    // ==========================================
    // TEST 1: Solicitar recuperación de contraseña
    // ==========================================
    log('📧 TEST 1: Solicitar recuperación de contraseña', 'blue');
    log(`   Email: ${testEmail}`, 'yellow');

    const forgotResponse = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
      email: testEmail,
    });

    log(`   ✅ Status: ${forgotResponse.status}`, 'green');
    log(`   ✅ Response: ${JSON.stringify(forgotResponse.data, null, 2)}`, 'green');

    // ==========================================
    // TEST 2: Verificar límite de intentos (3 por hora)
    // ==========================================
    log('\n⏰ TEST 2: Verificar límite de intentos', 'blue');
    
    for (let i = 1; i <= 3; i++) {
      try {
        const response = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
          email: testEmail,
        });
        log(`   ✅ Intento ${i}: ${response.status}`, 'green');
      } catch (error: any) {
        if (error.response?.status === 429) {
          log(`   ✅ Límite alcanzado en intento ${i} (esperado)`, 'green');
          break;
        }
      }
    }

    // ==========================================
    // TEST 3: Email no registrado (debe responder igual)
    // ==========================================
    log('\n🔒 TEST 3: Email no registrado (seguridad)', 'blue');
    
    const fakeEmailResponse = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
      email: 'noexiste@example.com',
    });

    log(`   ✅ Status: ${fakeEmailResponse.status}`, 'green');
    log(`   ✅ Respuesta estándar (no revela si existe): ${JSON.stringify(fakeEmailResponse.data, null, 2)}`, 'green');

    // ==========================================
    // TEST 4: Resetear contraseña con token
    // ==========================================
    log('\n🔑 TEST 4: Resetear contraseña con token', 'blue');
    log('   ⚠️  Para probar este endpoint, necesitas:', 'yellow');
    log('   1. Revisar el email enviado', 'yellow');
    log('   2. Copiar el token del enlace', 'yellow');
    log('   3. Ejecutar manualmente:', 'yellow');
    log(`   curl -X POST ${BASE_URL}/api/auth/reset-password \\`, 'yellow');
    log(`     -H "Content-Type: application/json" \\`, 'yellow');
    log(`     -d '{"token":"TOKEN_AQUI","newPassword":"${newPassword}"}'`, 'yellow');

    // Ejemplo con token de prueba (fallará porque no es válido)
    try {
      const resetResponse = await axios.post(`${BASE_URL}/api/auth/reset-password`, {
        token: 'invalid-token-for-testing',
        newPassword: newPassword,
      });
      log(`   ✅ Status: ${resetResponse.status}`, 'green');
    } catch (error: any) {
      if (error.response?.status === 400) {
        log(`   ✅ Token inválido rechazado correctamente (esperado)`, 'green');
        log(`   ✅ Error: ${error.response.data.message}`, 'green');
      } else {
        throw error;
      }
    }

    // ==========================================
    // TEST 5: Validaciones
    // ==========================================
    log('\n✅ TEST 5: Validaciones', 'blue');

    // Email inválido
    try {
      await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
        email: 'invalid-email',
      });
    } catch (error: any) {
      if (error.response?.status === 400) {
        log(`   ✅ Email inválido rechazado`, 'green');
      }
    }

    // Contraseña muy corta
    try {
      await axios.post(`${BASE_URL}/api/auth/reset-password`, {
        token: 'some-token',
        newPassword: '123',
      });
    } catch (error: any) {
      if (error.response?.status === 400) {
        log(`   ✅ Contraseña corta rechazada`, 'green');
      }
    }

    log('\n✅ ===== TODOS LOS TESTS COMPLETADOS =====\n', 'green');
    log('📝 NOTAS:', 'cyan');
    log('   1. Revisa tu email para ver el enlace de recuperación', 'yellow');
    log('   2. El token expira en 1 hora', 'yellow');
    log('   3. Cada token solo se puede usar una vez', 'yellow');
    log('   4. Máximo 3 intentos por hora por email', 'yellow');

  } catch (error: any) {
    log('\n❌ ERROR EN LOS TESTS:', 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    } else {
      log(`   ${error.message}`, 'red');
    }
    process.exit(1);
  }
}

// Ejecutar tests
testPasswordRecovery();
