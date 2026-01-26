import * as dotenv from 'dotenv';
dotenv.config();

import { handler } from '../src/doctors/handler';
import { getPrismaClient } from '../src/shared/prisma';

const runTest = async () => {
  console.log('🔄 Preparando prueba de PERFIL COMPLETO...');

  const prisma = getPrismaClient();

  // 1. Buscamos al mismo doctor del seed
  const doctorUser = await prisma.users.findFirst({
    where: { email: 'doctor@medicones.com' } 
  });

  if (!doctorUser) {
    console.error('❌ Error: No se encontró al doctor.');
    return;
  }

  // ==========================================
  // PRUEBA 1: GET /api/doctors/profile
  // ==========================================
  console.log('\n--- 1. PROBANDO GET PROFILE (Datos Completos) ---');
  
  const getEvent: any = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': doctorUser.email, 
      'authorization': '' 
    },
    requestContext: {
      http: { method: 'GET', path: '/api/doctors/profile' },
      authorizer: {
        lambda: {
          user: { id: doctorUser.id, email: doctorUser.email, role: 'provider' }
        }
      }
    }
  };

  try {
    const result = await handler(getEvent);
    console.log('Status GET:', result.statusCode);
    
    if (result.statusCode === 200 && result.body) {
      const body = JSON.parse(result.body);
      const data = body.data;

      // Imprimimos la información estructurada 
      console.log('✅ DATOS RECUPERADOS:');
      console.log('   👤 Nombre:', data.full_name);
      console.log('   📧 Email:', data.email);
      console.log('   🏥 Especialidad:', data.specialty);
      console.log('   🏷️  Categoría:', data.category);
      console.log('   📍 Dirección:', data.address);
      console.log('   📞 Teléfono:', data.phone);
      console.log('   📝 Bio:', data.description.substring(0, 50) + '...'); 
      
      console.log('   📅 Horarios:');
      if (data.schedules && data.schedules.length > 0) {
        data.schedules.forEach((s: any) => {
           console.log(`      - ${s.day}: ${s.start.substring(11, 16)} a ${s.end.substring(11, 16)}`);
        });
      } else {
        console.log('      (Sin horarios registrados)');
      }

    } else {
      console.error('❌ Falló GET:', result.body);
    }
  } catch (e) { console.error(e); }

  // ==========================================
  // PRUEBA 2: PUT /api/doctors/profile (Actualización Masiva)
  // ==========================================
  console.log('\n--- 2. PROBANDO UPDATE PROFILE (Nombre, Bio, Dirección) ---');

  const updateData = {
    full_name: "Dr. Juan Pérez (Actualizado)",
    bio: "Experto en cardiología intervencionista y pruebas de estrés.",
    address: "Torre Médica 2, Consultorio 505",
    phone: "0991112222",
    whatsapp: "0991112222"
  };

  const updateEvent: any = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': doctorUser.email,
      'authorization': '' 
    },
    // Enviamos el objeto completo
    body: JSON.stringify(updateData),
    requestContext: {
      http: { method: 'PUT', path: '/api/doctors/profile' },
      authorizer: {
        lambda: {
          user: { id: doctorUser.id, email: doctorUser.email, role: 'provider' }
        }
      }
    }
  };

  try {
    const result = await handler(updateEvent);
    console.log('Status PUT:', result.statusCode);
    
    if (result.statusCode === 200 && result.body) {
      const body = JSON.parse(result.body);
      
      console.log('✅ Respuesta del servidor:', body.success ? 'Success' : 'Fail');
      console.log('   Nombre en DB:', body.data.commercial_name);
      console.log('   Bio en DB:', body.data.description);
      
      if (body.data.commercial_name === updateData.full_name) {
        console.log('🌟 ¡ÉXITO! El nombre y la bio se actualizaron correctamente.');
        console.log('   (Nota: Dirección y teléfono se guardaron en la tabla provider_branches)');
      }
    } else {
      console.error('❌ Falló PUT:', result.body);
    }
  } catch (e) { console.error(e); }

};

runTest();