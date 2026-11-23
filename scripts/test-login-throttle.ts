/**
 * Prueba el freno de intentos de inicio de sesion. No toca la base ni la red.
 *
 *   npx ts-node scripts/test-login-throttle.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import {
  comprobarIntentosLogin,
  limpiarBloqueoPorCorreo,
  limpiarIntentosLogin,
  obtenerIpCliente,
  registrarIntentoFallido,
} from "../src/shared/security";

const MAX = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const MAX_IP = Number(process.env.LOGIN_MAX_ATTEMPTS_PER_IP || 20);

const resultados: boolean[] = [];
function probar(nombre: string, obtenido: any, esperado: any) {
  const ok = obtenido === esperado;
  resultados.push(ok);
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre.padEnd(56)} ${String(obtenido)}`);
}

const VICTIMA = "victima@docalink.com";
const OTRO = "otro@docalink.com";
const IP_A = "190.0.0.1";
const IP_B = "190.0.0.2";

console.log(`Config: ${MAX} fallos por cuenta+IP | ${MAX_IP} por IP\n`);

console.log("=== bloqueo tras varios fallos ===");
for (let i = 1; i < MAX; i++) {
  registrarIntentoFallido(VICTIMA, IP_A);
  probar(`tras ${i} fallo(s) todavia puede intentar`, comprobarIntentosLogin(VICTIMA, IP_A).bloqueado, false);
}
registrarIntentoFallido(VICTIMA, IP_A);
probar(`tras ${MAX} fallos queda bloqueado`, comprobarIntentosLogin(VICTIMA, IP_A).bloqueado, true);
const espera = comprobarIntentosLogin(VICTIMA, IP_A).esperaSegundos;
probar("informa cuanto falta (segundos > 0)", espera > 0, true);

console.log("\n=== nadie puede bloquear la cuenta de otro ===");
probar(
  "la misma cuenta desde OTRA IP sigue pudiendo entrar",
  comprobarIntentosLogin(VICTIMA, IP_B).bloqueado,
  false,
);

console.log("\n=== el acierto borra el contador ===");
limpiarIntentosLogin(VICTIMA, IP_A);
probar("tras entrar bien ya no esta bloqueado", comprobarIntentosLogin(VICTIMA, IP_A).bloqueado, false);

console.log("\n=== tope por IP, probando muchas cuentas ===");
const IP_C = "190.0.0.9";
for (let i = 0; i < MAX_IP; i++) {
  // cada fallo contra una cuenta distinta: el limite por cuenta nunca se alcanza
  registrarIntentoFallido(`cuenta${i}@docalink.com`, IP_C);
}
probar(
  "una cuenta nueva desde esa IP ya esta frenada",
  comprobarIntentosLogin("recien@docalink.com", IP_C).bloqueado,
  true,
);
probar(
  "desde otra IP esa cuenta entra sin problema",
  comprobarIntentosLogin("recien@docalink.com", "190.0.0.77").bloqueado,
  false,
);

console.log("\n=== lectura de la IP del cliente ===");
probar(
  "toma la ULTIMA de x-forwarded-for (la que puso el proxy)",
  obtenerIpCliente({ headers: { "x-forwarded-for": "1.2.3.4, 201.1.1.1" } }),
  "201.1.1.1",
);
probar(
  "una cabecera falsificada por el cliente no manda",
  obtenerIpCliente({ headers: { "x-forwarded-for": "9.9.9.9, 201.1.1.1" } }),
  "201.1.1.1",
);
probar(
  "cae a sourceIp si no hay cabecera",
  obtenerIpCliente({ headers: {}, requestContext: { http: { sourceIp: "8.8.8.8" } } }),
  "8.8.8.8",
);
probar("sin datos devuelve 'desconocida'", obtenerIpCliente({}), "desconocida");

console.log("\n=== el correo se normaliza ===");
limpiarIntentosLogin(OTRO, IP_A);
for (let i = 0; i < MAX; i++) registrarIntentoFallido(OTRO.toUpperCase(), IP_A);
probar(
  "MAYUSCULAS y minusculas son la misma cuenta",
  comprobarIntentosLogin(OTRO, IP_A).bloqueado,
  true,
);

console.log("\n=== recuperar la contrasena libera el bloqueo ===");
const BLOQUEADO = "bloqueado@docalink.com";
const IP_X = "181.0.0.5";
const IP_Y = "181.0.0.6";
for (let i = 0; i < MAX; i++) registrarIntentoFallido(BLOQUEADO, IP_X);
for (let i = 0; i < MAX; i++) registrarIntentoFallido(BLOQUEADO, IP_Y);
probar("la cuenta queda bloqueada desde su IP", comprobarIntentosLogin(BLOQUEADO, IP_X).bloqueado, true);

const liberados = limpiarBloqueoPorCorreo(BLOQUEADO);
probar("se liberan los bloqueos de todas sus IPs", liberados >= 2, true);
probar("ya puede intentar desde la IP original", comprobarIntentosLogin(BLOQUEADO, IP_X).bloqueado, false);
probar("y desde la otra IP tambien", comprobarIntentosLogin(BLOQUEADO, IP_Y).bloqueado, false);

const fallos = resultados.filter((r) => !r).length;
console.log(`\n=== ${resultados.length - fallos}/${resultados.length} correctos ===`);
process.exit(fallos === 0 ? 0 : 1);
