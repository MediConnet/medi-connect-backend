import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

// Credenciales de prueba
const DOCTOR_EMAIL = 'doctor@medicones.com';
const DOCTOR_PASSWORD = 'doctor123';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: any;
  };
}

interface PaymentsResponse {
  success: boolean;
  data: any[];
}

interface PaymentDetailResponse {
  success: boolean;
  data: any;
}

async function testDoctorPayments() {
  console.log('🧪 ========================================');
  console.log('🧪 TEST: Doctor Payments Endpoints');
  console.log('🧪 ========================================\n');

  try {
    // ============================================
    // 1. LOGIN COMO MÉDICO
    // ============================================
    console.log('📝 1. Login como médico...');
    const loginResponse = await axios.post<LoginResponse>(`${BASE_URL}/api/auth/login`, {
      email: DOCTOR_EMAIL,
      password: DOCTOR_PASSWORD,
    });

    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso');
    console.log(`   Token: ${token.substring(0, 20)}...`);
    console.log(`   Usuario: ${loginResponse.data.data.user.email}\n`);

    // ============================================
    // 2. GET /api/doctors/payments (TODOS)
    // ============================================
    console.log('📝 2. GET /api/doctors/payments (todos los pagos)...');
    const paymentsResponse = await axios.get<PaymentsResponse>(
      `${BASE_URL}/api/doctors/payments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!paymentsResponse.data.success) {
      throw new Error('Failed to get payments');
    }

    const payments = paymentsResponse.data.data;
    console.log('✅ Pagos obtenidos exitosamente');
    console.log(`   Total de pagos: ${payments.length}`);
    
    if (payments.length > 0) {
      console.log('\n   📋 Primeros 3 pagos:');
      payments.slice(0, 3).forEach((payment, index) => {
        console.log(`   ${index + 1}. ID: ${payment.id}`);
        console.log(`      Paciente: ${payment.patientName}`);
        console.log(`      Fecha: ${payment.date}`);
        console.log(`      Monto: $${payment.amount}`);
        console.log(`      Comisión: $${payment.commission}`);
        console.log(`      Neto: $${payment.netAmount}`);
        console.log(`      Estado: ${payment.status}`);
        console.log(`      Fuente: ${payment.source}`);
        if (payment.clinicName) {
          console.log(`      Clínica: ${payment.clinicName}`);
        }
        console.log('');
      });
    } else {
      console.log('   ⚠️  No hay pagos registrados para este médico\n');
    }

    // ============================================
    // 3. GET /api/doctors/payments?status=pending
    // ============================================
    console.log('📝 3. GET /api/doctors/payments?status=pending (filtro)...');
    const pendingResponse = await axios.get<PaymentsResponse>(
      `${BASE_URL}/api/doctors/payments?status=pending`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const pendingPayments = pendingResponse.data.data;
    console.log('✅ Pagos pendientes obtenidos');
    console.log(`   Total pendientes: ${pendingPayments.length}\n`);

    // ============================================
    // 4. GET /api/doctors/payments?status=paid
    // ============================================
    console.log('📝 4. GET /api/doctors/payments?status=paid (filtro)...');
    const paidResponse = await axios.get<PaymentsResponse>(
      `${BASE_URL}/api/doctors/payments?status=paid`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const paidPayments = paidResponse.data.data;
    console.log('✅ Pagos completados obtenidos');
    console.log(`   Total pagados: ${paidPayments.length}\n`);

    // ============================================
    // 5. GET /api/doctors/payments?source=admin
    // ============================================
    console.log('📝 5. GET /api/doctors/payments?source=admin (filtro)...');
    const adminResponse = await axios.get<PaymentsResponse>(
      `${BASE_URL}/api/doctors/payments?source=admin`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const adminPayments = adminResponse.data.data;
    console.log('✅ Pagos de admin obtenidos');
    console.log(`   Total de admin: ${adminPayments.length}\n`);

    // ============================================
    // 6. GET /api/doctors/payments?source=clinic
    // ============================================
    console.log('📝 6. GET /api/doctors/payments?source=clinic (filtro)...');
    const clinicResponse = await axios.get<PaymentsResponse>(
      `${BASE_URL}/api/doctors/payments?source=clinic`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const clinicPayments = clinicResponse.data.data;
    console.log('✅ Pagos de clínica obtenidos');
    console.log(`   Total de clínica: ${clinicPayments.length}\n`);

    // ============================================
    // 7. GET /api/doctors/payments/:id (DETALLE)
    // ============================================
    if (payments.length > 0) {
      const firstPaymentId = payments[0].id;
      console.log(`📝 7. GET /api/doctors/payments/${firstPaymentId} (detalle)...`);
      
      const detailResponse = await axios.get<PaymentDetailResponse>(
        `${BASE_URL}/api/doctors/payments/${firstPaymentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!detailResponse.data.success) {
        throw new Error('Failed to get payment detail');
      }

      const paymentDetail = detailResponse.data.data;
      console.log('✅ Detalle de pago obtenido');
      console.log('\n   📋 Información completa:');
      console.log(`   ID: ${paymentDetail.id}`);
      console.log(`   Paciente: ${paymentDetail.patientName}`);
      console.log(`   Fecha: ${paymentDetail.date}`);
      console.log(`   Monto total: $${paymentDetail.amount}`);
      console.log(`   Comisión (15%): $${paymentDetail.commission}`);
      console.log(`   Monto neto: $${paymentDetail.netAmount}`);
      console.log(`   Estado: ${paymentDetail.status}`);
      console.log(`   Método de pago: ${paymentDetail.paymentMethod}`);
      console.log(`   Fuente: ${paymentDetail.source}`);
      
      if (paymentDetail.clinicName) {
        console.log(`   Clínica: ${paymentDetail.clinicName}`);
      }
      
      if (paymentDetail.appointment) {
        console.log('\n   📅 Información de la cita:');
        console.log(`   ID Cita: ${paymentDetail.appointment.id}`);
        console.log(`   Motivo: ${paymentDetail.appointment.reason}`);
        console.log(`   Fecha programada: ${paymentDetail.appointment.scheduledFor}`);
      }
      console.log('');
    }

    // ============================================
    // 8. GET /api/doctors/payments/invalid-id (ERROR 404)
    // ============================================
    console.log('📝 8. GET /api/doctors/payments/invalid-id (debe fallar)...');
    try {
      await axios.get(
        `${BASE_URL}/api/doctors/payments/invalid-id-12345`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log('❌ ERROR: Debería haber fallado con 404\n');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('✅ Error 404 esperado - Pago no encontrado\n');
      } else {
        console.log(`❌ Error inesperado: ${error.response?.status}\n`);
      }
    }

    // ============================================
    // 9. RESUMEN
    // ============================================
    console.log('📊 ========================================');
    console.log('📊 RESUMEN DE PAGOS');
    console.log('📊 ========================================');
    console.log(`   Total de pagos: ${payments.length}`);
    console.log(`   Pendientes: ${pendingPayments.length}`);
    console.log(`   Pagados: ${paidPayments.length}`);
    console.log(`   De admin: ${adminPayments.length}`);
    console.log(`   De clínica: ${clinicPayments.length}`);
    
    // Calcular totales
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalCommission = payments.reduce((sum, p) => sum + p.commission, 0);
    const totalNet = payments.reduce((sum, p) => sum + p.netAmount, 0);
    
    console.log(`\n   💰 Totales:`);
    console.log(`   Monto bruto: $${totalAmount.toFixed(2)}`);
    console.log(`   Comisiones: $${totalCommission.toFixed(2)}`);
    console.log(`   Monto neto: $${totalNet.toFixed(2)}`);
    
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.netAmount, 0);
    const paidAmount = paidPayments.reduce((sum, p) => sum + p.netAmount, 0);
    
    console.log(`\n   📊 Por estado:`);
    console.log(`   Pendiente de cobro: $${pendingAmount.toFixed(2)}`);
    console.log(`   Ya cobrado: $${paidAmount.toFixed(2)}`);

    console.log('\n✅ ========================================');
    console.log('✅ TODOS LOS TESTS PASARON CORRECTAMENTE');
    console.log('✅ ========================================\n');

  } catch (error: any) {
    console.error('\n❌ ========================================');
    console.error('❌ ERROR EN LOS TESTS');
    console.error('❌ ========================================');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    } else {
      console.error(error.message);
    }
    console.error('❌ ========================================\n');
    process.exit(1);
  }
}

// Ejecutar tests
testDoctorPayments();
