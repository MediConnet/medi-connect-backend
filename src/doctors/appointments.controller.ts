import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
// Importamos los enums necesarios (Asegúrate de haber hecho 'prisma generate' tras los cambios en el schema)
import { enum_appt_status, enum_payment_method, enum_roles } from '../generated/prisma/client';
import { AuthContext, requireRole } from '../shared/auth';
import { getPrismaClient } from '../shared/prisma';
import { errorResponse, successResponse, paginatedResponse } from '../shared/response';
import { parseBody, updateAppointmentStatusSchema } from '../shared/validators';
import { emitToUser } from '../shared/realtime';
import { notifyAppointmentConfirmed, notifyAppointmentCancelled } from '../shared/notifications';

export async function getAppointments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    console.log('✅ [DOCTORS] GET /api/doctors/appointments - Obteniendo citas');
    
    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) {
      console.log('⚠️ [DOCTORS] Provider no encontrado para este usuario');
      return paginatedResponse([], 0, 1, 50);
    }

    const queryParams = event.queryStringParameters || {};
    
    // Validamos que el status que viene por URL sea válido según el Enum
    let statusFilter: enum_appt_status | undefined;
    if (queryParams.status && Object.values(enum_appt_status).includes(queryParams.status as enum_appt_status)) {
      statusFilter = queryParams.status as enum_appt_status;
    }

    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '50', 10);
    const offset = (page - 1) * limit;

    const whereClause = {
      provider_id: provider.id,
      ...(statusFilter && { status: statusFilter }),
    };

    const [appointments, total] = await Promise.all([
      prisma.appointments.findMany({
        where: whereClause,
        include: {
          patients: {
            select: {
              id: true,
              full_name: true,
              phone: true,
              users: {
                select: {
                  email: true,
                  profile_picture_url: true,
                },
              },
            },
          },
          provider_branches: {
            select: {
              id: true,
              name: true,
              address_text: true,
              google_maps_url: true,
              latitude: true,
              longitude: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount_total: true,
              status: true,
            },
            take: 1, 
          }
        },
        orderBy: { scheduled_for: 'asc' }, 
        take: limit,
        skip: offset,
      }),
      
      prisma.appointments.count({
        where: whereClause,
      }),
    ]);

    const formattedAppointments = appointments.map(appt => {
      
      // --- Lógica de Información de Pago ---
      let methodLabel = 'Efectivo';
      let finalAmount = Number(appt.cost || 0); 
      
      if (appt.payment_method === enum_payment_method.CARD) {
        methodLabel = 'Tarjeta';
        const stripePayment = appt.payments?.[0];
        if (stripePayment && stripePayment.amount_total) {
          finalAmount = Number(stripePayment.amount_total);
        }
      } else {
        methodLabel = 'Efectivo';
      }

      const paymentDetails = {
        method_label: methodLabel,
        amount: finalAmount,
        is_paid: appt.is_paid ?? false, 
      };

      return {
        ...appt,
        scheduled_for: appt.scheduled_for?.toISOString() || null,
        
        patients: appt.patients ? {
          id: appt.patients.id,
          full_name: appt.patients.full_name,
          phone: appt.patients.phone,
          email: appt.patients.users?.email || null,
          profile_picture_url: appt.patients.users?.profile_picture_url || null,
        } : null,
        provider_branch: appt.provider_branches
          ? {
              id: appt.provider_branches.id,
              name: appt.provider_branches.name,
              address: appt.provider_branches.address_text || null,
              google_maps_url: appt.provider_branches.google_maps_url || null,
              latitude: appt.provider_branches.latitude ?? null,
              longitude: appt.provider_branches.longitude ?? null,
            }
          : null,
        notes: appt.reception_notes || null,

        payment_details: paymentDetails,
        
        payments: undefined 
      };
    });

    return paginatedResponse(formattedAppointments, total, page, limit);

  } catch (error) {
    console.error('❌ [DOCTORS] Error getting appointments:', error);
    // Orden corregido: Mensaje, luego Código
    return errorResponse('Error interno al obtener las citas', 500);
  }
}

/**
 * Actualizar estado de una cita 
 */
export async function updateAppointmentStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, [enum_roles.provider]);
    if ('statusCode' in authResult) return authResult;
    
    const authContext = authResult as AuthContext;
    const prisma = getPrismaClient();

    let appointmentId = event.pathParameters?.id;

    if (!appointmentId && event.requestContext?.http?.path) {
        const pathParts = event.requestContext.http.path.split('/');
        if (pathParts.length >= 2) {
            appointmentId = pathParts[pathParts.length - 2];
        }
    }

    if (!appointmentId) return errorResponse('ID de cita requerido', 400);

    const { status } = parseBody(event.body, updateAppointmentStatusSchema); 
    const newStatus = status as enum_appt_status; 

    console.log(`✅ [DOCTORS] UPDATE Status cita ${appointmentId} a ${newStatus}`);

    const provider = await prisma.providers.findFirst({
      where: { user_id: authContext.user.id },
    });

    if (!provider) return errorResponse('Proveedor no encontrado', 404);

    const existingAppointment = await prisma.appointments.findFirst({
      where: { id: appointmentId, provider_id: provider.id },
      include: {
        patients: { include: { users: { select: { email: true } } } },
        providers: { select: { commercial_name: true } },
        clinics: { select: { name: true } },
      },
    });

    if (!existingAppointment) {
      return errorResponse('Cita no encontrada o no pertenece al doctor', 404);
    }

    // --- LÓGICA DE NEGOCIO ---
    let isPaidUpdate = existingAppointment.is_paid; 

    if (
      newStatus === enum_appt_status.COMPLETED && 
      existingAppointment.payment_method === enum_payment_method.CASH
    ) {
      isPaidUpdate = true;
    }
    
    if (
      newStatus === enum_appt_status.CONFIRMED && 
      existingAppointment.payment_method === enum_payment_method.CASH
    ) {
      isPaidUpdate = false;
    }

    // Reembolso Automático Nuvei si el doctor cancela una cita pagada
    if (newStatus === enum_appt_status.CANCELLED && existingAppointment.is_paid) {
      const paidPayment = await prisma.payments.findFirst({
        where: {
          appointment_id: appointmentId,
          status: "PAID",
        },
      });

      if (paidPayment && paidPayment.external_transaction_id) {
        console.log(`📡 [REFUND-DOCTOR] Médico cancela cita. Reembolsando transacción de Nuvei: ${paidPayment.external_transaction_id}`);
        const { nuveiService } = await import("../payments/nuvei.service");

        try {
          const refundResult = await nuveiService.refund({
            transactionId: paidPayment.external_transaction_id,
            amount: Number(paidPayment.amount_total) || undefined,
          });

          console.log("📡 [REFUND-DOCTOR] Respuesta de Nuvei:", JSON.stringify(refundResult));

          if (refundResult?.transaction?.status === "error" || refundResult?.error) {
            console.error("❌ [REFUND-DOCTOR] Falló el reembolso en Nuvei:", refundResult);
            return errorResponse("No se pudo procesar el reembolso en la pasarela. Cita no cancelada.", 400);
          }

          // Actualizar estado del pago a REFUNDED en la base de datos
          await prisma.payments.update({
            where: { id: paidPayment.id },
            data: { status: "REFUNDED" },
          });

          // Cancelar payout asociado si existe
          if (paidPayment.payout_id) {
            await prisma.payouts.update({
              where: { id: paidPayment.payout_id },
              data: { status: "cancelled" },
            }).catch((err: any) => console.error("❌ [REFUND-DOCTOR] Error al cancelar payout:", err.message));
          }

          // Enviar correo de reembolso completado (asíncrono)
          const aptPatient = (existingAppointment as any).patients;
          if (aptPatient?.users?.email) {
            const { sendEmail } = await import("../shared/email-adapter");
            const { generateRefundCompletedEmail } = await import("../shared/email");
            const scheduledDate = existingAppointment.scheduled_for ? new Date(existingAppointment.scheduled_for) : new Date();
            const dateStr = scheduledDate.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" });
            const timeStr = scheduledDate.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

            sendEmail({
              to: aptPatient.users.email,
              subject: "Confirmación de Reembolso - DOCALINK",
              html: generateRefundCompletedEmail({
                patientName: aptPatient.full_name || "Paciente",
                doctorName: (existingAppointment as any).providers?.commercial_name || "Médico",
                clinicName: (existingAppointment as any).clinics?.name || "Docalink",
                date: dateStr,
                time: timeStr,
                amount: Number(paidPayment.amount_total) || 0,
                transactionId: paidPayment.external_transaction_id || "N/A",
              }),
            }).then(() => console.log(`✉️ [REFUND-DOCTOR] Correo de reembolso enviado a: ${aptPatient.users.email}`))
              .catch((err: any) => console.error("❌ [REFUND-DOCTOR] Error enviando email de reembolso:", err.message));
          }
        } catch (refundError: any) {
          console.error("❌ [REFUND-DOCTOR] Error de conexión al reembolsar:", refundError.message);
          return errorResponse("Error de conexión al procesar el reembolso en la pasarela.", 500);
        }
      }
    }

    const updatedAppointment = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        status: newStatus,
        is_paid: isPaidUpdate
      }
    });

    // Realtime: appointment:updated (doctor + patient)
    try {
      const providerUserId = provider.user_id as string | undefined;
      if (providerUserId) {
        emitToUser(providerUserId, 'appointment:updated', {
          appointmentId,
          status: updatedAppointment.status,
        });
      }

      const patient = await prisma.patients.findUnique({
        where: { id: updatedAppointment.patient_id || '' },
        select: { user_id: true, full_name: true },
      });
      if (patient?.user_id) {
        emitToUser(patient.user_id, 'appointment:updated', {
          appointmentId,
          status: updatedAppointment.status,
        });
      }
    } catch (e) {
      // do not block response
    }

    // Enviar notificaciones según el estado (no bloquea la respuesta)
    if (newStatus === enum_appt_status.CONFIRMED || newStatus === enum_appt_status.CANCELLED) {
      prisma.appointments.findFirst({
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
          providers: {
            select: {
              commercial_name: true,
              user_id: true,
            }
          }
        },
      }).then(async (appointmentWithDetails) => {
        if (appointmentWithDetails) {
          const doctor = appointmentWithDetails.providers?.user_id 
            ? await prisma.clinic_doctors.findFirst({
                where: {
                  clinic_id: appointmentWithDetails.clinic_id || '',
                  user_id: appointmentWithDetails.providers.user_id,
                },
                include: {
                  users: true,
                },
              })
            : null;

          const doctorData = doctor || {
            name: provider.commercial_name,
            email: authContext.user.email,
            is_active: true
          };

          if (newStatus === enum_appt_status.CONFIRMED) {
            await notifyAppointmentConfirmed(
              appointmentWithDetails,
              appointmentWithDetails.clinics,
              doctorData,
              appointmentWithDetails.patients
            );
          } else if (newStatus === enum_appt_status.CANCELLED) {
            await notifyAppointmentCancelled(
              appointmentWithDetails,
              appointmentWithDetails.clinics,
              doctorData,
              appointmentWithDetails.patients
            );
          }
        }
      }).catch(err => {
        console.error('Error en notificaciones de actualización de cita:', err);
      });
    }

    return successResponse({
      success: true,
      message: 'Estado de cita actualizado correctamente',
      data: updatedAppointment
    });

  } catch (error) {
    console.error('❌ [DOCTORS] Error updating appointment status:', error);
    const message = error instanceof Error ? error.message : 'Error interno';
    const statusCode = message.includes('Validation error') ? 400 : 500;
    
    return errorResponse(message, statusCode);
  }
}