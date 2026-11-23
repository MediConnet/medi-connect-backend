import { APIGatewayProxyEventV2 } from 'aws-lambda';
import cors from 'cors';
import * as dotenv from 'dotenv';
import express from 'express';

import http from 'http';
import { attachRealtimeToHttpServer } from './src/shared/realtime';
import { startScheduler } from './src/jobs/scheduler';

// Cargar variables de entorno (no sobreescribir variables ya definidas en el entorno)
dotenv.config({ override: false });

// Diagnóstico de variables críticas al arrancar
console.log('🔧 [ENV] DATABASE_URL presente:', !!process.env.DATABASE_URL);
console.log('🔧 [ENV] DATABASE_URL prefix:', process.env.DATABASE_URL?.substring(0, 30) || 'NO DEFINIDA');

// Control de logs de debugging (activar con DEBUG_LOGS=true en producción)
const DEBUG_MODE = process.env.DEBUG_LOGS === 'true' || process.env.NODE_ENV === 'development';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
    
    // Log para debugging (solo si DEBUG_MODE está activo)
    if (DEBUG_MODE) {
      console.log('🔍 [CORS] Origin recibido:', origin);
      console.log('🔍 [CORS] Orígenes permitidos:', allowedOrigins);
      console.log('🔍 [CORS] CORS_ORIGINS env:', process.env.CORS_ORIGINS);
    }
    
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) {
      if (DEBUG_MODE) {
        console.log('✅ [CORS] Request sin origin permitido');
      }
      return callback(null, true);
    }
    
    // Si '*' está permitido o el origen está en la lista, permitirlo
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      if (DEBUG_MODE) {
        console.log(`✅ [CORS] Origin permitido: ${origin}`);
      }
      return callback(null, true);
    }
    
    // Rechazar el origen (siempre loguear errores)
    console.log(`❌ [CORS] Origin rechazado: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
}));

// ⭐ Soporte para multipart/form-data (documentos) - DEBE estar ANTES de express.json()
app.use(
  '/api/auth',
  express.raw({ type: 'multipart/form-data', limit: '20mb' }),
);

// Endpoints sin autenticar que solo llevan unos pocos campos de texto.
//
// El limite general es de 10 MB porque hay rutas que reciben imagenes en
// base64, pero aqui no hace falta nada de eso: un login son dos campos. Dejar
// 10 MB en estas rutas le regala a cualquiera, sin cuenta, la posibilidad de
// mandar cuerpos enormes contra el validador. Es la mitigacion barata para el
// aviso de zod (agotamiento de memoria validando colecciones grandes) mientras
// no se pueda hacer el salto a zod 4.
const RUTAS_PUBLICAS_LIGERAS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/social-login',
];
app.use(RUTAS_PUBLICAS_LIGERAS, express.json({ limit: '32kb' }));

app.use(express.json({ limit: '10mb' })); // ⭐ Aumentar límite para subida de imágenes
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // ⭐ Aumentar límite para subida de imágenes

// ⭐ Servir archivos subidos (logos/base64 guardados localmente)
app.use('/uploads', express.static('uploads'));

// Middleware de logging para todas las requests
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log básico siempre activo
  console.log(`🌐 [INCOMING] ${req.method} ${req.originalUrl}`);
  
  // Logs detallados solo en modo debug
  if (DEBUG_MODE) {
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
  }
  next();
});

// Helper para convertir Express request a API Gateway event
function createApiGatewayEvent(
  req: express.Request,
  path: string
): APIGatewayProxyEventV2 {
  // Obtener origin de forma segura
  const origin = Array.isArray(req.headers.origin) 
    ? req.headers.origin[0] 
    : (req.headers.origin || req.headers.Origin || '');
  
  // Convertir todos los headers a strings y asegurar que origin esté presente
  const headers: Record<string, string> = {};
  Object.keys(req.headers).forEach(key => {
    const value = req.headers[key];
    if (value) {
      headers[key] = Array.isArray(value) ? value[0] : String(value);
    }
  });
  
  // Asegurar que origin esté presente (en minúsculas y mayúsculas)
  if (origin) {
    headers['origin'] = origin;
    headers['Origin'] = origin;
  }
  
  // Asegurar content-type
  headers['content-type'] = req.headers['content-type'] || 'application/json';
  
  console.log('🔍 [createApiGatewayEvent] Origin extraído:', origin);
  console.log('🔍 [createApiGatewayEvent] Headers finales incluyen origin:', 'origin' in headers);
  
  // Determinar el body: si es Buffer (multipart), convertir a base64; sino usar req.body
  const contentType = req.headers['content-type'] || '';
  let body: string | undefined;
  let isBase64Encoded = false;
  
  if (contentType.includes('multipart/form-data') && Buffer.isBuffer(req.body)) {
    // Para multipart, req.body es un Buffer (gracias a express.raw())
    body = req.body.toString('base64');
    isBase64Encoded = true;
    console.log('🔍 [createApiGatewayEvent] Body multipart capturado, tamaño:', req.body.length, 'bytes');
  } else if (req.body) {
    // Para JSON o urlencoded, convertir a string
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    console.log('🔍 [createApiGatewayEvent] Body JSON/urlencoded, tamaño:', body.length, 'chars');
  }
  
  return {
    version: '2.0',
    routeKey: `${req.method} ${path}`,
    rawPath: path,
    rawQueryString: new URLSearchParams(req.query as any).toString(),
    headers: headers,
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
    body: body,
    isBase64Encoded: isBase64Encoded,
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
  if (DEBUG_MODE) {
    console.log(`📥 [REQUEST] ${req.method} ${path} - Iniciando...`);
    console.log(`🔍 [REQUEST] Headers recibidos:`, {
      authorization: req.headers.authorization ? 'Presente' : 'Ausente',
      Authorization: req.headers.Authorization ? 'Presente' : 'Ausente',
      'content-type': req.headers['content-type'],
      origin: req.headers.origin,
    });
  }
  
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
    if (DEBUG_MODE) {
      console.log(`🔍 [REQUEST] Event creado. Headers en event:`, {
        authorization: event.headers.authorization ? 'Presente' : 'Ausente',
        Authorization: event.headers.Authorization ? 'Presente' : 'Ausente',
        origin: event.headers.origin || event.headers.Origin || 'Ausente',
      });
      console.log(`🔍 [REQUEST] Todos los headers del event:`, Object.keys(event.headers));
    }
    
    const result = await handler(event);
    const duration = Date.now() - startTime;
    // Log de completado siempre activo (útil para monitoreo)
    console.log(`✅ [REQUEST] ${req.method} ${path} - ${duration}ms - Status: ${result.statusCode}`);

    // Lambda response ya tiene statusCode y headers
    res.status(result.statusCode || 200);

    // Copiar headers de la respuesta Lambda (asegurarse de incluir CORS)
    if (result.headers) {
      if (DEBUG_MODE) {
        console.log('🔍 [RESPONSE] Headers de Lambda:', Object.keys(result.headers));
        console.log('🔍 [RESPONSE] Access-Control-Allow-Origin:', result.headers['Access-Control-Allow-Origin']);
      }
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    } else {
      // Si no hay headers, asegurar que CORS esté configurado
      const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : (req.headers.origin || req.headers.Origin || '*');
      const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
      
      if (DEBUG_MODE) {
        console.log('🔍 [RESPONSE] No hay headers en Lambda, configurando CORS manualmente');
        console.log('🔍 [RESPONSE] Origin:', origin);
      }
      
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin as string)) {
        res.setHeader('Access-Control-Allow-Origin', origin as string);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept');
        if (DEBUG_MODE) {
          console.log('✅ [RESPONSE] Headers CORS configurados:', origin);
        }
      }
    }

    // IMPORTANT: En Render (Express wrapper), algunas respuestas Lambda se construyen con successResponse(...)
    // sin pasar el `event`, lo que hace que Access-Control-Allow-Origin caiga al fallback (p.ej. localhost).
    // Aquí forzamos el origin correcto basado en el request real (si está permitido).
    const reqOriginHeader = req.headers.origin ?? (req.headers as any).Origin;
    const reqOrigin = Array.isArray(reqOriginHeader)
      ? reqOriginHeader[0]
      : (reqOriginHeader as string | undefined);
    if (reqOrigin) {
      const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*')
        .split(',')
        .map(o => o.trim());
      if (DEBUG_MODE) {
        console.log('🔍 [OVERRIDE] Intentando override CORS. Origin:', reqOrigin);
        console.log('🔍 [OVERRIDE] Orígenes permitidos:', allowedOrigins);
      }
      if (allowedOrigins.includes('*') || allowedOrigins.includes(reqOrigin)) {
        if (DEBUG_MODE) {
          console.log('✅ [OVERRIDE] Sobrescribiendo Access-Control-Allow-Origin a:', reqOrigin);
        }
        res.setHeader('Access-Control-Allow-Origin', reqOrigin);
        res.setHeader('Vary', 'Origin');
      } else {
        // Siempre loguear errores
        console.log('❌ [OVERRIDE] Origin no permitido, no se sobrescribe');
      }
    } else {
      if (DEBUG_MODE) {
        console.log('⚠️ [OVERRIDE] No hay origin en request, no se puede sobrescribir');
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
import { handler as pharmacyChainsHandler } from './src/pharmacy-chains/handler';
import { handler as publicHandler } from './src/public/handler';
import { handler as homeHandler } from './src/home/handler';
import { handler as paymentsHandler } from './src/payments/handler';
import { handler as commentsHandler } from './src/comments/handler';

// Estos cuatro se cargaban con require() dentro de try/catch y un log de
// "cargado correctamente". El try/catch se tragaba el error: si alguno fallaba,
// el servidor arrancaba igual, /api/health respondia 200, el despliegue se daba
// por bueno y ese grupo de rutas devolvia 500 sin que nadie se enterara.
//
// Con import normal, un modulo que no carga impide el arranque. Un despliegue
// que falla es ruidoso; uno que arranca a medias, no.
import { handler as laboratoriesHandler } from './src/laboratories/handler';
import { handler as patientsHandler } from './src/patients/handler';
import { handler as clinicsHandler } from './src/clinics/handler';
import { handler as ambulancesHandler } from './src/ambulances/handler';

// Routes - Auth
app.use('/api/auth', async (req: express.Request, res: express.Response) => {
  // Usar originalUrl para obtener el path completo
  const path = req.originalUrl.split('?')[0]; // Remover query string si existe
  await handleLambdaResponse(authHandler, req, res, path);
});

// Routes - Public (doctors, pharmacies, etc.)
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
  await handleLambdaResponse(pharmacyChainsHandler, req, res, path);
});

// Routes - Patients
app.use('/api/patients', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  console.log(`🔍 [PATIENTS ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(patientsHandler, req, res, path);
});

// Routes - Pharmacies
app.use('/api/pharmacies', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  console.log(`🔍 [PHARMACIES ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(pharmaciesHandler, req, res, path);
});

// Routes - Laboratories
app.use('/api/laboratories', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(laboratoriesHandler, req, res, path);
});

// Routes - Ambulances (usando handler específico para rutas privadas del panel)
app.use('/api/ambulances', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  console.log(`🔍 [AMBULANCES ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(ambulancesHandler, req, res, path);
});

// Routes - Clinics
app.use('/api/clinics', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  try {
    await handleLambdaResponse(clinicsHandler, req, res, path);
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error en handler:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

// Routes - Payments
app.use('/api/payments', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  await handleLambdaResponse(paymentsHandler, req, res, path);
});

// Routes - Comments
app.use('/api/comments', async (req: express.Request, res: express.Response) => {
  const path = req.originalUrl.split('?')[0];
  console.log(`💬 [COMMENTS ROUTE] ${req.method} ${path}`);
  await handleLambdaResponse(commentsHandler, req, res, path);
});

// Servir imágenes de plantillas de email (público)
app.use('/email-assets', express.static('email-templates'));

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

// Start server
const httpServer = http.createServer(app);
attachRealtimeToHttpServer(httpServer);

httpServer.listen(PORT, async () => {
  console.log(`🚀 MediConnect Backend - Production Server`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API available at /api`);
  console.log(`🔌 Realtime (Socket.IO) available at path ${process.env.SOCKET_IO_PATH || '/socket.io'}`);
  
  // Verificar conexión a la base de datos (con reintento)
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { getPrismaClient } = await import('./src/shared/prisma');
      const prisma = getPrismaClient();
      await prisma.$connect();
      console.log(`✅ Conexión a la base de datos exitosa (intento ${attempt}/${maxRetries})`);
      break;
    } catch (error: any) {
      console.error(`❌ Error al conectar (intento ${attempt}/${maxRetries}):`, error.message);
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`   Reintentando en ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.log(`⚠️  No se pudo conectar tras ${maxRetries} intentos. El servidor seguirá ejecutándose.`);
      }
    }
  }
  
  // Limpiar conexiones al apagar
  const cleanup = async () => {
    console.log('🛑 Cerrando servidor y conexiones...');
    const { disconnectPrisma } = await import('./src/shared/prisma');
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  // Iniciar cron jobs
  startScheduler();
  
});
