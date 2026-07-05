import cron from 'node-cron';
import { checkReminders } from './check-reminders.job';
import { sendAppointmentReminders } from './appointment-reminders';
import { checkAppointmentReminders } from './appointment-reminders-check';
import { updateFeaturedBranches } from './featured.job';
import { initializeReminderCache, triggerCacheReload } from './reminder-cache';
import { expirePendingPayments } from './expire-pending-payments.job';

export function startScheduler(): void {
  console.log('⏰ [SCHEDULER] Iniciando cron jobs...');

  // Inicializar la caché de recordatorios activos in-memory
  initializeReminderCache().catch(err => {
    console.error('❌ [SCHEDULER] Falló inicialización de la caché de recordatorios:', err);
  });

  // Cada minuto: verificar recordatorios de medicamentos y citas (push notifications)
  cron.schedule('* * * * *', async () => {
    try {
      await checkReminders();
    } catch (error) {
      console.error('❌ [SCHEDULER] Error en checkReminders:', error);
    }
  });

  // Cada 30 minutos: comprobar recordatorios de citas de 48h, 24h, 2h y auto-demotación de 12h
  cron.schedule('*/30 * * * *', async () => {
    try {
      await checkAppointmentReminders();
    } catch (error) {
      console.error('❌ [SCHEDULER] Error en checkAppointmentReminders:', error);
    }
  });

  // Cada 5 minutos: cancelar citas PENDING_PAYMENT / PROCESSING que llevan más de 15 min sin pagar
  cron.schedule('*/5 * * * *', async () => {
    try {
      await expirePendingPayments();
    } catch (error) {
      console.error('❌ [SCHEDULER] Error en expirePendingPayments:', error);
    }
  });

  // Cada hora: recarga de seguridad de la caché de recordatorios
  cron.schedule('0 * * * *', async () => {
    try {
      await triggerCacheReload();
    } catch (error) {
      console.error('❌ [SCHEDULER] Error al recargar la caché en cron:', error);
    }
  });

  // Cada día a las 8:00 AM (hora Ecuador, UTC-5 = 13:00 UTC)
  cron.schedule('0 13 * * *', async () => {
    try {
      console.log('📅 [SCHEDULER] Ejecutando recordatorios de citas 24h...');
      await sendAppointmentReminders();
    } catch (error) {
      console.error('❌ [SCHEDULER] Error en sendAppointmentReminders:', error);
    }
  });

  // Cada día a las 3:00 AM UTC: actualizar servicios destacados
  cron.schedule('0 3 * * *', async () => {
    try {
      console.log('🏆 [SCHEDULER] Ejecutando actualización de destacados...');
      await updateFeaturedBranches();
    } catch (error) {
      console.error('❌ [SCHEDULER] Error en updateFeaturedBranches:', error);
    }
  });

  console.log('✅ [SCHEDULER] Cron jobs activos:');
  console.log('   - checkReminders: cada minuto');
  console.log('   - expirePendingPayments: cada 5 minutos (libera slots abandonados)');
  console.log('   - triggerCacheReload: cada hora (seguridad)');
  console.log('   - checkAppointmentReminders: cada 30 minutos');
  console.log('   - sendAppointmentReminders: diario 8:00 AM Ecuador');
  console.log('   - updateFeaturedBranches: diario 3:00 AM UTC');
}
