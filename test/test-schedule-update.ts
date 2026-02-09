import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';

// Token de un médico (debes obtenerlo de tu sistema)
const DOCTOR_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Reemplazar con token real
const DOCTOR_ID = 'db_a20fae6fe'; // Reemplazar con ID real

async function testScheduleUpdate() {
  console.log('🧪 TEST: Actualización de Horarios de Médico\n');

  try {
    // 1. Obtener horarios actuales
    console.log('1️⃣ Obteniendo horarios actuales...');
    const getResponse = await fetch(
      `${API_URL}/api/clinics/doctors/${DOCTOR_ID}/schedule`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${DOCTOR_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const currentSchedule = await getResponse.json();
    console.log('✅ Horarios actuales:', JSON.stringify(currentSchedule, null, 2));

    // 2. Actualizar horarios
    console.log('\n2️⃣ Actualizando horarios...');
    const newSchedule = {
      schedule: {
        monday: {
          enabled: true,
          startTime: '08:00',
          endTime: '16:00',
          breakStart: '12:00',
          breakEnd: '13:00',
        },
        tuesday: {
          enabled: true,
          startTime: '08:00',
          endTime: '16:00',
          breakStart: null,
          breakEnd: null,
        },
        wednesday: {
          enabled: true,
          startTime: '09:00',
          endTime: '17:00',
          breakStart: null,
          breakEnd: null,
        },
        thursday: {
          enabled: false,
          startTime: '09:00',
          endTime: '17:00',
          breakStart: null,
          breakEnd: null,
        },
        friday: {
          enabled: true,
          startTime: '08:00',
          endTime: '14:00',
          breakStart: null,
          breakEnd: null,
        },
        saturday: {
          enabled: false,
          startTime: '09:00',
          endTime: '13:00',
          breakStart: null,
          breakEnd: null,
        },
        sunday: {
          enabled: false,
          startTime: '09:00',
          endTime: '13:00',
          breakStart: null,
          breakEnd: null,
        },
      },
    };

    const updateResponse = await fetch(
      `${API_URL}/api/clinics/doctors/${DOCTOR_ID}/schedule`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${DOCTOR_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSchedule),
      }
    );

    const updatedSchedule = await updateResponse.json();
    console.log('✅ Horarios actualizados:', JSON.stringify(updatedSchedule, null, 2));

    // 3. Verificar que se guardaron correctamente
    console.log('\n3️⃣ Verificando horarios guardados...');
    const verifyResponse = await fetch(
      `${API_URL}/api/clinics/doctors/${DOCTOR_ID}/schedule`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${DOCTOR_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const verifiedSchedule = await verifyResponse.json();
    console.log('✅ Horarios verificados:', JSON.stringify(verifiedSchedule, null, 2));

    // 4. Comparar
    console.log('\n4️⃣ Comparando horarios...');
    const sent = newSchedule.schedule;
    const received = (verifiedSchedule as any).data.schedule;

    let allMatch = true;
    for (const day of Object.keys(sent) as Array<keyof typeof sent>) {
      const sentDay = sent[day];
      const receivedDay = received[day];

      if (sentDay.enabled !== receivedDay.enabled) {
        console.log(`❌ ${day}: enabled no coincide (enviado: ${sentDay.enabled}, recibido: ${receivedDay.enabled})`);
        allMatch = false;
      }
      if (sentDay.enabled && sentDay.startTime !== receivedDay.startTime) {
        console.log(`❌ ${day}: startTime no coincide (enviado: ${sentDay.startTime}, recibido: ${receivedDay.startTime})`);
        allMatch = false;
      }
      if (sentDay.enabled && sentDay.endTime !== receivedDay.endTime) {
        console.log(`❌ ${day}: endTime no coincide (enviado: ${sentDay.endTime}, recibido: ${receivedDay.endTime})`);
        allMatch = false;
      }
    }

    if (allMatch) {
      console.log('✅ Todos los horarios coinciden correctamente');
    } else {
      console.log('❌ Hay diferencias en los horarios');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testScheduleUpdate();
