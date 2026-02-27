import { APIGatewayProxyEventV2 } from 'aws-lambda';
import cors from 'cors';
import * as dotenv from 'dotenv';
import express from 'express';
import { execSync } from 'child_process';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
    
    // Log para debugging
    console.log('🔍 [CORS] Origin recibido:', origin);
    console.log('🔍 [CORS] Orígenes permitidos:', allowedOrigins);
    console.log('🔍 [CORS] CORS_ORIGINS env:', process.env.CORS_ORIGINS);
    
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ [CORS] Request sin origin permitido');
      return callback(null, true);
    }
    
    // Si '*' está permitido o el origen está en la lista, permitirlo
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      console.log(`✅ [CORS] Origin permitido: ${origin}`);
      return callback(null, true);
    }
    
    // Rechazar el origen
    console.log(`❌ [CORS] Origin rechazado: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
}));
app.use(express.json({ limit: '10mb' })); // ⭐ Aumentar límite para subida de imágenes
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // ⭐ Aumentar límite para subida de imágenes

// Middleware de logging para todas las requests
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
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
      'origin': Array.isArray(req.headers.origin) ? req.headers.origin[0] : (req.headers.origin || req.headers.Origin || ''),
      'Origin': Array.isArray(req.headers.origin) ? req.headers.origin[0] : (req.headers.origin || req.headers.Origin || ''),
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
  
  // Validar que el handler sea una función
  if (!handler || typeof handler !== 'function') {
    const duration = Date.now() - startTime;
    console.error(`❌ [REQUEST] ${req.method} ${path} - Error después de ${duration}ms: handler is not a function`);
    res.status(500).json({
      success: false,
      message: 'Handler not available. Check server logs for details.',
    });
    return;
  }
  
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

    // Copiar headers de la respuesta Lambda (asegurarse de incluir CORS)
    if (result.headers) {
      console.log('🔍 [RESPONSE] Headers de Lambda:', Object.keys(result.headers));
      console.log('🔍 [RESPONSE] Access-Control-Allow-Origin:', result.headers['Access-Control-Allow-Origin']);
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    } else {
      // Si no hay headers, asegurar que CORS esté configurado
      const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : (req.headers.origin || req.headers.Origin || '*');
      const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
      
      console.log('🔍 [RESPONSE] No hay headers en Lambda, configurando CORS manualmente');
      console.log('🔍 [RESPONSE] Origin:', origin);
      
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin as string)) {
        res.setHeader('Access-Control-Allow-Origin', origin as string);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept');
        console.log('✅ [RESPONSE] Headers CORS configurados:', origin);
      }
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
import { handler as adminHandler } from './src/admin/handler';
import { handler as adsHandler } from './src/ads/handler';
import { handler as authHandler } from './src/auth/handler';
import { handler as doctorsHandler } from './src/doctors/handler';
import { handler as suppliesHandler } from './src/supplies/handler';
import { handler as pharmaciesHandler } from './src/pharmacies/handler';
import { handler as publicHandler } from './src/public/handler';
import { handler as homeHandler } from './src/home/handler';

// Importar otros handlers si existen
let laboratoriesHandler: any;

try {
  laboratoriesHandler = require('./src/laboratories/handler').handler;
} catch (e) {
  // Handler no existe o tiene errores
}

let patientsHandler: any;
try {
  patientsHandler = require('./src/patients/handler').handler;
  if (!patientsHandler) {
    console.error('❌ [PATIENTS] Handler exportado pero es undefined');
  } else {
    console.log('✅ [PATIENTS] Handler de pacientes cargado correctamente');
  }
} catch (e: any) {
  console.error('❌ [PATIENTS] Error al cargar handler:', e.message);
  console.error('❌ [PATIENTS] Stack:', e.stack);
}

let clinicsHandler: any;
try {
  clinicsHandler = require('./src/clinics/handler').handler;
  console.log('✅ [CLINICS] Handler de clínicas cargado correctamente');
} catch (e: any) {
  console.error('❌ [CLINICS] Error al cargar handler de clínicas:', e.message);
  console.error('❌ [CLINICS] Stack:', e.stack);
}

// Routes - Auth
app.use('/api/auth', async (req: express.Request, res: express.Response) => {
  // Usar originalUrl para obtener el path completo
  const path = req.originalUrl.split('?')[0]; // Remover query string si existe
  await handleLambdaResponse(authHandler, req, res, path);
});

// Routes - Public (doctors, pharmacies, etc.)
console.log('✅ [PUBLIC] Registrando rutas públicas en /api/public');
app.use('/api/public', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  console.log(`🔍 [PUBLIC ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(publicHandler, req, res, path);
});

// Routes - Doctors
app.use('/api/doctors', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(doctorsHandler, req, res, path);
});

app.use('/api/specialties', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0]; 
  await handleLambdaResponse(doctorsHandler, req, res, path);
});

// Routes - Admin
app.use('/api/admin', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(adminHandler, req, res, path);
});

// Routes - Providers (registro de proveedores)
app.use('/api/providers', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(adminHandler, req, res, path);
});

// Routes - Ads (Anuncios)
app.use('/api/ads', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(adsHandler, req, res, path);
});

// Routes - Home
app.use('/api/home', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(homeHandler, req, res, path);
});

// Routes - Supplies
app.use('/api/supplies', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(suppliesHandler, req, res, path);
});

// Routes - Pharmacy Chains (público)
app.use('/api/pharmacy-chains', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(pharmaciesHandler, req, res, path);
});

// Routes - Patients
if (patientsHandler) {
  console.log('✅ [PATIENTS] Registrando rutas de pacientes en /api/patients');
  app.use('/api/patients', async (req: express.Request, res: express.Response) => {
    const path = req.originalUrl.split('?')[0];
    console.log(`🔍 [PATIENTS ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
    await handleLambdaResponse(patientsHandler, req, res, path);
  });
} else {
  console.error('❌ [PATIENTS] Handler de pacientes no disponible - Las rutas no se registrarán');
  app.use('/api/patients', (req: express.Request, res: express.Response) => {
    console.error(`❌ [PATIENTS] Petición recibida pero handler no disponible: ${req.method} ${req.originalUrl}`);
    res.status(500).json({ 
      success: false, 
      message: 'Patients handler not available. Check server logs.' 
    });
  });
}

// Routes - Pharmacies
console.log('✅ [PHARMACIES] Registrando rutas de farmacias en /api/pharmacies');
app.use('/api/pharmacies', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  console.log(`🔍 [PHARMACIES ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(pharmaciesHandler, req, res, path);
});

// Routes - Laboratories (si existe)
if (laboratoriesHandler) {
  app.use('/api/laboratories', async (req: express.Request, res: express.Response) => {
    const path = req.originalUrl.split('?')[0];
    await handleLambdaResponse(laboratoriesHandler, req, res, path);
  });
}

// Routes - Ambulances (ahora manejadas por publicHandler)
console.log('✅ [AMBULANCES] Registrando rutas de ambulancias en /api/ambulances (usando publicHandler)');
app.use('/api/ambulances', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  console.log(`🔍 [AMBULANCES ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(publicHandler, req, res, path);
});

// Routes - Clinics (si existe)
if (clinicsHandler) {
  console.log('✅ [CLINICS] Registrando rutas de clínicas');
  app.use('/api/clinics', async (req: express.Request, res: express.Response) => {
    const path = req.originalUrl.split('?')[0];
    console.log(`🔍 [CLINICS] Ruta recibida: ${req.method} ${path}`);
    console.log(`🔍 [CLINICS] Handler disponible:`, typeof clinicsHandler);
    try {
      await handleLambdaResponse(clinicsHandler, req, res, path);
    } catch (error: any) {
      console.error(`❌ [CLINICS] Error en handler:`, error.message);
      console.error(`❌ [CLINICS] Stack:`, error.stack);
      res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  });
} else {
  console.error('❌ [CLINICS] Handler de clínicas no disponible - Las rutas no se registrarán');
  // Agregar un fallback para diagnosticar
  app.use('/api/clinics', (req: express.Request, res: express.Response) => {
    console.error(`❌ [CLINICS] Petición recibida pero handler no disponible: ${req.method} ${req.originalUrl}`);
    res.status(500).json({
      success: false,
      message: 'Clinics handler not available. Check server logs.',
    });
  });
}

// Health check
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ 
    success: true, 
    data: { 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    } 
  });
});

// Función para ejecutar migraciones
async function runMigrations() {
  try {
    console.log(`🔄 Ejecutando migraciones de base de datos...`);
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log(`✅ Migraciones aplicadas exitosamente`);
  } catch (error: any) {
    console.error(`❌ Error al ejecutar migraciones:`, error.message);
    // No bloqueamos el inicio del servidor si las migraciones fallan
    // pero registramos el error para que sea visible
    console.log(`⚠️  Continuando con el inicio del servidor...`);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 MediConnect Backend - Production Server`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API available at /api`);
  
  // Ejecutar migraciones antes de verificar la conexión
  await runMigrations();
  
  // Verificar conexión a la base de datos
  try {
    const { getPrismaClient } = await import('./src/shared/prisma');
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
  console.log(`   - POST   /api/auth/refresh`);
  console.log(`   - GET    /api/auth/me`);
  console.log(`   - POST   /api/providers/register`);
  console.log(`   - POST   /api/ads (Crear solicitud)`);
  console.log(`   - GET    /api/ads (Obtener mi anuncio)`);
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
});
