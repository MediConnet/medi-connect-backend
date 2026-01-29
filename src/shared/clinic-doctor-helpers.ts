import { getPrismaClient } from './prisma';
import { AuthContext } from './auth';

/**
 * Obtiene el registro de médico asociado a clínica para un usuario
 */
export async function getClinicDoctor(authContext: AuthContext) {
  const prisma = getPrismaClient();
  
  const clinicDoctor = await prisma.clinic_doctors.findFirst({
    where: {
      user_id: authContext.user.id,
      is_active: true,
      is_invited: false, // Solo médicos que aceptaron la invitación
    },
    include: {
      clinics: {
        include: {
          users: {
            select: { email: true }
          }
        }
      }
    },
  });

  return clinicDoctor;
}

/**
 * Valida que el médico tenga acceso a una clínica específica
 */
export async function validateClinicDoctorAccess(
  authContext: AuthContext,
  clinicId: string
): Promise<{ valid: boolean; clinicDoctor?: any; error?: string }> {
  const clinicDoctor = await getClinicDoctor(authContext);
  
  if (!clinicDoctor) {
    return { valid: false, error: 'Doctor is not associated with any clinic' };
  }

  if (clinicDoctor.clinic_id !== clinicId) {
    return { valid: false, error: 'Doctor does not have access to this clinic' };
  }

  if (!clinicDoctor.is_active) {
    return { valid: false, error: 'Doctor is not active in this clinic' };
  }

  return { valid: true, clinicDoctor };
}

/**
 * Valida que una cita pertenezca al médico y a su clínica
 */
export async function validateAppointmentAccess(
  authContext: AuthContext,
  appointmentId: string
): Promise<{ valid: boolean; appointment?: any; clinicDoctor?: any; error?: string }> {
  const prisma = getPrismaClient();
  
  const clinicDoctor = await getClinicDoctor(authContext);
  if (!clinicDoctor || !clinicDoctor.clinic_id) {
    return { valid: false, error: 'Doctor is not associated with any clinic' };
  }

  const appointment = await prisma.appointments.findFirst({
    where: {
      id: appointmentId,
      clinic_id: clinicDoctor.clinic_id,
      provider_id: clinicDoctor.user_id,
    },
    include: {
      patients: {
        include: {
          users: {
            select: { email: true }
          }
        }
      },
      clinics: true,
    },
  });

  if (!appointment) {
    return { valid: false, error: 'Appointment not found or access denied' };
  }

  return { valid: true, appointment, clinicDoctor };
}
