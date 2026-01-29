import { getPrismaClient } from './prisma';
import { randomUUID } from 'crypto';
import { logger } from './logger';
import { sendEmail, generateDoctorNewAppointmentEmail, generateClinicNewAppointmentEmail, generatePatientNewAppointmentEmail, generatePatientReminderEmail, generateDoctorCancellationEmail, generatePatientCancellationEmail } from './email';

export interface AppointmentNotificationData {
  appointment_id: string;
  doctor_id?: string;
  doctor_name?: string;
  doctor_specialty?: string;
  patient_id?: string;
  patient_name?: string;
  date: string;
  time: string;
  reason?: string;
}

/**
 * Envía notificación a la clínica (guarda en BD)
 */
export async function notifyClinic(
  clinicId: string,
  type: 'cita' | 'cita_cancelada',
  title: string,
  body: string,
  data: AppointmentNotificationData
): Promise<void> {
  try {
    const prisma = getPrismaClient();
    await prisma.clinic_notifications.create({
      data: {
        id: randomUUID(),
        clinic_id: clinicId,
        type,
        title,
        body,
        is_read: false,
        data: data as any,
      },
    });
    console.log(`✅ [NOTIFICATIONS] Notificación de clínica creada: ${type} - ${clinicId}`);
  } catch (error: any) {
    console.error(`❌ [NOTIFICATIONS] Error al crear notificación de clínica:`, error.message);
    logger.error('Error creating clinic notification', error);
    // No lanzar error, solo registrar
  }
}

/**
 * Envía email al médico
 */
export async function sendEmailToDoctor(
  doctorEmail: string,
  doctorName: string,
  clinicName: string,
  appointment: AppointmentNotificationData,
  clinicAddress?: string,
  subject?: string
): Promise<void> {
  try {
    const emailSubject = subject || `Nueva cita agendada - ${clinicName}`;
    const emailHtml = generateDoctorNewAppointmentEmail({
      doctorName,
      clinicName,
      patientName: appointment.patient_name || 'Paciente',
      date: appointment.date,
      time: appointment.time,
      reason: appointment.reason,
      clinicAddress: clinicAddress || 'Dirección no especificada',
    });

    await sendEmail({
      to: doctorEmail,
      subject: emailSubject,
      html: emailHtml,
    });
  } catch (error: any) {
    console.error(`❌ [NOTIFICATIONS] Error al enviar email a médico:`, error.message);
    logger.error('Error sending email to doctor', error);
  }
}

/**
 * Envía email a la clínica
 */
export async function sendEmailToClinic(
  clinicEmail: string,
  clinicName: string,
  appointment: AppointmentNotificationData
): Promise<void> {
  try {
    const emailHtml = generateClinicNewAppointmentEmail({
      doctorName: appointment.doctor_name || 'Médico',
      doctorSpecialty: appointment.doctor_specialty || 'Especialidad',
      patientName: appointment.patient_name || 'Paciente',
      date: appointment.date,
      time: appointment.time,
      reason: appointment.reason,
    });

    await sendEmail({
      to: clinicEmail,
      subject: `Nueva cita agendada - ${clinicName}`,
      html: emailHtml,
    });
  } catch (error: any) {
    console.error(`❌ [NOTIFICATIONS] Error al enviar email a clínica:`, error.message);
    logger.error('Error sending email to clinic', error);
  }
}

/**
 * Envía email al paciente
 */
export async function sendEmailToPatient(
  patientEmail: string,
  patientName: string,
  clinicName: string,
  appointment: AppointmentNotificationData,
  clinicAddress?: string,
  subject: string = 'Tu cita ha sido confirmada',
  isReminder: boolean = false
): Promise<void> {
  try {
    let emailHtml: string;
    
    if (isReminder) {
      emailHtml = generatePatientReminderEmail({
        patientName,
        doctorName: appointment.doctor_name || 'Médico',
        clinicName,
        clinicAddress: clinicAddress || 'Dirección no especificada',
        date: appointment.date,
        time: appointment.time,
      });
    } else if (subject.includes('cancelada')) {
      emailHtml = generatePatientCancellationEmail({
        patientName,
        date: appointment.date,
        time: appointment.time,
        doctorName: appointment.doctor_name || 'Médico',
        clinicName,
      });
    } else {
      emailHtml = generatePatientNewAppointmentEmail({
        patientName,
        doctorName: appointment.doctor_name || 'Médico',
        doctorSpecialty: appointment.doctor_specialty || 'Especialidad',
        clinicName,
        clinicAddress: clinicAddress || 'Dirección no especificada',
        date: appointment.date,
        time: appointment.time,
        reason: appointment.reason,
      });
    }

    await sendEmail({
      to: patientEmail,
      subject: `${subject} - ${clinicName}`,
      html: emailHtml,
    });
  } catch (error: any) {
    console.error(`❌ [NOTIFICATIONS] Error al enviar email a paciente:`, error.message);
    logger.error('Error sending email to patient', error);
  }
}

/**
 * Envía notificación cuando se cancela una cita
 */
export async function notifyAppointmentCancelled(
  appointment: any,
  clinic: any,
  doctor: any,
  patient: any
): Promise<void> {
  try {
    const prisma = getPrismaClient();
    
    // Notificar a la clínica
    if (clinic?.id) {
      const appointmentDate = appointment.scheduled_for ? new Date(appointment.scheduled_for) : null;
      const dateStr = formatDate(appointmentDate);
      const timeStr = formatTime(appointmentDate);
      
      await notifyClinic(
        clinic.id,
        'cita_cancelada',
        'Cita cancelada',
        `Dr. ${doctor?.name || 'Médico'} - ${patient?.full_name || 'Paciente'} - ${dateStr} ${timeStr}`,
        {
          appointment_id: appointment.id,
          doctor_id: doctor?.id,
          doctor_name: doctor?.name,
          patient_id: patient?.id,
          patient_name: patient?.full_name,
          date: dateStr,
          time: timeStr,
          reason: appointment.reason || undefined,
        }
      );
    }
    
    // Enviar email al médico (si está activo)
    if (doctor?.email && doctor?.is_active) {
      const appointmentDate = appointment.scheduled_for ? new Date(appointment.scheduled_for) : null;
      const emailHtml = generateDoctorCancellationEmail({
        doctorName: doctor.name || 'Médico',
        patientName: patient?.full_name || 'Paciente',
        date: formatDate(appointmentDate),
        time: formatTime(appointmentDate),
      });
      
      await sendEmail({
        to: doctor.email,
        subject: `Cita cancelada - ${clinic?.name || 'Clínica'}`,
        html: emailHtml,
      });
    }
    
    // Enviar email al paciente
    if (patient?.users?.email) {
      const appointmentDate = appointment.scheduled_for ? new Date(appointment.scheduled_for) : null;
      await sendEmailToPatient(
        patient.users.email,
        patient.full_name || 'Paciente',
        clinic?.name || 'Clínica',
        {
          appointment_id: appointment.id,
          doctor_id: doctor?.id,
          doctor_name: doctor?.name,
          patient_id: patient.id,
          patient_name: patient.full_name,
          date: formatDate(appointmentDate),
          time: formatTime(appointmentDate),
          reason: appointment.reason || undefined,
        },
        clinic?.address,
        'Tu cita ha sido cancelada'
      );
    }
  } catch (error: any) {
    console.error(`❌ [NOTIFICATIONS] Error al notificar cancelación:`, error.message);
    logger.error('Error notifying appointment cancellation', error);
  }
}

/**
 * Envía notificación cuando se confirma una cita
 */
export async function notifyAppointmentConfirmed(
  appointment: any,
  clinic: any,
  doctor: any,
  patient: any
): Promise<void> {
  try {
    // Por ahora solo log, el recordatorio 24h antes se implementará con un job/cron
    console.log(`✅ [NOTIFICATIONS] Cita confirmada: ${appointment.id}`);
    console.log(`   Recordatorio 24h antes se enviará automáticamente`);
    
    // TODO: Programar recordatorio 24h antes (job/cron)
    // Por ahora, si la cita es para mañana, enviar recordatorio inmediatamente
    const appointmentDate = appointment.scheduled_for ? new Date(appointment.scheduled_for) : null;
    if (appointmentDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const appointmentDay = new Date(appointmentDate);
      appointmentDay.setHours(0, 0, 0, 0);
      
      // Si la cita es para mañana, enviar recordatorio
      if (appointmentDay.getTime() === tomorrow.getTime()) {
        if (patient?.users?.email) {
          await sendEmailToPatient(
            patient.users.email,
            patient.full_name || 'Paciente',
            clinic?.name || 'Clínica',
            {
              appointment_id: appointment.id,
              doctor_id: doctor?.id,
              doctor_name: doctor?.name,
              patient_id: patient.id,
              patient_name: patient.full_name,
              date: formatDate(appointmentDate),
              time: formatTime(appointmentDate),
              reason: appointment.reason || undefined,
            },
            'Recordatorio: Tu cita es mañana'
          );
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ [NOTIFICATIONS] Error al notificar confirmación:`, error.message);
    logger.error('Error notifying appointment confirmation', error);
  }
}

/**
 * Envía notificación cuando se crea una nueva cita
 */
export async function notifyNewAppointment(
  appointment: any,
  clinic: any,
  doctor: any,
  patient: any
): Promise<void> {
  try {
    const prisma = getPrismaClient();
    const appointmentDate = appointment.scheduled_for ? new Date(appointment.scheduled_for) : null;
    const dateStr = formatDate(appointmentDate);
    const timeStr = formatTime(appointmentDate);
    
    // Notificar a la clínica
    if (clinic?.id) {
      await notifyClinic(
        clinic.id,
        'cita',
        'Nueva cita agendada',
        `Dr. ${doctor?.name || 'Médico'} - ${patient?.full_name || 'Paciente'} - ${dateStr} ${timeStr}`,
        {
          appointment_id: appointment.id,
          doctor_id: doctor?.id,
          doctor_name: doctor?.name,
          doctor_specialty: doctor?.specialty,
          patient_id: patient?.id,
          patient_name: patient?.full_name,
          date: dateStr,
          time: timeStr,
          reason: appointment.reason || undefined,
        }
      );
    }
    
    // Enviar email a la clínica
    if (clinic?.users?.email) {
      await sendEmailToClinic(
        clinic.users.email,
        clinic.name,
        {
          appointment_id: appointment.id,
          doctor_id: doctor?.id,
          doctor_name: doctor?.name,
          doctor_specialty: doctor?.specialty,
          patient_id: patient?.id,
          patient_name: patient?.full_name,
          date: dateStr,
          time: timeStr,
          reason: appointment.reason || undefined,
        }
      );
    }
    
    // Enviar email al médico (si está activo)
    if (doctor?.email && doctor?.is_active) {
      await sendEmailToDoctor(
        doctor.email,
        doctor.name || 'Médico',
        clinic?.name || 'Clínica',
        {
          appointment_id: appointment.id,
          doctor_id: doctor.id,
          doctor_name: doctor.name,
          doctor_specialty: doctor.specialty,
          patient_id: patient?.id,
          patient_name: patient?.full_name,
          date: dateStr,
          time: timeStr,
          reason: appointment.reason || undefined,
        },
        clinic?.address
      );
    }
    
    // Enviar email al paciente
    if (patient?.users?.email) {
      await sendEmailToPatient(
        patient.users.email,
        patient.full_name || 'Paciente',
        clinic?.name || 'Clínica',
        {
          appointment_id: appointment.id,
          doctor_id: doctor?.id,
          doctor_name: doctor?.name,
          doctor_specialty: doctor?.specialty,
          patient_id: patient.id,
          patient_name: patient.full_name,
          date: dateStr,
          time: timeStr,
          reason: appointment.reason || undefined,
        },
        clinic?.address,
        'Tu cita ha sido confirmada'
      );
    }
  } catch (error: any) {
    console.error(`❌ [NOTIFICATIONS] Error al notificar nueva cita:`, error.message);
    logger.error('Error notifying new appointment', error);
  }
}

// Helpers
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

export function formatTime(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}
