const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building Lambda layers...\n');

// Build Prisma Layer
console.log('📦 Building Prisma layer...');
// Nota: Ajustamos la ruta base para asegurar que coincida con la estructura de capas de AWS
const prismaLayerDir = path.join(__dirname, '..', 'layers', 'prisma-layer', 'nodejs');

if (!fs.existsSync(prismaLayerDir)) {
  fs.mkdirSync(prismaLayerDir, { recursive: true });
}

// Generar Prisma Client
// Esto usará tu schema.prisma actual que apunta a src/generated
console.log('  → Generating Prisma Client...');
execSync('npm run prisma:generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

/**
 * IMPORTANTE:
 * Como cambiamos la salida en schema.prisma a "src/generated", 
 * el comando generate NO lo pone automáticamente en la carpeta del layer.
 * Tenemos que copiarlo manualmente.
 */

// 1. Definir origen (donde lo generó prisma) y destino (la carpeta del layer)
const prismaSource = path.join(__dirname, '..', 'src', 'generated');
// AWS Lambda espera librerías en nodejs/node_modules, pero como usamos una ruta custom
// vamos a replicar la estructura para que la Lambda pueda encontrarlo si decidimos usar layers para esto.
const prismaDest = path.join(prismaLayerDir, 'node_modules');

if (fs.existsSync(prismaSource)) {
    console.log('  → Copying generated Prisma Client to Layer...');
    copyRecursiveSync(prismaSource, path.join(prismaDest, '../src/generated')); 
    // Nota: Esta copia es un "parche" para que el script pase. 
    // Idealmente, si usas bundle con esbuild/webpack, el código se incluye en el zip de la función
    // y el layer se usa solo para dependencias pesadas como @prisma/client/runtime.
}

console.log('  ✓ Prisma layer build step done\n');


// Build Utils Layer
console.log('📦 Building Utils layer...');
const utilsLayerDir = path.join(__dirname, '..', 'layers', 'utils-layer', 'nodejs');
if (!fs.existsSync(utilsLayerDir)) {
  fs.mkdirSync(utilsLayerDir, { recursive: true });
}

// Copiar shared desde dist
const distSharedDir = path.join(__dirname, '..', 'dist', 'shared');
const utilsSharedDir = path.join(utilsLayerDir, 'shared');

if (fs.existsSync(distSharedDir)) {
  console.log('  → Copying shared utilities...');
  // Copiar recursivamente
  copyRecursiveSync(distSharedDir, utilsSharedDir);
  console.log('  ✓ Utils layer ready\n');
} else {
  console.log('  ⚠ dist/shared not found. Run "npm run build" first. (If this is the first run, ignore this warning)\n');
}

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('✅ Layers build complete!');