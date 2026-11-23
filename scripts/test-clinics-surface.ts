/**
 * Comprueba que, con el modulo de clinicas retirado, solo responden las rutas
 * que algo vivo usa, y que el resto devuelve 404.
 *
 * Llama al handler con eventos simulados. SOLO LECTURA.
 *
 *   npx ts-node scripts/test-clinics-surface.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import { handler as clinicsHandler } from "../src/clinics/handler";

function evento(method: string, path: string): any {
  return {
    rawPath: path,
    headers: {},
    body: null,
    queryStringParameters: {},
    requestContext: { http: { method, path, sourceIp: "127.0.0.1" } },
  };
}

// Rutas que SI usa algo vivo. No deben dar 404 por el corte: lo que devuelvan
// (401 por falta de sesion, 400, 404 de recurso) significa que llegaron al
// controlador, que es lo que se comprueba aqui.
const ACTIVAS: Array<[string, string]> = [
  ["GET", "/api/clinics/admin/payments"],
  ["POST", "/api/clinics/admin/payments/abc/mark-paid"],
  ["GET", "/api/clinics/invite/token-de-prueba"],
  ["POST", "/api/clinics/invite/token-de-prueba/associate"],
  ["POST", "/api/clinics/invite/token-de-prueba/reject"],
];

// Rutas del modulo retirado: deben responder 404.
const RETIRADAS: Array<[string, string]> = [
  ["GET", "/api/clinics/doctors/me/info"],
  ["GET", "/api/clinics/doctors/me/profile"],
  ["GET", "/api/clinics/doctors/me/appointments"],
  ["GET", "/api/clinics/doctors/me/messages"],
  ["GET", "/api/clinics/doctors/me/schedule"],
  ["GET", "/api/clinics/doctors"],
  ["POST", "/api/clinics/doctors/invite"],
  ["POST", "/api/clinics/doctors/abc/pay"],
  ["GET", "/api/clinics/payments"],
  ["POST", "/api/clinics/payments/abc/distribute"],
  ["GET", "/api/clinics/reception/messages"],
];

const resultados: boolean[] = [];

async function main() {
  console.log("=== rutas activas (NO deben cortarse con 404) ===");
  for (const [metodo, ruta] of ACTIVAS) {
    const res = await clinicsHandler(evento(metodo, ruta));
    // 401 = llego al controlador y pidio sesion. Lo que no queremos ver es el
    // 404 del corte, cuyo mensaje es fijo.
    const cortada =
      res.statusCode === 404 &&
      String(res.body || "").includes("no está disponible por el momento");
    const ok = !cortada;
    resultados.push(ok);
    console.log(`${ok ? "OK   " : "FALLA"} ${metodo.padEnd(5)} ${ruta.padEnd(50)} ${res.statusCode}`);
  }

  console.log("\n=== rutas del modulo retirado (deben dar 404) ===");
  for (const [metodo, ruta] of RETIRADAS) {
    const res = await clinicsHandler(evento(metodo, ruta));
    const ok = res.statusCode === 404;
    resultados.push(ok);
    console.log(`${ok ? "OK   " : "FALLA"} ${metodo.padEnd(5)} ${ruta.padEnd(50)} ${res.statusCode}`);
  }

  const fallos = resultados.filter((r) => !r).length;
  console.log(`\n=== ${resultados.length - fallos}/${resultados.length} correctos ===`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
