
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const assets = [
  { name: 'splash.png', path: path.join(__dirname, '..', '..', 'medi-conecct-app', 'assets', 'splash.png') },
  { name: 'restablecer-contraseña.jfif', path: path.join(__dirname, '..', '..', 'medi-conecct-app', 'assets', 'restablecer-contraseña.jfif') },
  { name: 'contraseña-actualizada.jfif', path: path.join(__dirname, '..', '..', 'medi-conecct-app', 'assets', 'contraseña-actualizada.jfif') },
  { name: 'soporte-contacto.jfif', path: path.join(__dirname, '..', '..', 'medi-conecct-app', 'assets', 'soporte-contacto.jfif') },
];

async function uploadAssets() {
  console.log('🚀 Iniciando subida de assets a Cloudinary...');
  
  const results: Record<string, string> = {};

  for (const asset of assets) {
    if (fs.existsSync(asset.path)) {
      try {
        console.log(`📤 Subiendo ${asset.name}...`);
        const result = await cloudinary.uploader.upload(asset.path, {
          public_id: `docalink_email_${asset.name.split('.')[0]}`,
          folder: 'docalink/emails',
          overwrite: true,
        });
        results[asset.name] = result.secure_url;
        console.log(`✅ ${asset.name} subido: ${result.secure_url}`);
      } catch (error: any) {
        console.error(`❌ Error al subir ${asset.name}:`, error.message);
      }
    } else {
      console.warn(`⚠️ Archivo no encontrado: ${asset.path}`);
    }
  }

  console.log('\n📋 URLs Generadas:');
  console.log(JSON.stringify(results, null, 2));
}

uploadAssets();
