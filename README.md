# MediConnect Backend - Serverless Architecture

Backend serverless para MediConnect construido con AWS Lambda, API Gateway, Cognito y Neon PostgreSQL.

**✅ Compatible con Web Apps y Mobile Apps (iOS/Android)** - Un solo backend para todos tus clientes.

## 🏗️ Arquitectura

- **Runtime**: Node.js 22 + TypeScript
- **Compute**: AWS Lambda (1 módulo = 1 handler)
- **API**: API Gateway HTTP API v2
- **Auth**: AWS Cognito User Pool (JWT)
- **Database**: Neon PostgreSQL (conexión SSL)
- **ORM**: Prisma
- **Validación**: Zod
- **IaC**: CloudFormation

## 📁 Estructura del Proyecto

```
medi-connect-backend/
├── src/
│   ├── auth/
│   │   └── handler.ts
│   ├── doctors/
│   │   └── handler.ts
│   ├── pharmacies/
│   │   └── handler.ts
│   ├── laboratories/
│   │   └── handler.ts
│   ├── ambulances/
│   │   └── handler.ts
│   ├── supplies/
│   │   └── handler.ts
│   ├── admin/
│   │   └── handler.ts
│   └── shared/
│       ├── prisma.ts
│       ├── response.ts
│       ├── logger.ts
│       ├── auth.ts
│       └── validators.ts
├── prisma/
│   └── schema.prisma
├── infrastructure/
│   └── cloudformation/
│       └── template.yaml
├── layers/
│   ├── prisma-layer/
│   └── utils-layer/
├── scripts/
│   ├── package.js
│   └── upload.js
├── test/
│   ├── events.ts
│   ├── invoke.ts
│   └── main.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## 🚀 Setup Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
# Editar .env con tus credenciales de Neon PostgreSQL
```

### 3. Configurar Prisma

```bash
# Generar Prisma Client
npm run prisma:generate

# Ejecutar migraciones (primera vez)
npm run prisma:migrate
```

### 4. Build

```bash
npm run build
```

## 📦 Deployment

### 1. Package (crear zips de Lambdas y Layers)

```bash
npm run package
```

### 2. Upload a S3

```bash
npm run upload
```

### 3. Deploy con CloudFormation

```bash
npm run deploy
```

O manualmente:

```bash
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/template.yaml \
  --stack-name medi-connect-backend \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Stage=dev
```

## 🧪 Testing Local

```bash
# Modo desarrollo con watch (recarga automática)
npm run dev

# Ejecutar tests una vez
npm run test
```

Esto ejecutará `test/main.ts` que invoca los handlers localmente con eventos mock.

## 📝 Endpoints

### Auth (Públicos/Protegidos)
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Obtener usuario actual (protegido)
- `POST /api/auth/change-password` - Cambiar contraseña (protegido)
- `POST /api/auth/forgot-password` - Solicitar reset de contraseña
- `POST /api/auth/reset-password` - Reset de contraseña

### Doctors (Protegido - rol doctor)
- `GET /api/doctors/profile` - Obtener perfil
- `PUT /api/doctors/profile` - Actualizar perfil
- `GET /api/doctors/appointments` - Listar citas

### Admin (Protegido - rol admin)
- `GET /api/admin/dashboard/stats` - Estadísticas del dashboard
- `GET /api/admin/requests` - Listar solicitudes
- `PUT /api/admin/requests/{id}/approve` - Aprobar solicitud
- `PUT /api/admin/requests/{id}/reject` - Rechazar solicitud

### Supplies (Público)
- `GET /api/supplies/stores` - Listar tiendas
- `GET /api/supplies/stores/{id}` - Obtener tienda
- `GET /api/supplies/products` - Listar productos

## 🔐 Autenticación

Las rutas protegidas requieren un JWT válido de Cognito en el header:

```
Authorization: Bearer <jwt-token>
```

El handler extrae el `sub` (cognitoUserId) del JWT y busca el usuario en la base de datos para obtener el rol y permisos.

**Funciona igual desde Web Apps y Mobile Apps** - Mismo JWT, mismos endpoints, misma autenticación.

## 📱🌐 Compatibilidad Web y Mobile

Este backend está **diseñado para funcionar perfectamente** tanto desde una aplicación web como desde aplicaciones móviles (iOS/Android).

### Características de Compatibilidad

- ✅ **CORS Multi-Origen**: Configurado para soportar múltiples dominios web
- ✅ **OPTIONS Support**: Manejo automático de preflight requests (necesario para web)
- ✅ **JWT Universal**: Autenticación Cognito funciona igual en web y mobile
- ✅ **Respuestas JSON Estándar**: Formato consistente para ambos clientes
- ✅ **Headers Compatibles**: CORS headers para web, ignorados por mobile (como debe ser)

### Configuración

**Desarrollo**:
```bash
CORS_ORIGIN=*  # Permite todos los orígenes
# O múltiples orígenes
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Producción** (CloudFormation):
```yaml
WebOrigin: https://tu-web-app.com
MobileAppOrigin: *  # Apps móviles no necesitan CORS específico
```

📖 **Ver [WEB_AND_MOBILE.md](./WEB_AND_MOBILE.md) para documentación completa de compatibilidad.**

### 🎯 Expo + React Native

Si estás usando **Expo y React Native** (como tu frontend), el backend está completamente optimizado para ti:

- ✅ **Sin configuración CORS especial** - Las apps móviles no tienen restricciones CORS
- ✅ **JWT Authentication** - Tokens Cognito funcionan perfectamente
- ✅ **HTTPS por defecto** - API Gateway usa HTTPS automáticamente
- ✅ **Respuestas JSON estándar** - Formato consistente y fácil de usar

📖 **Ver [EXPO_REACT_NATIVE.md](./EXPO_REACT_NATIVE.md) para guía completa de integración con Expo.**

## 📊 Base de Datos

### Neon PostgreSQL

- Usa `DATABASE_URL` con SSL habilitado (`?sslmode=require`)
- Prisma Client se genera en `layers/prisma-layer/nodejs/node_modules/@prisma/client`
- Se recomienda usar connection pooling de Neon para producción

### Modelos Principales

- `User` - Usuarios del sistema
- `DoctorProfile` - Perfiles de doctores
- `Appointment` - Citas médicas
- `ProviderRequest` - Solicitudes de proveedores (farmacias, laboratorios, ambulancias)
- `AdRequest` - Solicitudes de anuncios

## 🏷️ Lambda Layers

### prisma-layer
Contiene el Prisma Client generado para reutilización entre Lambdas.

### utils-layer
Contiene utilidades compartidas:
- Logger
- Response helpers
- Auth helpers
- Validators (Zod)

## 📚 Scripts Disponibles

- `npm run build` - Compilar TypeScript y generar Prisma Client
- `npm run package` - Crear zips de Lambdas y Layers
- `npm run upload` - Subir artifacts a S3
- `npm run deploy` - Package + Upload + Deploy CloudFormation
- `npm run dev` - Ejecutar en modo desarrollo con watch
- `npm run test` - Ejecutar tests locales
- `npm run prisma:generate` - Generar Prisma Client
- `npm run prisma:migrate` - Ejecutar migraciones
- `npm run prisma:studio` - Abrir Prisma Studio

## 🔧 Configuración AWS

Asegúrate de tener configurado:
- AWS CLI con credenciales válidas
- Permisos para: Lambda, API Gateway, Cognito, CloudFormation, S3, IAM

## 📖 Notas Importantes

1. **Connection Pooling**: Para producción, considera usar el connection pooling de Neon para optimizar conexiones a la base de datos.

2. **Variables de Entorno**: `DATABASE_URL` se marca como `NoEcho` en CloudFormation por seguridad.

3. **Cold Starts**: Considera usar Provisioned Concurrency para Lambdas críticas en producción.

4. **Logs**: Los logs de Lambda se envían automáticamente a CloudWatch.

5. **CORS**: Configura CORS en API Gateway según tus necesidades de frontend.
