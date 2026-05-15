
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
  { name: 'docalink-logo.png', path: path.join(__dirname, '..', 'public', 'images', 'docalink-logo.png') },
  { name: 'restablecer-contraseña.png', path: path.join(__dirname, '..', 'public', 'images', 'restablecer-contraseña.png') },
  { name: 'contraseña-actualizada.png', path: path.join(__dirname, '..', 'public', 'images', 'contraseña-actualizada.png') },
  { name: 'soporte-contacto.png', path: path.join(__dirname, '..', 'public', 'images', 'soporte-contacto.png') },
  { name: 'ambulancia.png', path: path.join(__dirname, '..', 'public', 'images', 'ambulancia.png') },
  { name: 'cita-agendada.png', path: path.join(__dirname, '..', 'public', 'images', 'cita-agendada.png') },
  { name: 'cuenta-creada.png', path: path.join(__dirname, '..', 'public', 'images', 'cuenta-creada.png') },
  { name: 'farmacia.png', path: path.join(__dirname, '..', 'public', 'images', 'farmacia.png') },
  { name: 'medico.png', path: path.join(__dirname, '..', 'public', 'images', 'medico.png') },
  { name: 'notificaciones.png', path: path.join(__dirname, '..', 'public', 'images', 'notificaciones.png') },
  { name: 'pago-consultorio.png', path: path.join(__dirname, '..', 'public', 'images', 'pago-consultorio.png') },
  { name: 'solicitud-aceptada.png', path: path.join(__dirname, '..', 'public', 'images', 'solicitud-aceptada.png') },
];

async function uploadAssets() {
  console.log('🚀 Subiendo TODA la galería de assets a Cloudinary...');
  
  const results: Record<string, string> = {};

  for (const asset of assets) {
    if (fs.existsSync(asset.path)) {
      try {
        console.log(`📤 Subiendo ${asset.name}...`);
        const result = await cloudinary.uploader.upload(asset.path, {
          public_id: `docalink_email_new_${asset.name.split('.')[0]}`,
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
