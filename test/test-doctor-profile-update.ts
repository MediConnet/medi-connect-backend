import fetch from 'node-fetch';

async function testDoctorProfileUpdate() {
  console.log('🧪 [TEST] Probando actualización de perfil de doctor...\n');

  try {
    // 1. Login como doctor
    console.log('1️⃣ Haciendo login como doctor...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doctor@medicones.com',
        password: 'doctor123',
      }),
    });

    if (!loginResponse.ok) {
      console.error('❌ Error en login:', loginResponse.status);
      return;
    }

    const loginData: any = await loginResponse.json();
    const token = loginData.data?.token || loginData.data?.accessToken;
    console.log('✅ Login exitoso\n');

    // 2. Obtener perfil actual
    console.log('2️⃣ Obteniendo perfil actual...');
    const getProfileResponse = await fetch('http://localhost:3000/api/doctors/profile', {
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
    console.log('📦 Datos actuales:', JSON.stringify(profileData.data || profileData, null, 2));
    console.log('');

    // 3. Actualizar perfil
    console.log('3️⃣ Actualizando perfil...');
    const updateData = {
      full_name: 'Dr. Juan Pérez Actualizado',
      bio: 'Médico general con 10 años de experiencia',
      years_of_experience: 10,
      consultation_fee: 50.00,
      phone: '0999999999',
      whatsapp: '0999999999',
      address: 'Av. Principal 123',
      payment_methods: ['cash', 'card'],
      is_published: true,
      specialties: ['Medicina General'],
      workSchedule: [
        { day: 'monday', enabled: true, startTime: '09:00', endTime: '17:00' },
        { day: 'tuesday', enabled: true, startTime: '09:00', endTime: '17:00' },
        { day: 'wednesday', enabled: true, startTime: '09:00', endTime: '17:00' },
        { day: 'thursday', enabled: true, startTime: '09:00', endTime: '17:00' },
        { day: 'friday', enabled: true, startTime: '09:00', endTime: '17:00' },
        { day: 'saturday', enabled: false, startTime: null, endTime: null },
        { day: 'sunday', enabled: false, startTime: null, endTime: null },
      ],
    };

    console.log('📤 Datos a enviar:', JSON.stringify(updateData, null, 2));

    const updateResponse = await fetch('http://localhost:3000/api/doctors/profile', {
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
    console.log('📦 Datos actualizados:', JSON.stringify(updatedData.data || updatedData, null, 2));

    console.log('\n✅ [TEST] Prueba completada exitosamente');
  } catch (error: any) {
    console.error('❌ [TEST] Error:', error.message);
    throw error;
  }
}

testDoctorProfileUpdate();
