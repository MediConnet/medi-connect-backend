import { getPrismaClient } from '../shared/prisma';

export interface CachedReminder {
  id: string;
  patient_id: string;
  title: string;
  note: string | null;
  type: string;
  frequency: number | null;
  time: Date;
  start_date: Date;
  push_token: string | null;
}

let cachedReminders: CachedReminder[] = [];
let isInitializing = false;

/**
 * Inicializa la caché de recordatorios activos cargándolos de la base de datos.
 */
export async function initializeReminderCache(): Promise<void> {
  if (isInitializing) return;
  isInitializing = true;
  console.log('📦 [CACHE] Inicializando caché de recordatorios activos...');
  try {
    await reloadCache();
    console.log(`✅ [CACHE] Caché de recordatorios inicializada con ${cachedReminders.length} recordatorios activos.`);
  } catch (error: any) {
    console.error('❌ [CACHE] Error al inicializar la caché de recordatorios:', error.message);
  } finally {
    isInitializing = false;
  }
}

/**
 * Recarga de forma asíncrona la caché de recordatorios desde la base de datos.
 */
export async function triggerCacheReload(): Promise<void> {
  console.log('🔄 [CACHE] Recargando caché de recordatorios activos...');
  try {
    await reloadCache();
    console.log(`✅ [CACHE] Caché de recordatorios recargada con éxito. ${cachedReminders.length} recordatorios activos.`);
  } catch (error: any) {
    console.error('❌ [CACHE] Error al recargar la caché de recordatorios:', error.message);
  }
}

/**
 * Retorna los recordatorios activos almacenados en la caché in-memory.
 */
export function getRemindersFromCache(): CachedReminder[] {
  return cachedReminders;
}

/**
 * Realiza la consulta a la base de datos para obtener los recordatorios activos y sus push tokens.
 */
async function reloadCache(): Promise<void> {
  const prisma = getPrismaClient();
  const reminders = await prisma.patient_reminders.findMany({
    where: {
      is_active: true,
    },
    include: {
      patients: {
        include: {
          users: {
            select: {
              push_token: true,
            },
          },
        },
      },
    },
  });

  cachedReminders = reminders.map((r) => ({
    id: r.id,
    patient_id: r.patient_id,
    title: r.title,
    note: r.note,
    type: r.type,
    frequency: r.frequency,
    time: r.time,
    start_date: r.start_date,
    push_token: r.patients?.users?.push_token || null,
  }));
}
