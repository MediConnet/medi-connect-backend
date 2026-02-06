import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testSimple() {
  try {
    // Intentar login con diferentes credenciales
    console.log('Probando login con doctor@medicones.com...');
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'doctor@medicones.com',
        password: 'doctor123',
      });
      console.log('✅ Login exitoso!');
      
      const token = response.data.data?.token || response.data.data?.accessToken;
      console.log('Token:', token?.substring(0, 20) + '...');
      
      // Probar obtener perfil
      const profileResponse = await axios.get(
        `${BASE_URL}/api/doctors/clinic/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log('\n✅ Perfil obtenido:');
      console.log(JSON.stringify(profileResponse.data, null, 2));
    } catch (error: any) {
      console.log('❌ Error:', error.response?.data || error.message);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testSimple();
