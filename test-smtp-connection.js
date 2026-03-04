/**
 * Script de prueba para verificar conexión SMTP con Hostinger desde Render
 * 
 * Ejecutar desde Render Shell:
 * node test-smtp-connection.js
 */

const nodemailer = require('nodemailer');

console.log('🔍 ========================================');
console.log('🔍 VERIFICACIÓN DE CONFIGURACIÓN SMTP');
console.log('🔍 ========================================\n');

// Verificar variables de entorno
console.log('1️⃣ Verificando variables de entorno...\n');

const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '465');
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

console.log(`   SMTP_HOST: ${smtpHost} ${process.env.SMTP_HOST ? '✅' : '⚠️ (usando default)'}`);
console.log(`   SMTP_PORT: ${smtpPort} ${process.env.SMTP_PORT ? '✅' : '⚠️ (usando default)'}`);
console.log(`   SMTP_USER: ${smtpUser || '❌ NO CONFIGURADO'}`);
console.log(`   SMTP_PASSWORD: ${smtpPassword ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);

if (!smtpUser || !smtpPassword) {
  console.error('\n❌ ERROR: SMTP_USER o SMTP_PASSWORD no están configurados');
  console.error('💡 Ve a Render → Environment y configura estas variables');
  process.exit(1);
}

console.log('\n✅ Todas las variables están configuradas\n');

// Crear transporter
console.log('2️⃣ Creando transporter de Nodemailer...\n');

const useSSL = smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: useSSL,
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    servername: smtpHost,
  },
  pool: false,
});

console.log(`   Host: ${smtpHost}`);
console.log(`   Port: ${smtpPort}`);
console.log(`   Secure: ${useSSL} (${useSSL ? 'SSL' : 'TLS'})`);
console.log(`   User: ${smtpUser}\n`);

// Probar conexión
console.log('3️⃣ Probando conexión SMTP...\n');

transporter.verify()
  .then(() => {
    console.log('✅ ¡CONEXIÓN SMTP EXITOSA!');
    console.log('✅ Render puede conectarse a Hostinger\n');
    
    // Si la conexión funciona, intentar enviar un email de prueba
    console.log('4️⃣ Enviando email de prueba...\n');
    console.log('   To: kevincata2005@gmail.com');
    console.log('   Subject: Prueba de SMTP desde Render\n');
    
    return transporter.sendMail({
      from: `"DOCALINK" <${smtpUser}>`,
      to: 'kevincata2005@gmail.com',
      subject: 'Prueba de SMTP desde Render',
      html: `
        <h1>Prueba de SMTP</h1>
        <p>Si recibes este email, significa que la conexión SMTP desde Render a Hostinger está funcionando correctamente.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Servidor:</strong> ${smtpHost}:${smtpPort}</p>
      `,
      text: 'Prueba de SMTP desde Render - Si recibes esto, la conexión funciona correctamente.',
    });
  })
  .then((info) => {
    console.log('✅ ¡EMAIL ENVIADO EXITOSAMENTE!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response || 'N/A'}\n`);
    console.log('📬 Revisa la bandeja de entrada de kevincata2005@gmail.com');
    console.log('📂 Si no lo ves, revisa la carpeta de SPAM\n');
    console.log('✅ ========================================');
    console.log('✅ RESULTADO: SMTP FUNCIONA CORRECTAMENTE');
    console.log('✅ ========================================');
  })
  .catch((err) => {
    console.error('\n❌ ERROR DE CONEXIÓN:\n');
    console.error(`   Mensaje: ${err.message}`);
    console.error(`   Código: ${err.code || 'N/A'}\n`);
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('⚠️  PROBLEMA: Render NO puede conectarse a Hostinger');
      console.error('\n💡 Posibles causas:');
      console.error('   1. Puerto bloqueado por firewall de Render');
      console.error('   2. Hostinger bloquea conexiones desde Render');
      console.error('   3. Problema de red entre Render y Hostinger\n');
      console.error('💡 Soluciones:');
      console.error('   - Prueba cambiar SMTP_PORT a 587 en Render');
      console.error('   - Contacta a Render Support sobre bloqueo de puertos SMTP');
      console.error('   - Considera usar un servicio de email con API REST (Mailjet, SendGrid)\n');
    } else if (err.code === 'EAUTH') {
      console.error('⚠️  PROBLEMA: Error de autenticación');
      console.error('\n💡 Soluciones:');
      console.error('   - Verifica que SMTP_USER sea correcto (noreply@docalink.com)');
      console.error('   - Verifica que SMTP_PASSWORD sea la contraseña SMTP (no la de la cuenta web)');
      console.error('   - Verifica en Hostinger que el email existe y SMTP está habilitado\n');
    } else {
      console.error('⚠️  PROBLEMA: Error desconocido');
      console.error(`   Stack: ${err.stack}\n`);
    }
    
    console.error('❌ ========================================');
    console.error('❌ RESULTADO: SMTP NO FUNCIONA');
    console.error('❌ ========================================');
    
    process.exit(1);
  });
