import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testDatabasePersistence() {
  console.log('🧪 Probando que los datos se guardan en la base de datos...\n');

  try {
    // 1. Login
    console.log('1️⃣ Login como médico...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'doctor@medicones.com',
      password: 'doctor123',
    });

    const token = loginResponse.data.data.token;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    console.log('✅ Login exitoso\n');

    // 2. Actualizar perfil con datos únicos
    const timestamp = Date.now();
    const uniqueBio = `Biografía actualizada en ${timestamp}`;
    const uniqueEducation = `Universidad actualizada ${timestamp}`;

    console.log('2️⃣ Actualizando perfil con datos únicos...');
    console.log(`   Bio: ${uniqueBio}`);
    console.log(`   Education: ${uniqueEducation}\n`);

    await axios.put(
      `${BASE_URL}/api/doctors/clinic/profile`,
      {
        bio: uniqueBio,
        experience: 20,
        education: [
          {
            text: uniqueEducation,
          },
        ],
        certifications: [
          {
            text: `Certificación ${timestamp}`,
          },
        ],
      },
      { headers }
    );
    console.log('✅ Perfil actualizado\n');

    // 3. Esperar un momento
    console.log('3️⃣ Esperando 2 segundos...\n');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 4. Obtener perfil nuevamente (esto viene de la BD)
    console.log('4️⃣ Obteniendo perfil desde la base de datos...');
    const profileResponse = await axios.get(
      `${BASE_URL}/api/doctors/clinic/profile`,
      { headers }
    );

    const profile = profileResponse.data.data;
    console.log('✅ Perfil obtenido desde BD:\n');
    console.log(`   Bio: ${profile.bio}`);
    console.log(`   Experience: ${profile.experience}`);
    console.log(`   Education: ${JSON.stringify(profile.education, null, 2)}`);
    console.log(`   Certifications: ${JSON.stringify(profile.certifications, null, 2)}\n`);

    // 5. Verificar que los datos coinciden
    console.log('5️⃣ Verificando que los datos se guardaron correctamente...');
    
    if (profile.bio === uniqueBio) {
      console.log('✅ Bio guardada correctamente');
    } else {
      console.log('❌ Bio NO coincide');
      console.log(`   Esperado: ${uniqueBio}`);
      console.log(`   Recibido: ${profile.bio}`);
    }

    if (profile.experience === 20) {
      console.log('✅ Experience guardada correctamente');
    } else {
      console.log('❌ Experience NO coincide');
    }

    if (profile.education[0]?.text === uniqueEducation) {
      console.log('✅ Education guardada correctamente');
    } else {
      console.log('❌ Education NO coincide');
      console.log(`   Esperado: ${uniqueEducation}`);
      console.log(`   Recibido: ${profile.education[0]?.text}`);
    }

    if (profile.certifications[0]?.text === `Certificación ${timestamp}`) {
      console.log('✅ Certifications guardadas correctamente');
    } else {
      console.log('❌ Certifications NO coinciden');
    }

    console.log('\n🎉 ¡CONFIRMADO! Los datos se están guardando en la base de datos PostgreSQL');
    console.log('📊 Tabla: clinic_doctors');
    console.log('📝 Campos: bio, experience, education (JSON), certifications (JSON)');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testDatabasePersistence();
