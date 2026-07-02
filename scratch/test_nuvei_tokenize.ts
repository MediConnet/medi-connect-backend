/**
 * Script de diagnóstico: prueba la tokenización directa con Nuvei/Paymentez
 * Ejecutar: npx ts-node scratch/test_nuvei_tokenize.ts
 */
import { createHash } from "crypto";
import fetch from "node-fetch";

const CLIENT_APP_CODE = process.env.NUVEI_CLIENT_APP_CODE || "NUVEISTG-EC-CLIENT";
const CLIENT_APP_KEY  = process.env.NUVEI_CLIENT_APP_KEY  || "rvpKAv2tc49x6YL38fvtv5jJxRRiPs";

function generateAuthToken(): string {
  const timestamp  = Math.floor(Date.now() / 1000).toString();
  const signature  = createHash("sha256").update(CLIENT_APP_KEY + timestamp).digest("hex");
  const tokenStr   = `${CLIENT_APP_CODE};${timestamp};${signature}`;
  return Buffer.from(tokenStr).toString("base64");
}

async function run() {
  const authToken = generateAuthToken();
  console.log("🔑 Auth-Token generado:", authToken.substring(0, 40) + "...");

  const url = "https://ccapi-stg.paymentez.com/v2/card/add";
  const body = {
    session_id: `TEST-SESSION-${Date.now()}`,
    user: {
      id: "test-user-001",
      email: "test@mediconnet.com",
    },
    card: {
      number: "4111111111111111",          // Visa test card
      holder_name: "Paciente Prueba",
      expiry_month: 1,
      expiry_year: 2028,
      cvc: "123",
    },
  };

  console.log("\n📡 Enviando a Nuvei:", url);
  console.log("📦 Body:", JSON.stringify(body, null, 2));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Auth-Token": authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    console.log("\n📊 Status HTTP:", response.status, response.statusText);
    console.log("📄 Raw Response:", rawText);

    try {
      const result = JSON.parse(rawText);
      console.log("\n✅ Parsed JSON:");
      console.log(JSON.stringify(result, null, 2));

      // Simular la lógica del paymentService
      if (!response.ok || result?.error || result?.card?.status === "rejected") {
        const errorMsg = result?.error?.description || result?.card?.message || "La tarjeta ingresada no es válida.";
        console.log("\n❌ Se lanzaría error con mensaje:", JSON.stringify(errorMsg));
        console.log("   typeof error?.description:", typeof result?.error?.description);
        console.log("   error objeto completo:", JSON.stringify(result?.error));
      } else {
        console.log("\n✅ Token obtenido:", result?.card?.token);
      }
    } catch (parseError) {
      console.log("⚠️ No se pudo parsear como JSON:", parseError);
    }

  } catch (networkError: any) {
    console.log("\n🔴 Error de RED / fetch falló:");
    console.log("   typeof error:", typeof networkError);
    console.log("   error.message:", networkError?.message);
    console.log("   JSON.stringify(error):", JSON.stringify(networkError));
    console.log("   Object.keys:", Object.keys(networkError || {}));
  }
}

run().catch(console.error);
