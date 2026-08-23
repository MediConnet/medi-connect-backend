# DocaLink — Backend

API del proyecto DocaLink (antes MediConnect). Node.js + TypeScript + Express + Prisma sobre PostgreSQL, con notificaciones push (Expo), correo (Resend), pagos (Nuvei/Paymentez) y tiempo real (Socket.IO).

Diseñado con forma de handlers estilo Lambda (`(event) => APIGatewayProxyResult`), pero corriendo hoy como servidor Express persistente en Render (`index.ts`). También existe soporte para desplegarlo como AWS Lambda vía `serverless.yml`.

## Requisitos

- Node.js 18+
- Acceso a la base de datos PostgreSQL del proyecto (`DATABASE_URL`)

## Instalación

```bash
npm install
```

## Variables de entorno

Crear un archivo `.env` en la raíz con:

```
DATABASE_URL=
PAYPHONE_TOKEN=
PAYPHONE_STORE_ID=
NUVEI_BASE_URL=
NUVEI_SERVER_APP_CODE=
NUVEI_SERVER_APP_KEY=
NUVEI_CLIENT_APP_CODE=
NUVEI_CLIENT_APP_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
FRONTEND_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
```

Pide los valores reales a otro miembro del equipo — nunca se deben commitear.

## Levantar en local

```bash
npm run dev
```

Levanta el servidor Express local (`server/local.ts`) con recarga automática (nodemon), sirviendo todas las rutas bajo `/api`.

## Base de datos (Prisma)

```bash
npm run prisma:generate   # regenerar el cliente de Prisma tras tocar el schema
npm run prisma:migrate    # crear/aplicar una migración en desarrollo
npm run prisma:studio     # explorador visual de la base de datos
```

⚠️ La base de datos es la de producción/desarrollo compartida del equipo. No correr `prisma migrate reset` ni nada destructivo sin coordinar antes — para cambios puntuales sobre una base con drift, se prefiere escribir el SQL de la migración a mano y aplicarlo con `prisma db execute` + `prisma migrate resolve --applied`.

## Build y deploy

El deploy productivo corre en **Render**, a partir de la rama `main`:

```bash
npm run build:render
```

También existe un flujo alterno para desplegar como AWS Lambda (API Gateway + CloudFormation):

```bash
npm run build     # prisma generate + tsc + build de layers
npm run deploy     # empaqueta, sube y despliega el stack de CloudFormation
```

Si se agrega una ruta nueva, hay que registrarla en dos lugares para que funcione en ambos entornos: el dispatcher interno (`src/*/handler.ts`) y `serverless.yml` (para el path de Lambda).

## Estructura del proyecto

El código está organizado por dominio dentro de `src/`, no por capa técnica:

- `admin/` — panel de administración (aprobaciones, pagos, comisiones, usuarios, servicios)
- `auth/` — registro, login, sesión
- `patients/` — citas, favoritos, historial médico, recordatorios (paciente)
- `doctors/`, `clinics/`, `association/`, `supplies/`, `laboratories/` — paneles y flujos por tipo de proveedor
- `payments/` — cobro con tarjeta (Nuvei), webhooks, reembolsos
- `ads/` — anuncios promocionales de proveedores
- `public/` — endpoints públicos sin autenticación (listados, búsqueda)
- `jobs/` — cron jobs (recordatorios, expiración de pagos pendientes, destacados)
- `shared/` — utilidades comunes: email, notificaciones push, Prisma client, respuestas HTTP, constantes

## Tests / scripts puntuales

Los scripts de diagnóstico o corrección puntual de datos se escriben en `scratch/` y deben borrarse una vez cumplen su propósito — no es código permanente del proyecto, aunque hoy queden algunos sin limpiar. `test/` contiene scripts de prueba más formales (`npm run test:*`).
