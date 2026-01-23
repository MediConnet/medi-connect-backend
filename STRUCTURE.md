# Estructura del Proyecto MediConnect Backend

```
medi-connect-backend/
├── src/                          # Código fuente TypeScript
│   ├── auth/
│   │   └── handler.ts            # Handler de autenticación (register, login, me, etc.)
│   ├── doctors/
│   │   └── handler.ts            # Handler de doctores (profile, appointments)
│   ├── admin/
│   │   └── handler.ts            # Handler de administración (dashboard, requests)
│   ├── supplies/
│   │   └── handler.ts           # Handler de suministros (stores, products) - público
│   ├── pharmacies/
│   │   └── handler.ts           # Handler de farmacias (placeholder)
│   ├── laboratories/
│   │   └── handler.ts           # Handler de laboratorios (placeholder)
│   ├── ambulances/
│   │   └── handler.ts           # Handler de ambulancias (placeholder)
│   └── shared/                   # Utilidades compartidas
│       ├── prisma.ts            # Singleton de Prisma Client
│       ├── response.ts          # Helpers de respuesta API
│       ├── logger.ts            # Logger estructurado
│       ├── auth.ts              # Helpers de autenticación (JWT, roles)
│       └── validators.ts        # Validadores Zod
│
├── prisma/
│   └── schema.prisma            # Schema de Prisma (User, DoctorProfile, etc.)
│
├── infrastructure/
│   └── cloudformation/
│       └── template.yaml        # Template CloudFormation completo
│
├── layers/                      # Lambda Layers
│   ├── prisma-layer/
│   │   └── nodejs/              # Se genera automáticamente con Prisma Client
│   └── utils-layer/
│       └── nodejs/              # Se copia desde dist/shared
│
├── scripts/
│   ├── package.js               # Script para crear zips de Lambdas y Layers
│   ├── upload.js                # Script para subir artifacts a S3
│   └── build-layers.js          # Script para construir layers
│
├── test/                        # Testing local
│   ├── events.ts                # Eventos mock de API Gateway
│   ├── invoke.ts                # Utilidad para invocar handlers
│   └── main.ts                  # Script principal de testing
│
├── artifacts/                    # Zips generados (no se commitea)
│   ├── lambdas/                 # Zips de funciones Lambda
│   └── layers/                  # Zips de layers
│
├── dist/                        # Código compilado TypeScript (no se commitea)
│
├── package.json                 # Dependencias y scripts npm
├── tsconfig.json                # Configuración TypeScript
├── .gitignore                   # Archivos ignorados por Git
├── .npmrc                       # Configuración npm
├── README.md                    # Documentación principal
└── STRUCTURE.md                 # Este archivo
```

## Flujo de Build y Deploy

1. **Build**: `npm run build`
   - Genera Prisma Client en `layers/prisma-layer/`
   - Compila TypeScript a `dist/`
   - Construye layers (copia shared a utils-layer)

2. **Package**: `npm run package`
   - Crea zips de cada Lambda desde `dist/<modulo>/`
   - Crea zips de layers desde `layers/`
   - Guarda todo en `artifacts/`

3. **Upload**: `npm run upload`
   - Sube zips a S3 bucket configurado

4. **Deploy**: `npm run deploy`
   - Ejecuta package + upload + CloudFormation deploy

## Módulos y Endpoints

### Auth (`/api/auth/*`)
- `POST /api/auth/register` - Público
- `POST /api/auth/login` - Público
- `POST /api/auth/refresh` - Público
- `GET /api/auth/me` - Protegido (JWT)
- `POST /api/auth/change-password` - Protegido (JWT)
- `POST /api/auth/forgot-password` - Público
- `POST /api/auth/reset-password` - Público

### Doctors (`/api/doctors/*`)
- `GET /api/doctors/profile` - Protegido (rol: DOCTOR)
- `PUT /api/doctors/profile` - Protegido (rol: DOCTOR)
- `GET /api/doctors/appointments` - Protegido (rol: DOCTOR)

### Admin (`/api/admin/*`)
- `GET /api/admin/dashboard/stats` - Protegido (rol: ADMIN)
- `GET /api/admin/requests` - Protegido (rol: ADMIN)
- `PUT /api/admin/requests/{id}/approve` - Protegido (rol: ADMIN)
- `PUT /api/admin/requests/{id}/reject` - Protegido (rol: ADMIN)

### Supplies (`/api/supplies/*`)
- `GET /api/supplies/stores` - Público
- `GET /api/supplies/stores/{id}` - Público
- `GET /api/supplies/products` - Público

## Variables de Entorno

- `DATABASE_URL` - Connection string de Neon PostgreSQL (con SSL)
- `STAGE` - Ambiente (dev, staging, prod)
- `AWS_REGION` - Región de AWS
- `COGNITO_USER_POOL_ID` - ID del User Pool (se obtiene del deploy)
- `COGNITO_USER_POOL_CLIENT_ID` - ID del Client (se obtiene del deploy)

## Notas Importantes

1. **Prisma Client**: Se genera en `layers/prisma-layer/nodejs/node_modules/.prisma/client` según configuración en `schema.prisma`

2. **Layers**: 
   - `prisma-layer`: Contiene Prisma Client generado
   - `utils-layer`: Contiene código compilado de `src/shared/`

3. **Autenticación**: 
   - API Gateway valida JWT antes de llegar a Lambda
   - Lambda extrae `sub` del JWT y busca User en DB para obtener rol

4. **Base de Datos**: 
   - Neon PostgreSQL con SSL habilitado
   - Connection pooling recomendado para producción
