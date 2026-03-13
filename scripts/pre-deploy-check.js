#!/usr/bin/env node

/**
 * Pre-Deploy Check Script
 * Verifica que todo está listo antes de desplegar a producción
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando preparación para despliegue...\n');

let allChecksPass = true;

// Check 1: Verificar que los archivos necesarios existen
console.log('📁 Verificando archivos...');
const requiredFiles = [
  'src/admin/settings.controller.ts',
  'src/admin/handler.ts',
  'prisma/schema.prisma',
  'serverless.yml',
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - NO ENCONTRADO`);
    allChecksPass = false;
  }
});

// Check 2: Verificar que serverless.yml tiene adminHandler
console.log('\n📝 Verificando serverless.yml...');
const serverlessContent = fs.readFileSync('serverless.yml', 'utf8');
if (serverlessContent.includes('adminHandler:')) {
  console.log('  ✅ adminHandler configurado');
} else {
  console.log('  ❌ adminHandler NO encontrado en serverless.yml');
  allChecksPass = false;
}

if (serverlessContent.includes('/api/admin/settings')) {
  console.log('  ✅ Rutas de settings configuradas');
} else {
  console.log('  ❌ Rutas de settings NO encontradas');
  allChecksPass = false;
}

// Check 3: Verificar que el schema tiene admin_settings
console.log('\n🗄️  Verificando schema de Prisma...');
const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');
if (schemaContent.includes('model admin_settings')) {
  console.log('  ✅ Modelo admin_settings en schema');
} else {
  console.log('  ❌ Modelo admin_settings NO encontrado');
  allChecksPass = false;
}

// Check 4: Verificar que dist existe (build realizado)
console.log('\n🔨 Verificando build...');
if (fs.existsSync('dist')) {
  console.log('  ✅ Carpeta dist existe');
} else {
  console.log('  ⚠️  Carpeta dist no existe - Ejecuta: npm run build');
}

// Resumen
console.log('\n' + '='.repeat(50));
if (allChecksPass) {
  console.log('✅ TODOS LOS CHECKS PASARON');
  console.log('\n🚀 Listo para desplegar a producción');
  console.log('\nPróximos pasos:');
  console.log('1. npm run build');
  console.log('2. npx prisma db push (en producción)');
  console.log('3. serverless deploy --stage prod');
  process.exit(0);
} else {
  console.log('❌ ALGUNOS CHECKS FALLARON');
  console.log('\n⚠️  Corrige los errores antes de desplegar');
  process.exit(1);
}
