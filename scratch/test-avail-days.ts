import * as dotenv from 'dotenv';
dotenv.config();
import { handler } from '../src/doctors/handler';

async function testDay(dateStr: string) {
  console.log(`\n--- Test for ${dateStr} ---`);
  const event: any = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'paciente@test.com',
      'authorization': ''
    },
    requestContext: {
      http: { method: 'GET', path: '/api/doctors/availability' },
      authorizer: {
        lambda: { user: { id: 'paciente-user-id', email: 'paciente@test.com', role: 'patient' } }
      }
    },
    queryStringParameters: {
      doctorId: 'b0a59efe-6825-4675-a031-5baf490fe258', // Brandon's doctor ID
      date: dateStr
    }
  };

  const result = await handler(event);
  if (result.body) {
    const response = JSON.parse(result.body);
    console.log(`Available slots:`, response.data.availableSlots);
  }
}

async function main() {
  await testDay('2026-06-16'); // Tuesday
  await testDay('2026-06-17'); // Wednesday
  await testDay('2026-06-18'); // Thursday
}

main();
