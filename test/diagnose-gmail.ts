/**
 * Script de diagnóstico para Gmail API
 * Ejecutar con: ts-node test/diagnose-gmail.ts
 */

import * as fs from 'fs';
import * as path from 'path';

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

async function diagnose() {
  logSection('🔍 DIAGNÓSTICO DE GMAIL API');
  
  // 1. Verificar archivo de credenciales
  logSection('1. Verificando archivo de credenciales');
  
  const credentialsFiles = [
    'client_secret_480603606214-mk267u8e65jh73he4vlm7dhgllh10o9h.apps.googleusercontent.com (1).json',
    'client_secret_480603606214-l8h5t1au1c8trkrtggb9cpigcmqjpgop.apps.googleusercontent.com.json',
  ];
  
  let credentialsFound = false;
  let credentialsData: any = null;
  
  for (const file of credentialsFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      log(`✅ Encontrado: ${file}`, 'green');
      credentialsFound = true;
      credentialsData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      break;
    } else {
      log(`❌ No encontrado: ${file}`, 'red');
    }
  }
  
  if (!credentialsFound) {
    log('❌ No se encontró ningún archivo de credenciales', 'red');
    return;
  }
  
  // 2. Verificar contenido de credenciales
  logSection('2. Verificando contenido de credenciales');
  
  if (credentialsData.web) {
    log('✅ Tipo: Aplicación web', 'green');
    log(`   Client ID: ${credentialsData.web.client_id}`, 'blue');
    log(`   Project ID: ${credentialsData.web.project_id}`, 'blue');
    
    if (credentialsData.web.redirect_uris) {
      log('✅ Redirect URIs configurados en el archivo:', 'green');
      credentialsData.web.redirect_uris.forEach((uri: string) => {
        log(`   - ${uri}`, 'blue');
      });
    } else {
      log('⚠️  No hay redirect_uris en el archivo de credenciales', 'yellow');
    }
    
    if (credentialsData.web.javascript_origins) {
      log('✅ JavaScript origins configurados:', 'green');
      credentialsData.web.javascript_origins.forEach((origin: string) => {
        log(`   - ${origin}`, 'blue');
      });
    }
  } else {
    log('❌ El archivo no tiene el formato correcto (falta "web")', 'red');
    return;
  }
  
  // 3. Verificar archivo .env
  logSection('3. Verificando archivo .env');
  
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    log('✅ Archivo .env encontrado', 'green');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    if (envContent.includes('GMAIL_REDIRECT_URI')) {
      const match = envContent.match(/GMAIL_REDIRECT_URI=(.+)/);
      if (match) {
        log(`   GMAIL_REDIRECT_URI: ${match[1]}`, 'blue');
      }
    } else {
      log('⚠️  GMAIL_REDIRECT_URI no está configurado en .env', 'yellow');
    }
  } else {
    log('❌ Archivo .env no encontrado', 'red');
  }
  
  // 4. Verificar token
  logSection('4. Verificando token de Gmail');
  
  const tokenPath = path.join(process.cwd(), 'gmail-token.json');
  if (fs.existsSync(tokenPath)) {
    log('✅ Token encontrado: gmail-token.json', 'green');
    try {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      log(`   Access token: ${tokenData.access_token ? 'Presente' : 'Ausente'}`, 'blue');
      log(`   Refresh token: ${tokenData.refresh_token ? 'Presente' : 'Ausente'}`, 'blue');
      
      if (tokenData.expiry_date) {
        const expiryDate = new Date(tokenData.expiry_date);
        const now = new Date();
        if (expiryDate > now) {
          log(`   ✅ Token válido hasta: ${expiryDate.toLocaleString()}`, 'green');
        } else {
          log(`   ⚠️  Token expirado desde: ${expiryDate.toLocaleString()}`, 'yellow');
        }
      }
    } catch (error) {
      log('❌ Error al leer el token', 'red');
    }
  } else {
    log('⚠️  Token no encontrado (necesitas autorizar)', 'yellow');
  }
  
  // 5. Verificar servidor
  logSection('5. Verificando servidor');
  
  try {
    const response = await fetch('http://localhost:3000/health');
    if (response.ok) {
      log('✅ Servidor corriendo en http://localhost:3000', 'green');
    } else {
      log('❌ Servidor respondió con error', 'red');
    }
  } catch (error) {
    log('❌ Servidor no está corriendo', 'red');
    log('   Ejecuta: npm run dev', 'yellow');
  }
  
  // 6. Verificar endpoint de autorización
  logSection('6. Verificando endpoint de autorización');
  
  try {
    const response = await fetch('http://localhost:3000/api/gmail/authorize');
    if (response.ok) {
      const data: any = await response.json();
      log('✅ Endpoint de autorización funcionando', 'green');
      
      if (data.data && data.data.authUrl) {
        const url = new URL(data.data.authUrl);
        const redirectUri = url.searchParams.get('redirect_uri');
        
        log(`   Redirect URI en la URL: ${redirectUri}`, 'blue');
        
        if (redirectUri === 'http://localhost:3000/api/gmail/callback') {
          log('   ✅ Redirect URI correcto', 'green');
        } else {
          log('   ❌ Redirect URI incorrecto', 'red');
          log('   Esperado: http://localhost:3000/api/gmail/callback', 'yellow');
        }
      }
    } else {
      log('❌ Endpoint de autorización falló', 'red');
    }
  } catch (error: any) {
    log('❌ Error al verificar endpoint de autorización', 'red');
    log(`   ${error.message}`, 'red');
  }
  
  // 7. Resumen
  logSection('📊 RESUMEN');
  
  console.log('Para autorizar Gmail:');
  console.log('1. Asegúrate de que el servidor esté corriendo: npm run dev');
  console.log('2. Visita: http://localhost:3000/api/gmail/authorize');
  console.log('3. Copia la URL de autorización');
  console.log('4. Ábrela en tu navegador');
  console.log('5. Acepta los permisos');
  console.log('');
  console.log('Si ves "redirect_uri_mismatch", verifica en Google Cloud Console:');
  console.log('https://console.cloud.google.com/apis/credentials');
  console.log('');
  console.log('El redirect URI debe ser EXACTAMENTE:');
  log('http://localhost:3000/api/gmail/callback', 'cyan');
  console.log('');
}

diagnose().catch((error) => {
  log('\n❌ Error fatal en diagnóstico:', 'red');
  console.error(error);
  process.exit(1);
});
