/**
 * Comprueba que revocar una sesion corta el acceso de verdad.
 *
 * Crea un usuario de prueba, inicia sesion, renueva, revoca y vuelve a
 * intentar. Al terminar borra todo lo que creo.
 *
 *   npx ts-node scripts/test-session-revocation.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { getPrismaClient } from "../src/shared/prisma";
import { handler as authHandler } from "../src/auth/handler";

const CORREO = `prueba-revocacion-${Date.now()}@docalink.test`;
const CLAVE = "ClaveDePrueba123!";

function evento(method: string, path: string, body?: any, token?: string): any {
  return {
    rawPath: path,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: {},
    requestContext: { http: { method, path, sourceIp: "127.0.0.1" } },
  };
}

const resultados: boolean[] = [];
function probar(nombre: string, ok: boolean, detalle = "") {
  resultados.push(ok);
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre.padEnd(52)} ${detalle}`);
}

const cuerpo = (res: any) => {
  try {
    const d = JSON.parse(res.body);
    return d?.data ?? d;
  } catch {
    return {};
  }
};

async function main() {
  const prisma = getPrismaClient();
  let userId = "";

  try {
    // --- preparar usuario ---
    const user = await prisma.users.create({
      data: {
        id: randomUUID(),
        email: CORREO,
        password_hash: await bcrypt.hash(CLAVE, 10),
        role: "patient",
        is_active: true,
      },
    });
    userId = user.id;
    await prisma.patients.create({
      data: { id: randomUUID(), user_id: user.id, full_name: "Prueba Revocacion" },
    });
    console.log(`Usuario de prueba: ${CORREO}\n`);

    // --- 1. login ---
    const resLogin = await authHandler(
      evento("POST", "/api/auth/login", { email: CORREO, password: CLAVE }),
    );
    const login = cuerpo(resLogin);
    probar("el login entrega access y refresh", !!login.accessToken && !!login.refreshToken);

    const sesiones = await prisma.sessions.count({ where: { user_id: userId, revoked_at: null } });
    probar("el login deja una sesion viva en la base", sesiones === 1, `sesiones: ${sesiones}`);

    // --- 2. renovar con la sesion viva ---
    const resRefresh = await authHandler(
      evento("POST", "/api/auth/refresh", { refreshToken: login.refreshToken }),
    );
    const refrescado = cuerpo(resRefresh);
    probar("se puede renovar con la sesion viva", resRefresh.statusCode === 200 && !!refrescado.accessToken);
    probar("la renovacion rota el refresh token", refrescado.refreshToken !== login.refreshToken);

    // --- 3. el refresh viejo ya no sirve (rotacion) ---
    const resViejo = await authHandler(
      evento("POST", "/api/auth/refresh", { refreshToken: login.refreshToken }),
    );
    probar("el refresh anterior deja de servir", resViejo.statusCode === 401, `status: ${resViejo.statusCode}`);

    // --- 4. revocar (como hace resetPassword / changePassword) ---
    await prisma.sessions.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    const resRevocado = await authHandler(
      evento("POST", "/api/auth/refresh", { refreshToken: refrescado.refreshToken }),
    );
    probar(
      "tras revocar, el refresh vigente NO sirve",
      resRevocado.statusCode === 401,
      `status: ${resRevocado.statusCode}`,
    );

    // --- 5. volver a entrar crea una sesion nueva y funciona ---
    const resLogin2 = await authHandler(
      evento("POST", "/api/auth/login", { email: CORREO, password: CLAVE }),
    );
    const login2 = cuerpo(resLogin2);
    const resRefresh2 = await authHandler(
      evento("POST", "/api/auth/refresh", { refreshToken: login2.refreshToken }),
    );
    probar("volver a iniciar sesion restablece el acceso", resRefresh2.statusCode === 200);

    // --- 6. logout cierra esa sesion ---
    await authHandler(
      evento("POST", "/api/auth/logout", { refreshToken: cuerpo(resRefresh2).refreshToken }),
    );
    const resTrasLogout = await authHandler(
      evento("POST", "/api/auth/refresh", { refreshToken: cuerpo(resRefresh2).refreshToken }),
    );
    probar("tras cerrar sesion, el refresh no sirve", resTrasLogout.statusCode === 401);

    // --- 7. el token nunca se guarda en claro ---
    const filas = await prisma.sessions.findMany({
      where: { user_id: userId },
      select: { token: true },
    });
    const enClaro = filas.some((f) => f.token.includes(".") || f.token.length !== 64);
    probar("la sesion guarda un hash, no el token", !enClaro);
  } finally {
    if (userId) {
      await prisma.sessions.deleteMany({ where: { user_id: userId } });
      await prisma.patients.deleteMany({ where: { user_id: userId } });
      await prisma.users.delete({ where: { id: userId } }).catch(() => {});
      console.log("\n(usuario de prueba eliminado)");
    }
  }

  const fallos = resultados.filter((r) => !r).length;
  console.log(`\n=== ${resultados.length - fallos}/${resultados.length} correctos ===`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
