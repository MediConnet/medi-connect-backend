import { sendEmail, generateWelcomeEmail } from '../src/shared/email';

/**
 * Script de prueba para el email de bienvenida
 * 
 * Uso:
 * ts-node test/test-welcome-email.ts
 */
async function testWelcomeEmail() {
  console.log('🧪 [TEST] Probando email de bienvenida...\n');

  try {
    // Datos de prueba
    const testData = {
      userName: 'Dr. Juan Pérez',
      userRole: 'Doctor',
      loginUrl: 'http://localhost:5173/login',
    };

    console.log('📧 [TEST] Generando HTML del email...');
    const welcomeHtml = generateWelcomeEmail(testData);
    console.log('✅ [TEST] HTML generado correctamente\n');

    // Email de destino (cambiar por tu email de prueba)
    const testEmail = 'test@example.com'; // ⚠️ CAMBIAR POR TU EMAIL

    console.log(`📤 [TEST] Enviando email a: ${testEmail}`);
    const emailSent = await sendEmail({
      to: testEmail,
      subject: '🧪 [TEST] ¡Bienvenido a DOCALINK! 🎉',
      html: welcomeHtml,
    });

    if (emailSent) {
      console.log('\n✅ [TEST] Email enviado exitosamente!');
      console.log(`📬 [TEST] Revisa tu bandeja de entrada: ${testEmail}`);
    } else {
      console.log('\n⚠️ [TEST] El email no se pudo enviar (modo desarrollo)');
      console.log('💡 [TEST] Verifica que RESEND_API_KEY esté configurado en .env');
    }

    console.log('\n📋 [TEST] Datos del email:');
    console.log(`   - Nombre: ${testData.userName}`);
    console.log(`   - Rol: ${testData.userRole}`);
    console.log(`   - URL Login: ${testData.loginUrl}`);

  } catch (error: any) {
    console.error('\n❌ [TEST] Error al probar email:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar prueba
testWelcomeEmail()
  .then(() => {
    console.log('\n✅ [TEST] Prueba completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [TEST] Error en la prueba:', error);
    process.exit(1);
  });
