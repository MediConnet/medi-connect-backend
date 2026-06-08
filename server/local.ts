import { APIGatewayProxyEventV2 } from "aws-lambda";
import cors from "cors";
import * as dotenv from "dotenv";
import express from "express";
import http from "http";
import { attachRealtimeToHttpServer } from "../src/shared/realtime";

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
      
      // Permitir requests sin origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Si '*' está permitido o el origen está en la lista, permitirlo
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Rechazar el origen
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposedHeaders: ["Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" })); // ⭐ Aumentar límite para subida de imágenes
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // ⭐ Aumentar límite para subida de imágenes
// ⭐ Soporte para multipart/form-data (documentos) en rutas de auth
app.use(
  "/api/auth",
  express.raw({ type: "multipart/form-data", limit: "20mb" }),
);

// ⭐ Servir archivos subidos localmente (solo dev)
app.use("/uploads", express.static("uploads"));

// Middleware de logging para todas las requests
app.use((req, res, next) => {
  console.log(`\n🌐 [INCOMING] ${req.method} ${req.originalUrl}`);
  next();
});

// Helper para convertir Express request a API Gateway event
function createApiGatewayEvent(
  req: express.Request,
  path: string,
): APIGatewayProxyEventV2 {
  const contentType =
    (typeof req.headers["content-type"] === "string"
      ? req.headers["content-type"]
      : "") || "application/json";

  const isMultipart = contentType.includes("multipart/form-data");
  const rawBody =
    isMultipart && Buffer.isBuffer(req.body) ? (req.body as Buffer) : null;

  return {
    version: "2.0",
    routeKey: `${req.method} ${path}`,
    rawPath: path,
    rawQueryString: new URLSearchParams(req.query as any).toString(),
    headers: {
      ...(req.headers as Record<string, string>),
      "content-type": contentType,
    },
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "local",
      http: {
        method: req.method,
        path: path,
        protocol: "HTTP/1.1",
        sourceIp: req.ip || "127.0.0.1",
        userAgent: req.headers["user-agent"] || "",
      },
      requestId: `local-${Date.now()}`,
      routeKey: `${req.method} ${path}`,
      stage: "local",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: rawBody
      ? rawBody.toString("base64")
      : req.body
        ? JSON.stringify(req.body)
        : undefined,
    isBase64Encoded: Boolean(rawBody),
    queryStringParameters:
      Object.keys(req.query).length > 0
        ? (req.query as Record<string, string>)
        : undefined,
  };
}

// Helper para manejar respuestas de Lambda
async function handleLambdaResponse(
  handler: (event: APIGatewayProxyEventV2) => Promise<any>,
  req: express.Request,
  res: express.Response,
  path: string,
) {
  const startTime = Date.now();

  // Validar que el handler sea una función
  if (!handler || typeof handler !== "function") {
    const duration = Date.now() - startTime;
    console.error(
      `❌ [REQUEST] ${req.method} ${path} - Error después de ${duration}ms: handler is not a function`,
    );
    res.status(500).json({
      success: false,
      message: "Handler not available. Check server logs for details.",
    });
    return;
  }

  try {
    const event = createApiGatewayEvent(req, path);

    const result = await handler(event);
    const duration = Date.now() - startTime;
    console.log(
      `✅ [REQUEST] ${req.method} ${path} - Completado en ${duration}ms - Status: ${result.statusCode}`,
    );

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
      message: error.message || "Internal server error",
    });
  }
}

// Importar handlers
import { handler as adminHandler } from "../src/admin/handler";
import { handler as adsHandler } from "../src/ads/handler";
import { handler as ambulancesHandler } from "../src/ambulances/handler";
import { handler as authHandler } from "../src/auth/handler";
import { handler as doctorsHandler } from "../src/doctors/handler";
import { handler as gmailHandler } from "../src/gmail/handler";
import { handler as homeHandler } from "../src/home/handler";
import { handler as paymentsHandler } from "../src/payments/handler";
import { handler as pharmaciesHandler } from "../src/pharmacies/handler";
import { handler as pharmacyChainsHandler } from "../src/pharmacy-chains/handler";
import { handler as publicHandler } from "../src/public/handler";
import { handler as suppliesHandler } from "../src/supplies/handler";
import { handler as commentsHandler } from "../src/comments/handler";

// Importar otros handlers si existen
let laboratoriesHandler: any;

try {
  laboratoriesHandler = require("../src/laboratories/handler").handler;
} catch (e) {
  // Handler no existe o tiene errores
}

let patientsHandler: any;
try {
  patientsHandler = require("../src/patients/handler").handler;
  if (!patientsHandler) {
    console.error("❌ [PATIENTS] Handler exportado pero es undefined");
  } else {
    console.log("✅ [PATIENTS] Handler de pacientes cargado correctamente");
  }
} catch (e: any) {
  console.error("❌ [PATIENTS] Error al cargar handler:", e.message);
  console.error("❌ [PATIENTS] Stack:", e.stack);
}

let clinicsHandler: any;
try {
  clinicsHandler = require("../src/clinics/handler").handler;
  console.log("✅ [CLINICS] Handler de clínicas cargado correctamente");
} catch (e: any) {
  console.error("❌ [CLINICS] Error al cargar handler de clínicas:", e.message);
  console.error("❌ [CLINICS] Stack:", e.stack);
}

// Routes - Auth
app.use("/api/auth", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(authHandler, req, res, path);
});

// Routes - Public (doctors, pharmacies, etc.)
app.use("/api/public", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  console.log(`🔍 [PUBLIC ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(publicHandler, req, res, path);
});

// Routes - Doctors
app.use("/api/doctors", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(doctorsHandler, req, res, path);
});

app.use("/api/specialties", async (req, res) => {
  const path = req.originalUrl.split("?")[0]; 
  await handleLambdaResponse(doctorsHandler, req, res, path);
});

// Routes - Admin
app.use("/api/admin", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(adminHandler, req, res, path);
});

// Routes - Providers (registro de proveedores)
app.use("/api/providers", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(adminHandler, req, res, path);
});

// Routes - Ads (Anuncios)
app.use("/api/ads", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(adsHandler, req, res, path);
});

// Routes - Home
app.use("/api/home", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(homeHandler, req, res, path);
});

// Routes - Supplies
app.use("/api/supplies", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(suppliesHandler, req, res, path);
});

// Routes - Pharmacy Chains (público)
app.use("/api/pharmacy-chains", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(pharmacyChainsHandler, req, res, path);
});

// Routes - Patients
if (patientsHandler) {
  app.use("/api/patients", async (req, res) => {
    const path = req.originalUrl.split("?")[0];
    console.log(`🔍 [PATIENTS ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
    await handleLambdaResponse(patientsHandler, req, res, path);
  });
} else {
  console.error("❌ [PATIENTS] Handler de pacientes no disponible - Las rutas no se registrarán");
  app.use("/api/patients", (req, res) => {
    console.error(`❌ [PATIENTS] Petición recibida pero handler no disponible: ${req.method} ${req.originalUrl}`);
    res.status(500).json({ 
      success: false, 
      message: "Patients handler not available. Check server logs." 
    });
  });
}

// Routes - Pharmacies
app.use("/api/pharmacies", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  console.log(`🔍 [PHARMACIES ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
  await handleLambdaResponse(pharmaciesHandler, req, res, path);
});

// Routes - Laboratories (si existe)
if (laboratoriesHandler) {
  app.use("/api/laboratories", async (req, res) => {
    const path = req.originalUrl.split("?")[0];
    await handleLambdaResponse(laboratoriesHandler, req, res, path);
  });
}

// Routes - Ambulances
if (ambulancesHandler) {
  app.use("/api/ambulances", async (req, res) => {
    const path = req.originalUrl.split("?")[0];
    console.log(`🔍 [AMBULANCES ROUTE] ${req.method} ${path} - originalUrl: ${req.originalUrl}`);
    await handleLambdaResponse(ambulancesHandler, req, res, path);
  });
} else {
  console.error("❌ [AMBULANCES] Handler de ambulancias no disponible - Las rutas no se registrarán");
  app.use("/api/ambulances", (req, res) => {
    console.error(`❌ [AMBULANCES] Petición recibida pero handler no disponible: ${req.method} ${req.originalUrl}`);
    res.status(500).json({ 
      success: false, 
      message: "Ambulances handler not available. Check server logs." 
    });
  });
}

// Routes - Clinics (si existe)
if (clinicsHandler) {
  app.use("/api/clinics", async (req, res) => {
    const path = req.originalUrl.split("?")[0];
    console.log(`🔍 [CLINICS] Ruta recibida: ${req.method} ${path}`);
    await handleLambdaResponse(clinicsHandler, req, res, path);
  });
} else {
  console.error("❌ [CLINICS] Handler de clínicas no disponible - Las rutas no se registrarán");
  app.use("/api/clinics", (req, res) => {
    console.error(`❌ [CLINICS] Petición recibida pero handler no disponible: ${req.method} ${req.originalUrl}`);
    res.status(500).json({ 
      success: false, 
      message: "Clinics handler not available. Check server logs." 
    });
  });
}

// Routes - Comments
app.use("/api/comments", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  console.log(`💬 [COMMENTS ROUTE] ${req.method} ${path}`);
  await handleLambdaResponse(commentsHandler, req, res, path);
});

// Routes - Payments
app.use("/api/payments", async (req, res) => {
  const path = req.originalUrl.split("?")[0];
  await handleLambdaResponse(paymentsHandler, req, res, path);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    data: { 
      status: "ok", 
      timestamp: new Date().toISOString() 
    } 
  });
});

// Start server
const httpServer = http.createServer(app);
attachRealtimeToHttpServer(httpServer);

httpServer.listen(PORT, async () => {
  console.log(`🚀 MediConnect Backend - Local Development Server`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}/api`);
  console.log(`🔌 Realtime (Socket.IO) available at path ${process.env.SOCKET_IO_PATH || "/socket.io"}`);

  // Verificar conexión a la base de datos (con reintento)
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { getPrismaClient } = await import("../src/shared/prisma");
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
    const { disconnectPrisma } = await import("../src/shared/prisma");
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

});
