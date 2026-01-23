const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STAGE = process.env.STAGE || 'dev';
const MODULES = ['auth', 'doctors', 'admin', 'supplies', 'pharmacies', 'laboratories', 'ambulances'];

console.log('📦 Packaging Lambda functions and layers...\n');

// Crear directorio de artifacts si no existe
const artifactsDir = path.join(__dirname, '..', 'artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// Package Lambdas
console.log('📦 Packaging Lambda functions...');
MODULES.forEach(module => {
  const moduleDir = path.join(__dirname, '..', 'dist', module);
  const zipPath = path.join(artifactsDir, `lambdas/${module}-${STAGE}.zip`);
  const zipDir = path.dirname(zipPath);

  if (!fs.existsSync(zipDir)) {
    fs.mkdirSync(zipDir, { recursive: true });
  }

  if (fs.existsSync(moduleDir)) {
    console.log(`  ✓ Packaging ${module}...`);
    // Usar PowerShell en Windows o zip en Linux/Mac
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // PowerShell Compress-Archive
      execSync(
        `powershell -Command "Compress-Archive -Path '${moduleDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      execSync(`cd ${moduleDir} && zip -r ${zipPath} .`, { stdio: 'inherit' });
    }
    console.log(`  ✓ ${module} packaged: ${zipPath}`);
  } else {
    console.log(`  ⚠ ${module} not found in dist/, skipping...`);
  }
});

// Package Prisma Layer
console.log('\n📦 Packaging Prisma layer...');
const prismaLayerDir = path.join(__dirname, '..', 'layers', 'prisma-layer');
const prismaZipPath = path.join(artifactsDir, `layers/prisma-layer-${STAGE}.zip`);
const prismaZipDir = path.dirname(prismaZipPath);

if (!fs.existsSync(prismaZipDir)) {
  fs.mkdirSync(prismaZipDir, { recursive: true });
}

if (fs.existsSync(prismaLayerDir)) {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    execSync(
      `powershell -Command "Compress-Archive -Path '${prismaLayerDir}\\*' -DestinationPath '${prismaZipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd ${prismaLayerDir} && zip -r ${prismaZipPath} .`, { stdio: 'inherit' });
  }
  console.log(`  ✓ Prisma layer packaged: ${prismaZipPath}`);
} else {
  console.log('  ⚠ Prisma layer not found, run "npm run build:prisma" first');
}

// Package Utils Layer
console.log('\n📦 Packaging Utils layer...');
const utilsLayerDir = path.join(__dirname, '..', 'layers', 'utils-layer');
const utilsZipPath = path.join(artifactsDir, `layers/utils-layer-${STAGE}.zip`);
const utilsZipDir = path.dirname(utilsZipPath);

if (!fs.existsSync(utilsZipDir)) {
  fs.mkdirSync(utilsZipDir, { recursive: true });
}

if (fs.existsSync(utilsLayerDir)) {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    execSync(
      `powershell -Command "Compress-Archive -Path '${utilsLayerDir}\\*' -DestinationPath '${utilsZipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd ${utilsLayerDir} && zip -r ${utilsZipPath} .`, { stdio: 'inherit' });
  }
  console.log(`  ✓ Utils layer packaged: ${utilsZipPath}`);
} else {
  console.log('  ⚠ Utils layer not found');
}

console.log('\n✅ Packaging complete!');
console.log(`📁 Artifacts location: ${artifactsDir}`);
