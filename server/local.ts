import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || process.env.CORS_ORIGIN || '*',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging para todas las requests
app.use((req, res, next) => {
  console.log(`\n🌐 [INCOMING] ${req.method} ${req.originalUrl}`);
  console.log(`🔍 [INCOMING] Todos los headers:`, Object.keys(req.headers).join(', '));
  const authHeader = Array.isArray(req.headers.authorization) 
    ? req.headers.authorization[0] 
    : req.headers.authorization;
  const authHeaderUpper = Array.isArray(req.headers.Authorization)
    ? req.headers.Authorization[0]
    : req.headers.Authorization;
  
  console.log(`🔍 [INCOMING] Headers específicos:`, {
    authorization: authHeader ? `${authHeader.substring(0, 50)}...` : 'Ausente',
    Authorization: authHeaderUpper ? `${authHeaderUpper.substring(0, 50)}...` : 'Ausente',
    'content-type': req.headers['content-type'],
    origin: req.headers.origin,
  });
  next();
});

// Helper para convertir Express request a API Gateway event
function createApiGatewayEvent(
  req: express.Request,
  path: string
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${req.method} ${path}`,
    rawPath: path,
    rawQueryString: new URLSearchParams(req.query as any).toString(),
    headers: {
      ...req.headers as Record<string, string>,
      'content-type': req.headers['content-type'] || 'application/json',
    },
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: 'localhost',
      domainPrefix: 'local',
      http: {
        method: req.method,
        path: path,
        protocol: 'HTTP/1.1',
        sourceIp: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
      },
      requestId: `local-${Date.now()}`,
      routeKey: `${req.method} ${path}`,
      stage: 'local',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: req.body ? JSON.stringify(req.body) : undefined,
    isBase64Encoded: false,
    queryStringParameters: Object.keys(req.query).length > 0
      ? req.query as Record<string, string>
      : undefined,
  };
}

// Helper para manejar respuestas de Lambda
async function handleLambdaResponse(
  handler: (event: APIGatewayProxyEventV2) => Promise<any>,
  req: express.Request,
  res: express.Response,
  path: string
) {
  const startTime = Date.now();
  console.log(`\n📥 [REQUEST] ${req.method} ${path} - Iniciando...`);
  console.log(`🔍 [REQUEST] Headers recibidos:`, {
    authorization: req.headers.authorization ? 'Presente' : 'Ausente',
    Authorization: req.headers.Authorization ? 'Presente' : 'Ausente',
    'content-type': req.headers['content-type'],
    origin: req.headers.origin,
  });
  
  try {
    const event = createApiGatewayEvent(req, path);
    console.log(`🔍 [REQUEST] Event creado. Headers en event:`, {
      authorization: event.headers.authorization ? 'Presente' : 'Ausente',
      Authorization: event.headers.Authorization ? 'Presente' : 'Ausente',
    });
    
    const result = await handler(event);
    const duration = Date.now() - startTime;
    console.log(`✅ [REQUEST] ${req.method} ${path} - Completado en ${duration}ms - Status: ${result.statusCode}`);

    // Lambda response ya tiene statusCode y headers
    res.status(result.statusCode || 200);

    // Copiar headers de la respuesta Lambda
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }

    // Enviar body
    if (result.body) {
      res.send(result.body);
    } else {
      res.end();
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ [REQUEST] ${req.method} ${path} - Error después de ${duration}ms:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
}

// Importar handlers
import { handler as authHandler } from '../src/auth/handler';
import { handler as doctorsHandler } from '../src/doctors/handler';
import { handler as adminHandler } from '../src/admin/handler';
import { handler as suppliesHandler } from '../src/supplies/handler';

// Importar otros handlers si existen
let pharmaciesHandler: any;
let laboratoriesHandler: any;
let ambulancesHandler: any;

try {
  pharmaciesHandler = require('../src/pharmacies/handler').handler;
} catch (e) {
  // Handler no existe o tiene errores
}

try {
  laboratoriesHandler = require('../src/laboratories/handler').handler;
} catch (e) {
  // Handler no existe o tiene errores
}

try {
  ambulancesHandler = require('../src/ambulances/handler').handler;
} catch (e) {
  // Handler no existe o tiene errores
}

// Routes - Auth
app.use('/api/auth', async (req, res) => {
  // Usar originalUrl para obtener el path completo
  const path = req.originalUrl.split('?')[0]; // Remover query string si existe
  await handleLambdaResponse(authHandler, req, res, path);
});

// Routes - Doctors
app.use('/api/doctors', async (req, res) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(doctorsHandler, req, res, path);
});

// Routes - Admin
app.use('/api/admin', async (req, res) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(adminHandler, req, res, path);
});

// Routes - Providers (registro de proveedores)
app.use('/api/providers', async (req, res) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(adminHandler, req, res, path);
});

// Routes - Supplies
app.use('/api/supplies', async (req, res) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(suppliesHandler, req, res, path);
});

// Routes - Pharmacies (si existe)
if (pharmaciesHandler) {
  app.use('/api/pharmacies', async (req, res) => {
    const path = req.originalUrl.split('?')[0];
    await handleLambdaResponse(pharmaciesHandler, req, res, path);
  });
}

// Routes - Laboratories (si existe)
if (laboratoriesHandler) {
  app.use('/api/laboratories', async (req, res) => {
    const path = req.originalUrl.split('?')[0];
    await handleLambdaResponse(laboratoriesHandler, req, res, path);
  });
}

// Routes - Ambulances (si existe)
if (ambulancesHandler) {
  app.use('/api/ambulances', async (req, res) => {
    const path = req.originalUrl.split('?')[0];
    await handleLambdaResponse(ambulancesHandler, req, res, path);
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 MediConnect Backend - Local Development Server`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}/api`);
  
  // Verificar conexión a la base de datos
  try {
    const { getPrismaClient } = await import('../src/shared/prisma');
    const prisma = getPrismaClient();
    await prisma.$connect();
    console.log(`✅ Conexión a la base de datos exitosa`);
  } catch (error: any) {
    console.error(`❌ Error al conectar a la base de datos:`, error.message);
    console.log(`⚠️  El servidor está corriendo pero la base de datos no está disponible`);
  }
  
  console.log(`\n📋 Available endpoints:`);
  console.log(`   - POST   /api/auth/register`);
  console.log(`   - POST   /api/auth/login`);
  console.log(`   - GET    /api/auth/me`);
  console.log(`   - GET    /api/doctors/profile`);
  console.log(`   - GET    /api/doctors/dashboard`);
  console.log(`   - GET    /api/doctors/appointments`);
  console.log(`   - POST   /api/providers/register`);
  console.log(`   - GET    /api/admin/dashboard/stats`);
  console.log(`   - GET    /api/admin/requests`);
  console.log(`   - GET    /api/admin/ad-requests`);
  console.log(`   - GET    /api/admin/provider-requests`);
  console.log(`   - GET    /api/admin/activity`);
  console.log(`   - GET    /api/admin/history`);
  console.log(`   - GET    /api/admin/rejected-services`);
  console.log(`   - PUT    /api/admin/requests/:id/approve`);
  console.log(`   - PUT    /api/admin/requests/:id/reject`);
  console.log(`   - PUT    /api/admin/ad-requests/:id/approve`);
  console.log(`   - PUT    /api/admin/ad-requests/:id/reject`);
  console.log(`   - GET    /api/supplies/stores`);
  console.log(`\n💡 Make sure your .env file is configured with:`);
  console.log(`   - DATABASE_URL`);
  console.log(`   - AWS_REGION`);
  console.log(`   - COGNITO_USER_POOL_ID (optional for local dev)`);
  console.log(`   - CORS_ORIGINS=http://localhost:5173,http://localhost:3000`);
  console.log(`\n🔑 Credenciales de prueba:`);
  console.log(`   - Admin: admin@medicones.com / admin123`);
  console.log(`   - Doctor: doctor@medicones.com / doctor123`);
  console.log(`   - Farmacia: farmacia@medicones.com / farmacia123`);
});
