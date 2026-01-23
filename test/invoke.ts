import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import * as events from './events';

/**
 * Utilidad para invocar handlers localmente
 */

export async function invokeHandler(
  handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResult>,
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult> {
  try {
    console.log('\n📥 Invoking handler...');
    console.log(`   Method: ${event.requestContext.http.method}`);
    console.log(`   Path: ${event.requestContext.http.path}`);
    if (event.body) {
      console.log(`   Body: ${event.body.substring(0, 100)}...`);
    }

    const result = await handler(event);

    console.log('\n📤 Response:');
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Body: ${result.body}`);

    return result;
  } catch (error: any) {
    console.error('\n❌ Error invoking handler:');
    console.error(error);
    throw error;
  }
}

/**
 * Helper para formatear respuesta JSON
 */
export function formatResponse(result: APIGatewayProxyResult): void {
  try {
    const body = JSON.parse(result.body);
    console.log('\n📋 Formatted Response:');
    console.log(JSON.stringify(body, null, 2));
  } catch (error) {
    console.log('\n📋 Response (raw):');
    console.log(result.body);
  }
}

// Exportar eventos para uso fácil
export { events };
