import fetch from 'node-fetch';

async function testClinicNewFeatures() {
  console.log('🧪 [TEST] Probando nuevas funcionalidades de clínicas...\n');

  try {
    // 1. Login como clínica
    console.log('1️⃣ Haciendo login como clínica...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'clinic@medicones.com',
        password: 'clinic123',
      }),
    });

    if (!loginResponse.ok) {
      console.error('❌ Error en login:', loginResponse.status);
      const text = await loginResponse.text();
      console.error('Response:', text);
      return;
    }

    const loginData: any = await loginResponse.json();
    const token = loginData.data?.token || loginData.data?.accessToken;
    console.log('✅ Login exitoso\n');

    // 2. Obtener perfil actual
    console.log('2️⃣ Obteniendo perfil actual...');
    const getProfileResponse = await fetch('http://localhost:3000/api/clinics/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Status:', getProfileResponse.status);

    if (!getProfileResponse.ok) {
      console.error('❌ Error al obtener perfil');
      const text = await getProfileResponse.text();
      console.error('Response:', text);
      return;
    }

    const profileData: any = await getProfileResponse.json();
    console.log('✅ Perfil obtenido');
    console.log('📦 Especialidades actuales:', profileData.data?.specialties || []);
    console.log('📦 Precios actuales:', profileData.data?.consultationPrices || []);
    console.log('📦 Cuenta bancaria actual:', profileData.data?.bankAccount || null);
    console.log('');

    // 3. Actualizar perfil con nuevos campos
    console.log('3️⃣ Actualizando perfil con nuevas funcionalidades...');
    
    const updateData = {
      specialties: ['Cardiología', 'Pediatría', 'Dermatología'],
      consultationPrices: [
        {
          specialty: 'Cardiología',
          price: 60.00,
          isActive: true,
        },
        {
          specialty: 'Pediatría',
          price: 45.00,
          isActive: true,
        },
        {
          specialty: 'Dermatología',
          price: 50.00,
          isActive: false,
        },
      ],
      bankAccount: {
        bankName: 'Banco Pichincha',
        accountNumber: '2100123456',
        accountType: 'checking',
        accountHolder: 'Clínica Central S.A.',
        identificationNumber: '1792345678001',
      },
    };

    console.log('📤 Datos a enviar:', JSON.stringify(updateData, null, 2));

    const updateResponse = await fetch('http://localhost:3000/api/clinics/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    console.log('📊 Status:', updateResponse.status, updateResponse.statusText);

    if (!updateResponse.ok) {
      console.error('❌ Error al actualizar perfil');
      const text = await updateResponse.text();
      console.error('Response:', text);
      return;
    }

    const updatedData: any = await updateResponse.json();
    console.log('✅ Perfil actualizado exitosamente');
    console.log('📦 Especialidades:', updatedData.data?.specialties);
    console.log('📦 Precios por especialidad:', JSON.stringify(updatedData.data?.consultationPrices, null, 2));
    console.log('📦 Cuenta bancaria:', JSON.stringify(updatedData.data?.bankAccount, null, 2));
    console.log('');

    // 4. Verificar que se guardó correctamente
    console.log('4️⃣ Verificando que los cambios se guardaron...');
    const verifyResponse = await fetch('http://localhost:3000/api/clinics/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!verifyResponse.ok) {
      console.error('❌ Error al verificar perfil');
      return;
    }

    const verifyData: any = await verifyResponse.json();
    console.log('✅ Perfil verificado');
    
    // Verificar que los datos coinciden
    const prices = verifyData.data?.consultationPrices || [];
    const bank = verifyData.data?.bankAccount;
    
    console.log('');
    console.log('🔍 Verificación de datos:');
    console.log(`  ✅ Precios por especialidad: ${prices.length} registros`);
    console.log(`  ✅ Cuenta bancaria: ${bank ? 'Configurada' : 'No configurada'}`);
    
    if (prices.length === 3) {
      console.log('  ✅ Cantidad de precios correcta (3)');
    } else {
      console.log(`  ❌ Cantidad de precios incorrecta (esperado: 3, actual: ${prices.length})`);
    }
    
    if (bank && bank.bankName === 'Banco Pichincha') {
      console.log('  ✅ Datos bancarios correctos');
    } else {
      console.log('  ❌ Datos bancarios incorrectos');
    }

    // 5. Probar validación: precio con especialidad inválida
    console.log('');
    console.log('5️⃣ Probando validación (especialidad inválida)...');
    const invalidData = {
      specialties: ['Cardiología'],
      consultationPrices: [
        {
          specialty: 'Neurología', // No está en specialties
          price: 70.00,
          isActive: true,
        },
      ],
    };

    const invalidResponse = await fetch('http://localhost:3000/api/clinics/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData),
    });

    if (invalidResponse.status === 400) {
      console.log('✅ Validación funcionando correctamente (rechazó especialidad inválida)');
    } else {
      console.log(`⚠️  Validación no funcionó como esperado (status: ${invalidResponse.status})`);
    }

    console.log('\n✅ [TEST] Prueba completada exitosamente');
  } catch (error: any) {
    console.error('❌ [TEST] Error:', error.message);
    throw error;
  }
}

testClinicNewFeatures();
