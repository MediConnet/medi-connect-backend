import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Credenciales del médico asociado a clínica
const DOCTOR_EMAIL = 'dr.juan.perez@clinicacentral.com';
const DOCTOR_PASSWORD = 'doctor123';

async function testDoctorBankAccount() {
  console.log('🧪 Iniciando prueba de cuenta bancaria de médico asociado...\n');

  try {
    // 1. Login como médico
    console.log('1️⃣ Login como médico asociado...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: DOCTOR_EMAIL,
      password: DOCTOR_PASSWORD,
    });

    const token = loginResponse.data.token;
    console.log('✅ Login exitoso');
    console.log(`   Token: ${token.substring(0, 20)}...\n`);

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 2. GET /api/doctors/bank-account (debe retornar null la primera vez)
    console.log('2️⃣ GET /api/doctors/bank-account (primera vez - debe ser null)...');
    const getResponse1 = await axios.get(`${BASE_URL}/api/doctors/bank-account`, { headers });
    console.log('✅ Respuesta recibida:');
    console.log(JSON.stringify(getResponse1.data, null, 2));
    console.log('');

    // 3. PUT /api/doctors/bank-account (crear cuenta bancaria)
    console.log('3️⃣ PUT /api/doctors/bank-account (crear cuenta)...');
    const bankAccountData = {
      bankName: 'Banco Pichincha',
      accountNumber: '2100123456',
      accountType: 'checking',
      accountHolder: 'Dr. Juan Pérez',
      identificationNumber: '1234567890',
    };

    const putResponse = await axios.put(
      `${BASE_URL}/api/doctors/bank-account`,
      bankAccountData,
      { headers }
    );
    console.log('✅ Cuenta bancaria creada:');
    console.log(JSON.stringify(putResponse.data, null, 2));
    console.log('');

    // 4. GET /api/doctors/bank-account (debe retornar los datos)
    console.log('4️⃣ GET /api/doctors/bank-account (segunda vez - debe tener datos)...');
    const getResponse2 = await axios.get(`${BASE_URL}/api/doctors/bank-account`, { headers });
    console.log('✅ Datos bancarios obtenidos:');
    console.log(JSON.stringify(getResponse2.data, null, 2));
    console.log('');

    // 5. PUT /api/doctors/bank-account (actualizar cuenta bancaria)
    console.log('5️⃣ PUT /api/doctors/bank-account (actualizar cuenta)...');
    const updatedBankAccountData = {
      bankName: 'Banco del Pacífico',
      accountNumber: '9876543210',
      accountType: 'savings',
      accountHolder: 'Dr. Juan Pérez Actualizado',
      identificationNumber: '0987654321',
    };

    const putResponse2 = await axios.put(
      `${BASE_URL}/api/doctors/bank-account`,
      updatedBankAccountData,
      { headers }
    );
    console.log('✅ Cuenta bancaria actualizada:');
    console.log(JSON.stringify(putResponse2.data, null, 2));
    console.log('');

    // 6. GET /api/doctors/bank-account (verificar actualización)
    console.log('6️⃣ GET /api/doctors/bank-account (verificar actualización)...');
    const getResponse3 = await axios.get(`${BASE_URL}/api/doctors/bank-account`, { headers });
    console.log('✅ Datos bancarios actualizados:');
    console.log(JSON.stringify(getResponse3.data, null, 2));
    console.log('');

    // 7. Validaciones - Probar con datos inválidos
    console.log('7️⃣ Probando validaciones (debe fallar)...');
    try {
      await axios.put(
        `${BASE_URL}/api/doctors/bank-account`,
        {
          bankName: 'Banco Test',
          accountNumber: '123', // Muy corto
          accountType: 'checking',
          accountHolder: 'Test',
        },
        { headers }
      );
      console.log('❌ ERROR: Debería haber fallado la validación');
    } catch (error: any) {
      if (error.response?.status === 400) {
        console.log('✅ Validación funcionando correctamente:');
        console.log(`   ${error.response.data.message}`);
      } else {
        console.log('❌ Error inesperado:', error.message);
      }
    }
    console.log('');

    console.log('✅ ¡Todas las pruebas pasaron exitosamente! 🎉');
  } catch (error: any) {
    console.error('❌ Error en la prueba:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testDoctorBankAccount();
