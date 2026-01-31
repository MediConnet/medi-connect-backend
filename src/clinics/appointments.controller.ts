import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { logger } from '../shared/logger';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, internalErrorResponse, notFoundResponse, successResponse } from '../shared/response';
import { parseBody, updateAppointmentStatusClinicSchema, updateReceptionStatusSchema, extractIdFromPath } from '../shared/validators';
import { notifyAppointmentCancelled, notifyAppointmentConfirmed } from '../shared/notifications';

// GET /api/clinics/appointments
export async function getAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/appointments - Obteniendo citas de la clínica');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/appointments - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const queryParams = event.queryStringParameters || {};

  try {
    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Construir filtros
    const where: any = { clinic_id: clinic.id };

    // ⭐ Si no hay parámetros, devolver TODAS las citas (para gráficos)
    // Los filtros son opcionales y se aplican solo si se envían

    if (queryParams.date) {
      const date = new Date(queryParams.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.scheduled_for = {
        gte: date,
        lt: nextDay,
      };
    }

    if (queryParams.doctorId) {
      // Buscar el provider_id que corresponde al doctorId (user_id del doctor)
      const clinicDoctor = await prisma.clinic_doctors.findFirst({
        where: {
          clinic_id: clinic.id,
          id: queryParams.doctorId, // doctorId puede ser el id de clinic_doctors
        },
        select: {
          user_id: true,
        },
      });

      if (clinicDoctor?.user_id) {
        // Buscar el provider_id que corresponde a este user_id
        const provider = await prisma.providers.findFirst({
          where: {
            user_id: clinicDoctor.user_id,
          },
          select: {
            id: true,
          },
        });
        if (provider) {
          where.provider_id = provider.id;
        }
      } else {
        // Si no se encuentra, intentar usar directamente como provider_id
        where.provider_id = queryParams.doctorId;
      }
    }

    if (queryParams.status) {
      // Mapear estados del frontend a estados de la BD
      const statusMap: Record<string, string> = {
        'scheduled': 'CONFIRMED',
        'confirmed': 'CONFIRMED',
        'attended': 'attended',
        'cancelled': 'CANCELLED',
        'no_show': 'CANCELLED',
      };
      where.status = statusMap[queryParams.status.toLowerCase()] || queryParams.status.toUpperCase();
    }

    // Obtener citas con relaciones
    const appointments = await prisma.appointments.findMany({
      where,
      include: {
        providers: {
          select: {
            id: true,
            commercial_name: true,
            user_id: true,
          },
        },
        patients: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            users: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        scheduled_for: 'desc',
      },
    });

    // Obtener información de médicos de la clínica
    // Necesitamos obtener los user_id de los providers para buscar en clinic_doctors
    const providerIds = appointments
      .map(apt => apt.provider_id)
      .filter((id): id is string => id !== null);
    
    // Obtener los user_id de los providers
    const providers = providerIds.length > 0
      ? await prisma.providers.findMany({
          where: {
            id: { in: providerIds },
          },
          select: {
            id: true,
            user_id: true,
            commercial_name: true,
          },
        })
      : [];

    const providerUserIds = providers
      .map(p => p.user_id)
      .filter((id): id is string => id !== null);
    
    // Obtener información de médicos de la clínica usando user_id
    const clinicDoctors = providerUserIds.length > 0
      ? await prisma.clinic_doctors.findMany({
          where: {
            clinic_id: clinic.id,
            user_id: { in: providerUserIds },
          },
          select: {
            id: true,
            user_id: true,
            name: true,
            specialty: true,
          },
        })
      : [];

    // Crear mapas para búsqueda rápida
    const providerToUserIdMap = new Map(providers.map(p => [p.id, p.user_id]));
    const doctorMap = new Map(clinicDoctors.map(doc => [doc.user_id, doc]));
    const providerNameMap = new Map(providers.map(p => [p.id, p.commercial_name]));

    // Normalizar estados de BD a formato del frontend
    const normalizeStatus = (dbStatus: string | null): string => {
      if (!dbStatus) return 'scheduled';
      const status = dbStatus.toUpperCase();
      if (status === 'CONFIRMED') return 'confirmed';
      if (status === 'CANCELLED') return 'cancelled';
      if (status === 'attended' || status === 'ATTENDED') return 'attended';
      return 'scheduled';
    };

    console.log(`✅ [CLINICS] Citas obtenidas exitosamente (${appointments.length} citas)`);
    return successResponse(
      appointments.map((apt) => {
        const scheduledFor = apt.scheduled_for ? new Date(apt.scheduled_for) : null;
        
        // Obtener información del doctor
        const providerUserId = apt.provider_id ? providerToUserIdMap.get(apt.provider_id) : null;
        const doctor = providerUserId ? doctorMap.get(providerUserId) : null;
        const providerName = apt.provider_id ? providerNameMap.get(apt.provider_id) : null;
        
        // Formatear fecha y hora
        const date = scheduledFor ? scheduledFor.toISOString().split('T')[0] : null; // YYYY-MM-DD
        const time = scheduledFor 
          ? `${String(scheduledFor.getHours()).padStart(2, '0')}:${String(scheduledFor.getMinutes()).padStart(2, '0')}` 
          : null; // HH:mm

        return {
          id: apt.id,
          clinicId: apt.clinic_id || null,
          doctorId: apt.provider_id || null, // ⭐ provider_id como doctorId
          doctorName: doctor?.name || providerName || 'Médico', // ⭐ REQUERIDO para gráficos
          doctorSpecialty: doctor?.specialty || null, // ⭐ REQUERIDO para gráficos
          patientId: apt.patient_id || null,
          patientName: apt.patients?.full_name || 'Paciente',
          patientPhone: apt.patients?.phone || null,
          patientEmail: apt.patients?.users?.email || null,
          date: date, // ⭐ Formato: YYYY-MM-DD
          time: time, // ⭐ Formato: HH:mm
          reason: apt.reason || null,
          status: normalizeStatus(apt.status), // ⭐ Valores: scheduled, confirmed, attended, cancelled, no_show
          receptionStatus: apt.reception_status || null,
          receptionNotes: apt.reception_notes || null,
          createdAt: null, // ⚠️ appointments no tiene created_at en el schema
          updatedAt: null, // ⚠️ appointments no tiene updated_at en el schema
        };
      })
    );
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener citas:`, error.message);
    logger.error('Error getting appointments', error);
    return internalErrorResponse('Failed to get appointments');
  }
}

// PATCH /api/clinics/appointments/:appointmentId/status
export async function updateAppointmentStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PATCH /api/clinics/appointments/{id}/status - Actualizando estado de cita');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PATCH /api/clinics/appointments/{id}/status - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const appointmentId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/appointments/', '/status');
    const body = parseBody(event.body, updateAppointmentStatusClinicSchema);

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Verificar que la cita pertenece a la clínica
    const appointment = await prisma.appointments.findFirst({
      where: {
        id: appointmentId,
        clinic_id: clinic.id,
      },
    });

    if (!appointment) {
      console.error(`❌ [CLINICS] Cita no encontrada: ${appointmentId}`);
      return notFoundResponse('Appointment not found');
    }

    // Mapear estados
    const statusMap: Record<string, string> = {
      'scheduled': 'CONFIRMED',
      'confirmed': 'CONFIRMED',
      'attended': 'attended',
      'cancelled': 'CANCELLED',
      'no_show': 'CANCELLED',
    };

    const dbStatus = statusMap[body.status] || body.status.toUpperCase();

    // Actualizar estado
    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: { status: dbStatus },
    });

    // Enviar notificaciones según el estado (no bloquea la respuesta)
    if (body.status === 'cancelled' || body.status === 'no_show') {
      // Obtener datos completos para notificaciones
      const appointmentWithDetails = await prisma.appointments.findFirst({
        where: { id: appointmentId },
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
      
      if (appointmentWithDetails && appointmentWithDetails.clinic_id && appointmentWithDetails.provider_id) {
        // Obtener el doctor desde clinic_doctors
        const doctor = await prisma.clinic_doctors.findFirst({
          where: {
            clinic_id: appointmentWithDetails.clinic_id,
            user_id: appointmentWithDetails.provider_id,
          },
          include: {
            users: true,
          },
        });
        
        // Enviar notificaciones de cancelación (no bloquea la respuesta)
        notifyAppointmentCancelled(
          appointmentWithDetails,
          appointmentWithDetails.clinics,
          doctor,
          appointmentWithDetails.patients
        ).catch(err => {
          console.error('❌ [CLINICS] Error en notificaciones de cancelación:', err);
        });
      }
    }

    // Si se confirma, programar recordatorio
    if (body.status === 'confirmed') {
      const appointmentWithDetails = await prisma.appointments.findFirst({
        where: { id: appointmentId },
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
      
      if (appointmentWithDetails && appointmentWithDetails.clinic_id && appointmentWithDetails.provider_id) {
        // Obtener el doctor desde clinic_doctors
        const doctor = await prisma.clinic_doctors.findFirst({
          where: {
            clinic_id: appointmentWithDetails.clinic_id,
            user_id: appointmentWithDetails.provider_id,
          },
        });
        
        notifyAppointmentConfirmed(
          appointmentWithDetails,
          appointmentWithDetails.clinics,
          doctor,
          appointmentWithDetails.patients
        ).catch(err => {
          console.error('❌ [CLINICS] Error en notificaciones de confirmación:', err);
        });
      }
    }

    console.log(`✅ [CLINICS] Estado de cita actualizado: ${appointmentId} -> ${body.status}`);
    return successResponse({
      id: updatedAppointment.id,
      status: body.status,
      updatedAt: updatedAppointment.scheduled_for?.toISOString() || null,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al actualizar estado de cita:`, error.message);
    logger.error('Error updating appointment status', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update appointment status');
  }
}

// GET /api/clinics/reception/today
export async function getTodayReception(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] GET /api/clinics/reception/today - Obteniendo citas del día para recepción');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] GET /api/clinics/reception/today - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Obtener citas de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await prisma.appointments.findMany({
      where: {
        clinic_id: clinic.id,
        scheduled_for: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        providers: {
          select: {
            commercial_name: true,
            user_id: true,
          },
        },
        patients: {
          select: {
            full_name: true,
          },
        },
      },
      orderBy: {
        scheduled_for: 'asc',
      },
    });

    // Obtener información de médicos
    const providerIds = appointments
      .map(apt => apt.provider_id)
      .filter((id): id is string => id !== null);
    
    const clinicDoctors = providerIds.length > 0
      ? await prisma.clinic_doctors.findMany({
          where: {
            clinic_id: clinic.id,
            user_id: { in: providerIds },
          },
          select: {
            user_id: true,
            name: true,
            specialty: true,
          },
        })
      : [];

    const doctorMap = new Map(clinicDoctors.map(doc => [doc.user_id, doc]));

    console.log(`✅ [CLINICS] Citas del día obtenidas exitosamente (${appointments.length} citas)`);
    return successResponse(
      appointments.map((apt) => {
        const scheduledFor = apt.scheduled_for ? new Date(apt.scheduled_for) : null;
        const doctor = apt.provider_id ? doctorMap.get(apt.provider_id) : null;
        return {
          id: apt.id,
          time: scheduledFor ? `${String(scheduledFor.getHours()).padStart(2, '0')}:${String(scheduledFor.getMinutes()).padStart(2, '0')}` : null,
          patientName: apt.patients?.full_name || 'Paciente',
          doctorName: doctor?.name || apt.providers?.commercial_name || 'Médico',
          doctorSpecialty: doctor?.specialty || null,
          receptionStatus: apt.reception_status || null,
          receptionNotes: apt.reception_notes || null,
        };
      })
    );
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al obtener citas del día:`, error.message);
    logger.error('Error getting today reception', error);
    return internalErrorResponse('Failed to get today reception');
  }
}

// PATCH /api/clinics/appointments/:appointmentId/reception
export async function updateReceptionStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  console.log('✅ [CLINICS] PATCH /api/clinics/appointments/{id}/reception - Actualizando estado de recepción');
  
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ('statusCode' in authResult) {
    console.error('❌ [CLINICS] PATCH /api/clinics/appointments/{id}/reception - Error de autenticación/autorización');
    return authResult;
  }

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const appointmentId = extractIdFromPath(event.requestContext.http.path, '/api/clinics/appointments/', '/reception');
    const body = parseBody(event.body, updateReceptionStatusSchema);

    // Buscar clínica del usuario autenticado
    const clinic = await prisma.clinics.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!clinic) {
      console.error('❌ [CLINICS] Clínica no encontrada');
      return notFoundResponse('Clinic not found');
    }

    // Verificar que la cita pertenece a la clínica
    const appointment = await prisma.appointments.findFirst({
      where: {
        id: appointmentId,
        clinic_id: clinic.id,
      },
    });

    if (!appointment) {
      console.error(`❌ [CLINICS] Cita no encontrada: ${appointmentId}`);
      return notFoundResponse('Appointment not found');
    }

    // Actualizar estado de recepción
    const updateData: any = {
      reception_status: body.receptionStatus,
    };
    if (body.receptionNotes !== undefined) {
      updateData.reception_notes = body.receptionNotes || null;
    }

    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: updateData,
    });

    console.log(`✅ [CLINICS] Estado de recepción actualizado: ${appointmentId}`);
    return successResponse({
      id: updatedAppointment.id,
      receptionStatus: updatedAppointment.reception_status,
      receptionNotes: updatedAppointment.reception_notes,
      updatedAt: updatedAppointment.scheduled_for?.toISOString() || null,
    });
  } catch (error: any) {
    console.error(`❌ [CLINICS] Error al actualizar estado de recepción:`, error.message);
    logger.error('Error updating reception status', error);
    if (error.message.includes('Validation error') || error.message.includes('Invalid path format')) {
      return errorResponse(error.message, 400);
    }
    return internalErrorResponse('Failed to update reception status');
  }
}
