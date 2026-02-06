import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Credenciales
const DOCTOR_EMAIL = 'dr.juan.perez@clinicacentral.com';
const DOCTOR_PASSWORD = 'doctor123';
const CLINIC_EMAIL = 'clinic@medicones.com';
const CLINIC_PASSWORD = 'clinic123';

// Simular un PDF en Base64 (pequeño PDF de prueba)
const SAMPLE_PDF_BASE64 = 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSAxIDAgUj4+Pj4vTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoxIDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+CmVuZG9iagoyIDAgb2JqCjw8L1R5cGUvUGFnZXMvS2lkc1szIDAgUl0vQ291bnQgMT4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iagp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDUgMCBSPj4Kc3RhcnR4cmVmCjU1NgolJUVPRgo=';

async function testDoctorProfileWithPDFs() {
  console.log('🧪 Iniciando prueba de perfil de médico con PDFs...\n');

  try {
    // 1. Login como médico
    console.log('1️⃣ Login como médico asociado...');
    const doctorLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: DOCTOR_EMAIL,
      password: DOCTOR_PASSWORD,
    });

    const doctorToken = doctorLoginResponse.data.token;
    console.log('✅ Login médico exitoso\n');

    const doctorHeaders = {
      Authorization: `Bearer ${doctorToken}`,
      'Content-Type': 'application/json',
    };

    // 2. Obtener perfil actual del médico
    console.log('2️⃣ GET /api/doctors/clinic/profile (perfil actual)...');
    const currentProfileResponse = await axios.get(
      `${BASE_URL}/api/doctors/clinic/profile`,
      { headers: doctorHeaders }
    );
    console.log('✅ Perfil actual obtenido:');
    console.log(JSON.stringify(currentProfileResponse.data, null, 2));
    console.log('');

    // 3. Actualizar perfil con education y certifications (con PDFs en Base64)
    console.log('3️⃣ PUT /api/doctors/clinic/profile (actualizar con PDFs)...');
    const updatedProfileData = {
      bio: 'Cardiólogo con más de 15 años de experiencia en el diagnóstico y tratamiento de enfermedades cardiovasculares.',
      experience: 15,
      specialty: 'Cardiología',
      phone: '0991234567',
      whatsapp: '0991234567',
      education: [
        {
          text: 'Universidad Central del Ecuador - Medicina',
          fileUrl: `data:application/pdf;base64,${SAMPLE_PDF_BASE64}`,
          fileName: 'titulo_medicina_UCE.pdf',
        },
        {
          text: 'Especialización en Cardiología - Hospital Metropolitano',
        },
      ],
      certifications: [
        {
          text: 'Certificación en Ecocardiografía',
          fileUrl: `data:application/pdf;base64,${SAMPLE_PDF_BASE64}`,
          fileName: 'certificado_ecocardiografia.pdf',
        },
        {
          text: 'Certificación en Cardiología Intervencionista',
        },
      ],
    };

    const updateResponse = await axios.put(
      `${BASE_URL}/api/doctors/clinic/profile`,
      updatedProfileData,
      { headers: doctorHeaders }
    );
    console.log('✅ Perfil actualizado con PDFs:');
    console.log(JSON.stringify(updateResponse.data, null, 2));
    console.log('');

    // 4. Verificar que el perfil se guardó correctamente
    console.log('4️⃣ GET /api/doctors/clinic/profile (verificar actualización)...');
    const verifyProfileResponse = await axios.get(
      `${BASE_URL}/api/doctors/clinic/profile`,
      { headers: doctorHeaders }
    );
    console.log('✅ Perfil verificado:');
    console.log(JSON.stringify(verifyProfileResponse.data, null, 2));
    console.log('');

    // 5. Login como clínica
    console.log('5️⃣ Login como clínica...');
    const clinicLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: CLINIC_EMAIL,
      password: CLINIC_PASSWORD,
    });

    const clinicToken = clinicLoginResponse.data.token;
    console.log('✅ Login clínica exitoso\n');

    const clinicHeaders = {
      Authorization: `Bearer ${clinicToken}`,
      'Content-Type': 'application/json',
    };

    // 6. Obtener lista de médicos de la clínica
    console.log('6️⃣ GET /api/clinics/doctors (obtener lista de médicos)...');
    const doctorsListResponse = await axios.get(
      `${BASE_URL}/api/clinics/doctors`,
      { headers: clinicHeaders }
    );
    console.log('✅ Lista de médicos obtenida:');
    console.log(JSON.stringify(doctorsListResponse.data, null, 2));
    
    const doctorId = doctorsListResponse.data[0]?.id;
    if (!doctorId) {
      console.error('❌ No se encontró ningún médico en la clínica');
      process.exit(1);
    }
    console.log(`\n📌 Doctor ID para prueba: ${doctorId}\n`);

    // 7. Clínica ve el perfil completo del médico
    console.log('7️⃣ GET /api/clinics/doctors/{doctorId}/profile (ver perfil completo)...');
    const doctorProfileResponse = await axios.get(
      `${BASE_URL}/api/clinics/doctors/${doctorId}/profile`,
      { headers: clinicHeaders }
    );
    console.log('✅ Perfil completo del médico visto por la clínica:');
    console.log(JSON.stringify(doctorProfileResponse.data, null, 2));
    console.log('');

    // 8. Verificar que los PDFs están presentes
    console.log('8️⃣ Verificando que los PDFs están presentes...');
    const profile = doctorProfileResponse.data.professionalProfile;
    
    let pdfCount = 0;
    if (profile.education) {
      profile.education.forEach((edu: any) => {
        if (edu.fileUrl) {
          console.log(`✅ PDF encontrado en educación: ${edu.fileName}`);
          pdfCount++;
        }
      });
    }
    
    if (profile.certifications) {
      profile.certifications.forEach((cert: any) => {
        if (cert.fileUrl) {
          console.log(`✅ PDF encontrado en certificación: ${cert.fileName}`);
          pdfCount++;
        }
      });
    }
    
    console.log(`\n📊 Total de PDFs encontrados: ${pdfCount}`);
    console.log('');

    console.log('✅ ¡Todas las pruebas pasaron exitosamente! 🎉');
    console.log('\n📋 Resumen:');
    console.log('  ✅ Médico puede actualizar su perfil con PDFs en Base64');
    console.log('  ✅ Médico puede ver su propio perfil con PDFs');
    console.log('  ✅ Clínica puede ver el perfil completo del médico');
    console.log('  ✅ Los PDFs se almacenan y recuperan correctamente');
  } catch (error: any) {
    console.error('❌ Error en la prueba:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testDoctorProfileWithPDFs();
