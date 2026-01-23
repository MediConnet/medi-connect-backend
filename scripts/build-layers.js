const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building Lambda layers...\n');

// Build Prisma Layer
console.log('📦 Building Prisma layer...');
const prismaLayerDir = path.join(__dirname, '..', 'layers', 'prisma-layer', 'nodejs');
if (!fs.existsSync(prismaLayerDir)) {
  fs.mkdirSync(prismaLayerDir, { recursive: true });
}

// Generar Prisma Client en el layer
console.log('  → Generating Prisma Client...');
execSync('npm run prisma:generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

// Verificar que se generó correctamente
const prismaClientPath = path.join(prismaLayerDir, 'node_modules', '.prisma', 'client');
if (!fs.existsSync(prismaClientPath)) {
  console.error('❌ Prisma Client not found. Make sure prisma/schema.prisma output is set correctly.');
  process.exit(1);
}

console.log('  ✓ Prisma layer ready\n');

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
  console.log('  ⚠ dist/shared not found. Run "npm run build" first.\n');
}

function copyRecursiveSync(src: string, dest: string): void {
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
