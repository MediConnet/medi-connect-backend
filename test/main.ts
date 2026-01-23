import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Importar handlers (desde dist después de build)
// En desarrollo, puedes usar ts-node para ejecutar directamente desde src

async function main() {
  console.log('🧪 MediConnect Backend - Local Testing\n');
  console.log('⚠️  Note: Make sure you have built the project (npm run build)');
  console.log('⚠️  Note: Make sure DATABASE_URL and other env vars are set\n');

  // Ejemplo: Test auth handler
  // Descomenta y ajusta según necesites

  /*
  try {
    const { handler } = await import('../dist/auth/handler');
    
    console.log('=== Testing Auth Login ===');
    const loginResult = await invokeHandler(handler, events.loginEvent);
    formatResponse(loginResult);

    console.log('\n=== Testing Auth Register ===');
    const registerResult = await invokeHandler(handler, events.registerEvent);
    formatResponse(registerResult);
  } catch (error) {
    console.error('Error testing auth handler:', error);
  }
  */

  /*
  try {
    const { handler } = await import('../dist/doctors/handler');
    
    console.log('=== Testing Get Doctor Profile ===');
    const profileResult = await invokeHandler(handler, events.getDoctorProfileEvent);
    formatResponse(profileResult);
  } catch (error) {
    console.error('Error testing doctors handler:', error);
  }
  */

  /*
  try {
    const { handler } = await import('../dist/supplies/handler');
    
    console.log('=== Testing Get Stores ===');
    const storesResult = await invokeHandler(handler, events.getStoresEvent);
    formatResponse(storesResult);
  } catch (error) {
    console.error('Error testing supplies handler:', error);
  }
  */

  console.log('\n✅ Testing complete!');
  console.log('\n💡 Tip: Uncomment the test sections in test/main.ts to run specific tests');
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main().catch(console.error);
}

export { main };
