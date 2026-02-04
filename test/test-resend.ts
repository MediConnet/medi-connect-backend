/**
 * Prueba de envío de email REAL con Resend
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { sendEmail } from '../src/shared/email';

async function testResendEmail() {
  console.log('📧 Probando envío con Resend...\n');

  const testEmail = 'bobbie.conroy491@mazun.org';
  
  console.log(`📬 Destinatario: ${testEmail}`);
  console.log(`📤 Proveedor: Resend`);
  console.log(`🔑 API Key: ${process.env.RESEND_API_KEY?.substring(0, 10)}...`);
  console.log('');

  try {
    const result = await sendEmail({
      to: testEmail,
      subject: '🎉 Invitación a MediConnect - Prueba con Resend',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🎉 ¡Invitación a MediConnect!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">¡Hola!</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Has sido invitado a unirte a una clínica en MediConnect.
            </p>

            <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
              <p style="margin: 0; color: #333;"><strong>📅 Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
              <p style="margin: 10px 0 0 0; color: #333;"><strong>🔧 Sistema:</strong> MediConnect Backend</p>
              <p style="margin: 10px 0 0 0; color: #333;"><strong>📧 Destinatario:</strong> ${testEmail}</p>
              <p style="margin: 10px 0 0 0; color: #333;"><strong>📤 Proveedor:</strong> Resend</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5173/invite/test-token-123" 
                 style="background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Aceptar Invitación
              </a>
            </div>

            <p style="color: #999; font-size: 14px; margin-top: 30px; text-align: center;">
              Este es un email de prueba enviado con Resend. ✅
            </p>
          </div>

          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>© 2026 MediConnect - Sistema de Gestión Médica</p>
          </div>
        </div>
      `,
    });

    console.log('');
    if (result) {
      console.log('✅ ¡EMAIL ENVIADO EXITOSAMENTE CON RESEND!');
      console.log('');
      console.log('📬 Revisa la bandeja de entrada de:', testEmail);
      console.log('📂 Si no lo ves, revisa la carpeta de SPAM/Correo no deseado');
      console.log('');
      console.log('⏱️  El email puede tardar unos segundos en llegar...');
      console.log('');
      console.log('💡 Resend es más confiable que Mailjet para desarrollo');
      console.log('   Los emails deberían llegar a la bandeja principal');
    } else {
      console.log('❌ ERROR: No se pudo enviar el email');
      console.log('');
      console.log('🔍 Posibles causas:');
      console.log('   1. API Key de Resend incorrecta');
      console.log('   2. Límite de envío alcanzado');
      console.log('   3. Email destinatario inválido');
      console.log('');
      console.log('💡 Solución: Verifica tu cuenta de Resend en https://resend.com/emails');
    }
  } catch (error: any) {
    console.error('❌ ERROR FATAL:', error.message);
    console.error('');
    if (error.message.includes('API key')) {
      console.error('🔑 Problema con la API Key de Resend');
      console.error('   Verifica que RESEND_API_KEY esté correctamente configurada en .env');
    }
    console.error('Stack:', error.stack);
  }
}

// Ejecutar prueba
testResendEmail()
  .then(() => {
    console.log('');
    console.log('✅ Prueba completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
