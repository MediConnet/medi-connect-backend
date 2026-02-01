const fs = require('fs');
const path = require('path');

// Copiar el cliente de Prisma generado a dist/generated/prisma
// para que la ruta ../generated/prisma/client desde dist/src/shared funcione
const sourceDir = path.join(__dirname, '..', 'src', 'generated', 'prisma');
const destDir1 = path.join(__dirname, '..', 'dist', 'src', 'generated', 'prisma'); // Para desarrollo local
const destDir2 = path.join(__dirname, '..', 'dist', 'generated', 'prisma'); // Para producción (ruta que busca el código compilado)

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

if (fs.existsSync(sourceDir)) {
  console.log('📦 Copiando cliente de Prisma generado...');
  
  // Copiar a dist/src/generated/prisma (para desarrollo)
  if (fs.existsSync(path.join(__dirname, '..', 'dist', 'src'))) {
    copyRecursiveSync(sourceDir, destDir1);
  }
  
  // Copiar a dist/generated/prisma (para producción - ruta que busca el código compilado)
  copyRecursiveSync(sourceDir, destDir2);
  
  console.log('✅ Cliente de Prisma copiado exitosamente');
} else {
  console.warn('⚠️  No se encontró el cliente de Prisma generado. Asegúrate de ejecutar prisma generate primero.');
}
