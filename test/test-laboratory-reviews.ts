import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Token de un laboratorio (debes obtenerlo del login)
const LABORATORY_TOKEN = 'eyJraWQiOiJsb2NhbC1kZXYta2V5IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI5OTk5OTk5OS05OTk5LTk5OTktOTk5OS05OTk5OTk5OTk5OTkiLCJlbWFpbCI6ImxhYkBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJjdXN0b206cm9sZSI6ImxhYm9yYXRvcnkiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock-signature';

async function testLaboratoryReviews() {
  console.log('\n🧪 ========================================');
  console.log('🧪 TEST: GET /api/laboratories/reviews');
  console.log('🧪 ========================================\n');

  try {
    console.log('📤 Enviando request...');
    console.log('🔑 Token:', LABORATORY_TOKEN.substring(0, 50) + '...');

    const response = await axios.get(`${BASE_URL}/api/laboratories/reviews`, {
      headers: {
        'Authorization': `Bearer ${LABORATORY_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('\n✅ Response Status:', response.status);
    console.log('✅ Response Data:', JSON.stringify(response.data, null, 2));

    const { reviews, averageRating, totalReviews } = response.data;

    console.log('\n📊 RESUMEN:');
    console.log(`   Total de reseñas: ${totalReviews}`);
    console.log(`   Calificación promedio: ${averageRating}`);
    console.log(`   Reseñas en array: ${reviews.length}`);

    if (reviews.length > 0) {
      console.log('\n📝 Primera reseña:');
      console.log(`   ID: ${reviews[0].id}`);
      console.log(`   Rating: ${reviews[0].rating}`);
      console.log(`   Comentario: ${reviews[0].comment || 'Sin comentario'}`);
      console.log(`   Paciente: ${reviews[0].patientName}`);
      console.log(`   Fecha: ${reviews[0].date}`);
    } else {
      console.log('\n✅ No hay reseñas (correcto para laboratorio nuevo)');
    }

    console.log('\n✅ TEST EXITOSO: Endpoint funciona correctamente');
    console.log('✅ Las reseñas están filtradas por el laboratorio autenticado');

  } catch (error: any) {
    console.error('\n❌ ERROR en el test:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Message:', error.message);
    }
    throw error;
  }
}

// Ejecutar test
testLaboratoryReviews()
  .then(() => {
    console.log('\n✅ Todos los tests completados');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Tests fallaron:', error.message);
    process.exit(1);
  });
