/**
 * Comprueba que ninguna ruta de /api/admin responde sin un token de admin.
 *
 * Llama al handler directamente con eventos simulados. SOLO LECTURA: todas las
 * llamadas deben cortarse en la autenticacion antes de tocar la base.
 *
 *   npx ts-node scripts/test-admin-auth.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import { handler as adminHandler } from "../src/admin/handler";
import { signToken } from "../src/shared/auth";

function evento(method: string, path: string, token?: string): any {
  return {
    rawPath: path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: null,
    queryStringParameters: {},
    requestContext: { http: { method, path, sourceIp: "127.0.0.1" } },
  };
}

// Rutas sensibles: leen o mueven dinero.
const RUTAS: Array<[string, string]> = [
  ["GET", "/api/admin/payments/doctors"],
  ["GET", "/api/admin/payments/aesthetic"],
  ["GET", "/api/admin/payments/clinics"],
  ["GET", "/api/admin/payments/history"],
  ["GET", "/api/admin/payments/transactions"],
  ["GET", "/api/admin/payments/refund-requests"],
  ["POST", "/api/admin/payments/refund-requests/abc/approve"],
  ["POST", "/api/admin/payments/refund-requests/abc/reject"],
  ["GET", "/api/admin/users"],
  ["GET", "/api/admin/dashboard/stats"],
  ["GET", "/api/admin/settings"],
];

const resultados: boolean[] = [];

async function main() {
  console.log("=== sin token (debe rechazar todo) ===");
  for (const [metodo, ruta] of RUTAS) {
    const res = await adminHandler(evento(metodo, ruta));
    const ok = res.statusCode === 401 || res.statusCode === 403;
    resultados.push(ok);
    console.log(`${ok ? "OK   " : "FALLA"} ${metodo.padEnd(5)} ${ruta.padEnd(52)} ${res.statusCode}`);
  }

  console.log("\n=== con token de paciente (debe rechazar todo) ===");
  const tokenPaciente = signToken(
    { userId: "no-existe", email: "paciente@ejemplo.com", role: "patient" },
    "access",
  );
  for (const [metodo, ruta] of RUTAS.slice(0, 5)) {
    const res = await adminHandler(evento(metodo, ruta, tokenPaciente));
    const ok = res.statusCode === 401 || res.statusCode === 403;
    resultados.push(ok);
    console.log(`${ok ? "OK   " : "FALLA"} ${metodo.padEnd(5)} ${ruta.padEnd(52)} ${res.statusCode}`);
  }

  console.log("\n=== con un token falsificado de admin (debe rechazar) ===");
  const falso = Buffer.from(
    JSON.stringify({ sub: "x", email: "a@b.c", role: "admin", typ: "access" }),
  ).toString("base64");
  const res = await adminHandler(evento("GET", "/api/admin/users", `${falso}.${falso}.firmafalsa`));
  const ok = res.statusCode === 401 || res.statusCode === 403;
  resultados.push(ok);
  console.log(`${ok ? "OK   " : "FALLA"} GET   /api/admin/users (token sin firma valida)      ${res.statusCode}`);

  const fallos = resultados.filter((r) => !r).length;
  console.log(`\n=== ${resultados.length - fallos}/${resultados.length} correctos ===`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
