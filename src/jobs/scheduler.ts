import cron from 'node-cron';
import { checkReminders } from './check-reminders.job';
import { sendAppointmentReminders } from './appointment-reminders';
import { updateFeaturedBranches } from './featured.job';

export function startScheduler(): void {
  console.log('⏰ [SCHEDULER] Iniciando cron jobs...');

  // Cada minuto: verificar recordatorios de medicamentos y citas (push notifications)
  cron.schedule('* * * * *', async () => {
    try {
      await checkReminders();
    } catch (error) {
      console.error('❌ [SCHEDULER] Error en checkReminders:', error);
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
  console.log('   - sendAppointmentReminders: diario 8:00 AM Ecuador');
  console.log('   - updateFeaturedBranches: diario 3:00 AM UTC');
}
