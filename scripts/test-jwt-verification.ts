/**
 * Prueba el esquema de tokens: firma, expiracion y separacion access/refresh.
 * No toca la base de datos.
 *
 *   npx ts-node scripts/test-jwt-verification.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import * as crypto from "crypto";
import {
  accessTokenTTL,
  issueTokenPair,
  parseDuracion,
  refreshTokenTTL,
  signToken,
  verifyJWT,
} from "../src/shared/auth";

const b64url = (str: string) =>
  Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

function firmar(payload: any, secreto: string) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", secreto)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${header}.${body}.${sig}`;
}

const resultados: boolean[] = [];

function probar(nombre: string, obtenido: any, esperado: any) {
  const ok = obtenido === esperado;
  resultados.push(ok);
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre.padEnd(52)} ${String(obtenido)}`);
}

const USUARIO = { userId: "u-123", email: "a@b.com", role: "patient" };

console.log("=== duraciones ===");
probar("parseDuracion('60m')", parseDuracion("60m", 0), 3600);
probar("parseDuracion('30d')", parseDuracion("30d", 0), 2592000);
probar("parseDuracion('15m')", parseDuracion("15m", 0), 900);
probar("parseDuracion('900s')", parseDuracion("900s", 0), 900);
probar("parseDuracion('2h')", parseDuracion("2h", 0), 7200);
probar("parseDuracion(basura) usa el valor por defecto", parseDuracion("ayer", 42), 42);
probar("parseDuracion(vacio) usa el valor por defecto", parseDuracion(undefined, 42), 42);

console.log("\n=== configuracion activa ===");
console.log(`     access  TTL: ${accessTokenTTL()}s`);
console.log(`     refresh TTL: ${refreshTokenTTL()}s`);

console.log("\n=== tokens legitimos ===");
const par = issueTokenPair(USUARIO);
probar("el access token se acepta como access", verifyJWT(par.accessToken, "access") !== null, true);
probar("el refresh token se acepta como refresh", verifyJWT(par.refreshToken, "refresh") !== null, true);
probar("el access conserva el usuario", verifyJWT(par.accessToken, "access")?.sub, "u-123");
probar("el access conserva el rol", verifyJWT(par.accessToken, "access")?.role, "patient");

console.log("\n=== separacion de tipos ===");
probar("el refresh NO sirve para pedir datos", verifyJWT(par.refreshToken, "access") === null, true);
probar("el access NO sirve para renovar", verifyJWT(par.accessToken, "refresh") === null, true);

console.log("\n=== intentos de suplantacion ===");
const ahora = Math.floor(Date.now() / 1000);
probar(
  "payload fabricado con firma basura",
  verifyJWT(`${b64url('{"alg":"HS256"}')}.${b64url(`{"sub":"u-admin","role":"admin","typ":"access","exp":${ahora + 3600}}`)}.falsa`) === null,
  true,
);
probar(
  "firmado con otro secreto",
  verifyJWT(firmar({ sub: "u-admin", role: "admin", typ: "access", exp: ahora + 3600 }, "otro-secreto")) === null,
  true,
);
probar(
  "token sin firma (base64 plano)",
  verifyJWT(Buffer.from(JSON.stringify({ sub: "u-admin" })).toString("base64")) === null,
  true,
);
probar("un correo como token", verifyJWT("admin@docalink.com") === null, true);
probar(
  "payload alterado para subir de rol",
  (() => {
    const [h, , sig] = par.accessToken.split(".");
    const alterado = b64url(JSON.stringify({ sub: "u-123", role: "admin", typ: "access", exp: ahora + 3600 }));
    return verifyJWT(`${h}.${alterado}.${sig}`) === null;
  })(),
  true,
);
probar("token sin `typ` (formato viejo)", verifyJWT(firmar({ sub: "u-123", exp: ahora + 3600 }, process.env.JWT_SECRET || "local-dev-secret-key")) === null, true);

console.log("\n=== expiracion ===");
const originalAccess = process.env.JWT_ACCESS_TOKEN_EXPIRATION;
process.env.JWT_ACCESS_TOKEN_EXPIRATION = "1s";
const corto = signToken(USUARIO, "access");
process.env.JWT_ACCESS_TOKEN_EXPIRATION = originalAccess;
probar("un token de 1s es valido al emitirse", verifyJWT(corto, "access") !== null, true);

setTimeout(() => {
  probar("ese mismo token ya no vale pasados 2s", verifyJWT(corto, "access") === null, true);

  const fallos = resultados.filter((r) => !r).length;
  console.log(`\n=== ${resultados.length - fallos}/${resultados.length} correctos ===`);
  process.exit(fallos === 0 ? 0 : 1);
}, 2000);
