import { handler } from '../src/admin/handler';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

// Token de admin (debes reemplazar con un token válido de admin)
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5YzI5YjI5Zi1hNzI5LTRhNzItYjI5Zi1hNzI5NGE3MmIyOWYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MzY3MjQwMDB9.REPLACE_WITH_VALID_SIGNATURE';

async function testGetSettings() {
  console.log('\n🧪 TEST: GET /api/admin/settings');
  console.log('='.repeat(50));

  const event: Partial<APIGatewayProxyEventV2> = {
    requestContext: {
      http: {
        method: 'GET',
        path: '/api/admin/settings',
      },
    } as any,
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
    },
  };

  try {
    const result = await handler(event as APIGatewayProxyEventV2);
    console.log('📊 Status:', result.statusCode);
    console.log('📦 Response:', JSON.parse(result.body || '{}'));
    
    if (result.statusCode === 200) {
      console.log('✅ GET settings exitoso');
      return JSON.parse(result.body || '{}');
    } else {
      console.log('❌ GET settings falló');
      return null;
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function testUpdateSettings() {
  console.log('\n🧪 TEST: PUT /api/admin/settings');
  console.log('='.repeat(50));

  const updateData = {
    commissionDoctor: 18,
    commissionClinic: 12,
    commissionLaboratory: 14,
    commissionPharmacy: 9,
    commissionSupplies: 11,
    commissionAmbulance: 16,
    notifyNewRequests: true,
    notifyEmailSummary: false,
    autoApproveServices: false,
    maintenanceMode: false,
    onlyAdminCanPublishAds: true,
    requireAdApproval: true,
    maxAdsPerProvider: 2,
    adApprovalRequired: true,
    serviceApprovalRequired: true,
    allowServiceSelfActivation: false,
    allowAdSelfPublishing: false,
  };

  const event: Partial<APIGatewayProxyEventV2> = {
    requestContext: {
      http: {
        method: 'PUT',
        path: '/api/admin/settings',
      },
    } as any,
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(updateData),
  };

  try {
    const result = await handler(event as APIGatewayProxyEventV2);
    console.log('📊 Status:', result.statusCode);
    console.log('📦 Response:', JSON.parse(result.body || '{}'));
    
    if (result.statusCode === 200) {
      console.log('✅ UPDATE settings exitoso');
      return JSON.parse(result.body || '{}');
    } else {
      console.log('❌ UPDATE settings falló');
      return null;
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function testPartialUpdate() {
  console.log('\n🧪 TEST: PUT /api/admin/settings (Actualización Parcial)');
  console.log('='.repeat(50));

  const updateData = {
    commissionDoctor: 20,
    maintenanceMode: true,
  };

  const event: Partial<APIGatewayProxyEventV2> = {
    requestContext: {
      http: {
        method: 'PUT',
        path: '/api/admin/settings',
      },
    } as any,
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(updateData),
  };

  try {
    const result = await handler(event as APIGatewayProxyEventV2);
    console.log('📊 Status:', result.statusCode);
    console.log('📦 Response:', JSON.parse(result.body || '{}'));
    
    if (result.statusCode === 200) {
      console.log('✅ Actualización parcial exitosa');
      return JSON.parse(result.body || '{}');
    } else {
      console.log('❌ Actualización parcial falló');
      return null;
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('\n🚀 INICIANDO TESTS DE ADMIN SETTINGS');
  console.log('='.repeat(50));

  // Test 1: GET settings (debe crear valores por defecto si no existen)
  const getResult1 = await testGetSettings();
  
  if (!getResult1) {
    console.log('\n❌ No se pudo obtener settings iniciales. Abortando tests.');
    return;
  }

  // Test 2: UPDATE settings completo
  await new Promise(resolve => setTimeout(resolve, 1000));
  const updateResult = await testUpdateSettings();

  // Test 3: GET settings después de actualizar
  await new Promise(resolve => setTimeout(resolve, 1000));
  const getResult2 = await testGetSettings();

  // Test 4: Actualización parcial
  await new Promise(resolve => setTimeout(resolve, 1000));
  const partialResult = await testPartialUpdate();

  // Test 5: GET settings después de actualización parcial
  await new Promise(resolve => setTimeout(resolve, 1000));
  const getResult3 = await testGetSettings();

  console.log('\n📊 RESUMEN DE TESTS');
  console.log('='.repeat(50));
  console.log('✅ GET inicial:', getResult1 ? 'OK' : 'FAIL');
  console.log('✅ UPDATE completo:', updateResult ? 'OK' : 'FAIL');
  console.log('✅ GET después de update:', getResult2 ? 'OK' : 'FAIL');
  console.log('✅ UPDATE parcial:', partialResult ? 'OK' : 'FAIL');
  console.log('✅ GET después de parcial:', getResult3 ? 'OK' : 'FAIL');

  // Verificar que los valores se actualizaron correctamente
  if (getResult2?.data) {
    console.log('\n🔍 VERIFICACIÓN DE VALORES ACTUALIZADOS:');
    console.log('Commission Doctor:', getResult2.data.commissionDoctor === 18 ? '✅' : '❌');
    console.log('Commission Clinic:', getResult2.data.commissionClinic === 12 ? '✅' : '❌');
    console.log('Notify Email Summary:', getResult2.data.notifyEmailSummary === false ? '✅' : '❌');
  }

  if (getResult3?.data) {
    console.log('\n🔍 VERIFICACIÓN DE ACTUALIZACIÓN PARCIAL:');
    console.log('Commission Doctor:', getResult3.data.commissionDoctor === 20 ? '✅' : '❌');
    console.log('Maintenance Mode:', getResult3.data.maintenanceMode === true ? '✅' : '❌');
    console.log('Commission Clinic (no cambió):', getResult3.data.commissionClinic === 12 ? '✅' : '❌');
  }
}

// Ejecutar tests
runTests().catch(console.error);
