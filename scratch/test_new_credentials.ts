import * as dotenv from "dotenv";
dotenv.config();

import { nuveiService } from "../src/payments/nuvei.service";

async function run() {
  console.log("Testing Nuvei initReference call with local .env credentials...");
  console.log("NUVEI_BASE_URL:", process.env.NUVEI_BASE_URL);
  console.log("NUVEI_SERVER_APP_CODE:", process.env.NUVEI_SERVER_APP_CODE);

  try {
    const result = await nuveiService.initReference({
      userId: "test-user-id",
      userEmail: "test@docalink.com",
      amount: 10.00,
      description: "Test Consultation Credentials Check",
      devReference: "TX-TEST-CREDENTIALS",
      vat: 0,
      taxableAmount: 10.00
    });
    console.log("✅ Success! Nuvei Response:", JSON.stringify(result));
  } catch (error: any) {
    console.error("❌ Error details:");
    console.error(error.message);
  }
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
