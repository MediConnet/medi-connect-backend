import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getPrismaClient } from './prisma';

export type RealtimeEventName =
  | 'appointment:created'
  | 'appointment:updated'
  | 'review:new'
  | 'order:updated'
  | 'notification:new';

type JwtClaims = {
  sub?: string;
  userId?: string;
  email?: string;
  username?: string;
  ['cognito:username']?: string;
  role?: string | null;
  [key: string]: any;
};

type AuthedSocket = {
  userId: string;
  role?: string | null;
};

let ioSingleton: SocketIOServer | null = null;

function base64UrlToString(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function decodeJwtLike(token: string): JwtClaims | null {
  // Support "simple token" used in dev (base64(JSON))
  try {
    const simple = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (simple && typeof simple === 'object') return simple as JwtClaims;
  } catch {
    // ignore
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadJson = base64UrlToString(parts[1]);
    const decoded = JSON.parse(payloadJson);
    if (decoded && typeof decoded === 'object') return decoded as JwtClaims;
    return null;
  } catch {
    return null;
  }
}

async function authenticateToken(token: string): Promise<AuthedSocket | null> {
  const claims = decodeJwtLike(token);
  if (!claims) return null;

  const prisma = getPrismaClient();

  const email =
    claims.email || claims['cognito:username'] || claims.username || undefined;
  const userId = claims.userId || claims.sub || undefined;

  const user = email
    ? await prisma.users.findFirst({ where: { email: String(email) } })
    : userId
      ? await prisma.users.findUnique({ where: { id: String(userId) } })
      : null;

  if (!user) return null;

  // Mirror existing behavior: in non-prod allow inactive users; in prod require active
  const isProduction =
    process.env.STAGE === 'prod' || process.env.NODE_ENV === 'production';
  if (isProduction && !user.is_active) return null;

  return { userId: user.id, role: user.role };
}

export function initRealtime(io: SocketIOServer) {
  ioSingleton = io;

  io.use(async (socket, next) => {
    try {
      const tokenFromAuth =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token;
      const authHeader =
        (socket.handshake.headers.authorization ||
          socket.handshake.headers.Authorization) as string | undefined;

      const token =
        typeof tokenFromAuth === 'string'
          ? tokenFromAuth
          : typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : null;

      if (!token) return next(new Error('Authentication required'));

      const authed = await authenticateToken(token);
      if (!authed) return next(new Error('Invalid token'));

      (socket.data as any).userId = authed.userId;
      (socket.data as any).role = authed.role ?? null;

      return next();
    } catch (err) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket.data as any).userId as string | undefined;
    if (userId) {
      socket.join(userRoom(userId));
    }

    // Join entity rooms (clinics/providers/patients) when applicable.
    (async () => {
      if (!userId) return;
      try {
        const prisma = getPrismaClient();
        const [clinic, provider, patient] = await Promise.all([
          prisma.clinics.findFirst({
            where: { user_id: userId },
            select: { id: true },
          }),
          prisma.providers.findFirst({
            where: { user_id: userId },
            select: { id: true },
          }),
          prisma.patients.findFirst({
            where: { user_id: userId },
            select: { id: true },
          }),
        ]);

        if (clinic?.id) socket.join(clinicRoom(clinic.id));
        if (provider?.id) socket.join(providerRoom(provider.id));
        if (patient?.id) socket.join(patientRoom(patient.id));
      } catch {
        // ignore
      }
    })();

    socket.on('disconnect', () => {
      // Socket.IO handles room cleanup automatically.
    });
  });
}

export function attachRealtimeToHttpServer(
  httpServer: HttpServer,
): SocketIOServer {
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const io = new SocketIOServer(httpServer, {
    path: process.env.SOCKET_IO_PATH || '/socket.io',
    cors: {
      origin: allowedOrigins.includes('*') ? true : allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  initRealtime(io);
  return io;
}

export function getRealtimeIO(): SocketIOServer {
  if (!ioSingleton) {
    throw new Error('Realtime (Socket.IO) not initialized');
  }
  return ioSingleton;
}

export function userRoom(userId: string) {
  return `user:${userId}`;
}

export function clinicRoom(clinicId: string) {
  return `clinic:${clinicId}`;
}

export function providerRoom(providerId: string) {
  return `provider:${providerId}`;
}

export function patientRoom(patientId: string) {
  return `patient:${patientId}`;
}

export function emitToUser(
  userId: string,
  event: RealtimeEventName,
  payload: unknown,
) {
  if (!ioSingleton) return;
  ioSingleton.to(userRoom(userId)).emit(event, payload);
}

export function emitToClinic(
  clinicId: string,
  event: RealtimeEventName,
  payload: unknown,
) {
  if (!ioSingleton) return;
  ioSingleton.to(clinicRoom(clinicId)).emit(event, payload);
}

export function emitToProvider(
  providerId: string,
  event: RealtimeEventName,
  payload: unknown,
) {
  if (!ioSingleton) return;
  ioSingleton.to(providerRoom(providerId)).emit(event, payload);
}

export function emitToPatient(
  patientId: string,
  event: RealtimeEventName,
  payload: unknown,
) {
  if (!ioSingleton) return;
  ioSingleton.to(patientRoom(patientId)).emit(event, payload);
}

