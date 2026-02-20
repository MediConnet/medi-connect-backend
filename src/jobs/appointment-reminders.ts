import { getPrismaClient } from '../shared/prisma';
import { logger } from '../shared/logger';
import { sendEmailToPatient, formatDate, formatTime } from '../shared/notifications';

/**
 * Job para enviar recordatorios de citas 24 horas antes
 * Este job debe ejecutarse diariamente (ej: a las 8:00 AM)
 * 
 * Para ejecutar manualmente:
 * ts-node src/jobs/appointment-reminders.ts
 */
export async function sendAppointmentReminders(): Promise<void> {
  console.log('🔄 [JOBS] Iniciando job de recordatorios de citas 24h antes...');
  
  const prisma = getPrismaClient();
  
  try {
    // Calcular fecha de mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    console.log(`📅 [JOBS] Buscando citas para: ${tomorrow.toISOString().split('T')[0]}`);
    
    // Buscar citas confirmadas para mañana que tengan clinic_id
    const appointments = await prisma.appointments.findMany({
      where: {
        status: 'CONFIRMED', // Estado confirmado
        scheduled_for: {
          gte: tomorrow,
          lte: tomorrowEnd,
        },
        clinic_id: {
          not: null, // Solo citas de clínicas
        },
      },
      include: {
        clinics: {
          include: {
            users: true,
          },
        },
        patients: {
          include: {
            users: true,
          },
        },
      },
    });
    
    console.log(`📋 [JOBS] Encontradas ${appointments.length} citas para mañana`);
    
    let sentCount = 0;
    let errorCount = 0;
    
    for (const appointment of appointments) {
      try {
        // Obtener el doctor desde clinic_doctors y su nombre desde provider
        let doctorName: string | undefined = undefined;
        if (appointment.clinic_id && appointment.provider_id) {
          const doctor = await prisma.clinic_doctors.findFirst({
            where: {
              clinic_id: appointment.clinic_id,
              user_id: appointment.provider_id,
            },
            select: {
              id: true,
              user_id: true
            }
          });
          
          if (doctor?.user_id) {
            const provider = await prisma.providers.findFirst({
              where: { user_id: doctor.user_id },
              select: { commercial_name: true }
            });
            doctorName = provider?.commercial_name || undefined;
          }
        }
        
        // Verificar que el paciente tenga email
        if (!appointment.patients?.users?.email) {
          console.log(`⚠️ [JOBS] Paciente ${appointment.patient_id} no tiene email, saltando...`);
          continue;
        }
        
        // Enviar recordatorio
        await sendEmailToPatient(
          appointment.patients.users.email,
          appointment.patients.full_name || 'Paciente',
          appointment.clinics?.name || 'Clínica',
          {
            appointment_id: appointment.id,
            doctor_id: appointment.provider_id || undefined,
            doctor_name: doctorName,
            patient_id: appointment.patients.id,
            patient_name: appointment.patients.full_name,
            date: formatDate(appointment.scheduled_for),
            time: formatTime(appointment.scheduled_for),
            reason: appointment.reason ?? undefined,
          },
          appointment.clinics?.address ?? undefined,
          'Recordatorio: Tu cita es mañana',
          true // isReminder
        );
        
        sentCount++;
        console.log(`✅ [JOBS] Recordatorio enviado a ${appointment.patients.users.email}`);
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [JOBS] Error al enviar recordatorio para cita ${appointment.id}:`, error.message);
        logger.error('Error sending appointment reminder', error, { appointmentId: appointment.id });
      }
    }
    
    console.log(`✅ [JOBS] Job completado: ${sentCount} recordatorios enviados, ${errorCount} errores`);
  } catch (error: any) {
    console.error(`❌ [JOBS] Error en job de recordatorios:`, error.message);
    logger.error('Error in appointment reminders job', error);
    throw error;
  }
}

// Si se ejecuta directamente, correr el job
if (require.main === module) {
  sendAppointmentReminders()
    .then(() => {
      console.log('✅ [JOBS] Job ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ [JOBS] Error al ejecutar job:', error);
      process.exit(1);
    });
}
