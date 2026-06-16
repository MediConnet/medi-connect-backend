import fetch from 'node-fetch';

async function testDoctorClinicSchedule() {
  console.log('🧪 [TEST] Probando horario de clínica en endpoint de doctor...\n');

  try {
    // 1. Login como doctor asociado a clínica
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
      const text = await loginResponse.text();
      console.error('Response:', text);
      return;
    }

    const loginData: any = await loginResponse.json();
    const token = loginData.data?.token || loginData.data?.accessToken;
    console.log('✅ Login exitoso\n');

    // 2. Obtener información de la clínica
    console.log('2️⃣ Obteniendo información de la clínica...');
    const clinicInfoResponse = await fetch('http://localhost:3000/api/clinics/doctors/me/info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 Status:', clinicInfoResponse.status);

    if (!clinicInfoResponse.ok) {
      console.error('❌ Error al obtener información de clínica');
      const text = await clinicInfoResponse.text();
      console.error('Response:', text);
      return;
    }

    const clinicData: any = await clinicInfoResponse.json();
    console.log('✅ Información de clínica obtenida');
    console.log('📦 Datos de la clínica:', JSON.stringify(clinicData.data, null, 2));
    console.log('');

    // 3. Verificar que el horario está presente
    console.log('3️⃣ Verificando horario de la clínica...');
    const clinic = clinicData.data.data || clinicData.data;
    
    if (!clinic || !clinic.schedule) {
      console.error('❌ El campo schedule no está presente');
      return;
    }
 
    console.log('✅ Campo schedule presente');
    console.log('📅 Horario de la clínica:');
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames: Record<string, string> = {
      monday: 'Lunes',
      tuesday: 'Martes',
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
      sunday: 'Domingo',
    };
 
    let allDaysPresent = true;
    let enabledDays = 0;
 
    days.forEach((day) => {
      const daySchedule = clinic.schedule[day];
      if (!daySchedule) {
        console.log(`  ❌ ${dayNames[day]}: NO PRESENTE`);
        allDaysPresent = false;
      } else {
        const status = daySchedule.enabled ? '✅ Abierto' : '❌ Cerrado';
        const hours = daySchedule.enabled 
          ? `${daySchedule.startTime} - ${daySchedule.endTime}`
          : 'N/A';
        console.log(`  ${status} ${dayNames[day]}: ${hours}`);
        if (daySchedule.enabled) enabledDays++;
      }
    });
 
    console.log('');
    console.log('🔍 Verificación de estructura:');
    console.log(`  ✅ Todos los días presentes: ${allDaysPresent ? 'Sí' : 'No'}`);
    console.log(`  ✅ Días habilitados: ${enabledDays}/7`);
    
    // Verificar estructura de cada día
    const mondaySchedule = clinic.schedule.monday;
    if (mondaySchedule) {
      const hasEnabled = typeof mondaySchedule.enabled === 'boolean';
      const hasStartTime = typeof mondaySchedule.startTime === 'string';
      const hasEndTime = typeof mondaySchedule.endTime === 'string';
      
      console.log(`  ✅ Estructura correcta: ${hasEnabled && hasStartTime && hasEndTime ? 'Sí' : 'No'}`);
      console.log(`    - enabled (boolean): ${hasEnabled ? '✅' : '❌'}`);
      console.log(`    - startTime (string): ${hasStartTime ? '✅' : '❌'}`);
      console.log(`    - endTime (string): ${hasEndTime ? '✅' : '❌'}`);
    }

    console.log('\n✅ [TEST] Prueba completada exitosamente');
  } catch (error: any) {
    console.error('❌ [TEST] Error:', error.message);
    throw error;
  }
}

testDoctorClinicSchedule();
