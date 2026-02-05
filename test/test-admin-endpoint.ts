import fetch from 'node-fetch';

async function testAdminEndpoint() {
  console.log('🧪 [TEST] Probando endpoint de admin...\n');

  try {
    // Primero, hacer login para obtener un token
    console.log('1️⃣ Haciendo login...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@medicones.com',
        password: 'admin123',
      }),
    });

    if (!loginResponse.ok) {
      console.error('❌ Error en login:', loginResponse.status, loginResponse.statusText);
      const text = await loginResponse.text();
      console.error('Response:', text);
      return;
    }

    const loginData: any = await loginResponse.json();
    console.log('✅ Login exitoso');
    
    const token = loginData.data?.token || loginData.data?.accessToken || loginData.token || loginData.accessToken;
    if (!token) {
      console.error('❌ No se recibió token en la respuesta');
      console.log('Response:', loginData);
      return;
    }
    
    console.log('🔑 Token obtenido:', token.substring(0, 50) + '...\n');

    // Probar endpoint de pagos a médicos
    console.log('2️⃣ Probando GET /api/admin/payments/doctors...');
    const paymentsResponse = await fetch('http://localhost:3000/api/admin/payments/doctors', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Status:', paymentsResponse.status, paymentsResponse.statusText);
    console.log('📋 Headers:', Object.fromEntries(paymentsResponse.headers.entries()));

    if (!paymentsResponse.ok) {
      console.error('❌ Error en la petición');
      const text = await paymentsResponse.text();
      console.error('Response:', text);
      return;
    }

    const paymentsData: any = await paymentsResponse.json();
    console.log('✅ Respuesta exitosa');
    console.log('📦 Datos:', JSON.stringify(paymentsData, null, 2));

    // Probar endpoint de usuarios
    console.log('\n3️⃣ Probando GET /api/admin/users...');
    const usersResponse = await fetch('http://localhost:3000/api/admin/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Status:', usersResponse.status, usersResponse.statusText);

    if (!usersResponse.ok) {
      console.error('❌ Error en la petición');
      const text = await usersResponse.text();
      console.error('Response:', text);
      return;
    }

    const usersData: any = await usersResponse.json();
    console.log('✅ Respuesta exitosa');
    console.log('📦 Total usuarios:', usersData.users?.length || 0);
    
    // Contar clínicas
    const clinics = usersData.users?.filter((u: any) => u.role === 'clinic' || u.clinic) || [];
    console.log('🏥 Clínicas encontradas:', clinics.length);
    if (clinics.length > 0) {
      console.log('🏥 Clínicas:', clinics.map((c: any) => c.displayName || c.email));
    }

    console.log('\n✅ [TEST] Prueba completada exitosamente');
  } catch (error: any) {
    console.error('❌ [TEST] Error:', error.message);
    throw error;
  }
}

testAdminEndpoint();
