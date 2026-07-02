import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomBytes, randomUUID, createHash } from "crypto";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from "../shared/response";
import { nuveiService } from "./nuvei.service";
import { PAYOUT_TYPE_CLINIC, PAYOUT_TYPE_DOCTOR } from "../shared/constants";

/**
 * Genera un ID de transacción corto y único (Máx 15 chars)
 * Formato: TX-xxxxxxxxx
 */
const generateClientTransactionId = (): string => {
  const randomPart = randomBytes(6).toString("hex").toUpperCase();
  return `TX-${randomPart}`;
};

/**
 * Helper para enviar el correo de confirmación de pago obligatorio requerido por Nuvei
 */
async function sendPaymentConfirmationEmailHelper(
  appointmentId: string,
  amount: number,
  transactionId: string,
  authorizationCode: string
) {
  try {
    const prisma = getPrismaClient();
    const appointment = await prisma.appointments.findUnique({
      where: { id: appointmentId },
      include: {
        patients: {
          include: {
            users: true,
          },
        },
        providers: true,
        specialties: true,
        clinics: true,
      },
    });

    if (!appointment || !appointment.patients?.users?.email) {
      console.warn(`⚠️ [PAYMENTS] No se pudo enviar el correo de confirmación: Cita o email del paciente no encontrado.`);
      return;
    }

    const patientName = appointment.patients?.full_name || "Paciente";
    
    const doctorName = appointment.providers?.commercial_name || "Médico";
    const doctorSpecialty = appointment.specialties?.name || "Medicina General";
    const clinicName = appointment.clinics?.name || "DocaLink";
    
    const formattedDate = appointment.scheduled_for ? appointment.scheduled_for.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }) : "";
    
    const formattedTime = appointment.scheduled_for ? appointment.scheduled_for.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    }) : "";

    const { sendEmail } = await import("../shared/email-adapter");
    const { generatePaymentConfirmationEmail } = await import("../shared/email");

    const emailHtml = generatePaymentConfirmationEmail({
      patientName,
      doctorName,
      doctorSpecialty,
      clinicName,
      date: formattedDate,
      time: formattedTime,
      amount,
      transactionId,
      authorizationCode,
    });

    await sendEmail({
      to: appointment.patients.users.email,
      subject: `Comprobante de Pago - Cita con Dr(a). ${doctorName}`,
      html: emailHtml,
    });

    console.log(`✉️ [PAYMENTS] Correo de confirmación de pago enviado a: ${appointment.patients.users.email}`);
  } catch (err: any) {
    console.error("❌ [PAYMENTS] Error al enviar correo de confirmación de pago:", err.message);
  }
}

/**
 * Procesa un pago directo con tarjeta tokenizada usando Nuvei (Paymentez)
 * POST /api/payments/charge
 */
export async function processNuveiPayment(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("💰 [PAYMENTS] Iniciando procesamiento de pago con Nuvei...");

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) return authResult;
  const authContext = authResult as AuthContext;

  const prisma = getPrismaClient();

  try {
    let body;
    try {
      body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return errorResponse("Invalid JSON body", 400);
    }

    if (!body || !body.appointmentId || !body.cardToken) {
      return errorResponse("Los campos appointmentId y cardToken son requeridos", 400);
    }

    const cardType = (body.cardType || "credit").toLowerCase();
    if (cardType !== "credit" && cardType !== "debit") {
      return errorResponse("El tipo de tarjeta debe ser 'credit' o 'debit'", 400);
    }

    const appointment = await prisma.appointments.findUnique({
      where: { id: body.appointmentId },
      include: {
        patients: {
          include: {
            users: true
          }
        },
        providers: true,
        provider_branches: true,
      },
    });

    if (!appointment) return notFoundResponse("Cita no encontrada");

    // Validar seguridad
    if (appointment.patients?.user_id !== authContext.user.id) {
      return errorResponse("No tienes permiso para pagar esta cita", 403);
    }

    // Validar estado
    if (!["PENDING_PAYMENT", "PROCESSING"].includes(appointment.status || "")) {
      return errorResponse(
        `No se puede pagar una cita en estado: ${appointment.status}`,
        400,
      );
    }

    if (appointment.is_paid) {
      return errorResponse("Esta cita ya se encuentra pagada", 400);
    }

    const costDecimal = Number(appointment.cost);

    console.log(`💰 [DEBUG] Costo Consulta (USD): ${costDecimal}`);

    if (isNaN(costDecimal) || costDecimal <= 0) {
      return errorResponse(
        `El costo de la consulta ($${costDecimal}) no es válido para procesar el pago.`,
        400,
      );
    }

    // Obtener comisiones desde la base de datos (admin_settings)
    let settings = await prisma.admin_settings.findUnique({
      where: { id: 1 },
    });
    if (!settings) {
      settings = await prisma.admin_settings.create({
        data: { id: 1 },
      });
    }

    const commissionPercent = appointment.clinic_id
      ? Number(settings.commission_clinic)
      : Number(settings.commission_doctor);

    const platformFee = Number((costDecimal * (commissionPercent / 100)).toFixed(2));
    const providerAmount = Number((costDecimal - platformFee).toFixed(2));

    // Cálculo informativo del costo de Nuvei + Banco
    let gatewayFee = 0;
    if (cardType === "credit") {
      // 6.345% del total + $0.046 (3DS)
      gatewayFee = Number((costDecimal * 0.06345 + 0.046).toFixed(2));
    } else {
      // 2.875% del total + $0.046 (3DS)
      gatewayFee = Number((costDecimal * 0.02875 + 0.046).toFixed(2));
    }

    console.log(
      `💰 [DEBUG] Comisión plataforma (${commissionPercent}%): $${platformFee} | Fee Nuvei: $${gatewayFee} | Neto médico: $${providerAmount}`
    );

    const clientTransactionId = generateClientTransactionId();

    const doctorName = appointment.providers?.commercial_name || "Doctor";
    const branchName = appointment.provider_branches?.name || "Consultorio";
    const description = `Consulta - ${doctorName} (${branchName})`;

    // Registrar el pago inicialmente como PENDING
    const paymentId = randomUUID();
    const payment = await prisma.payments.create({
      data: {
        id: paymentId,
        appointment_id: appointment.id,
        amount_total: costDecimal,
        provider_amount: providerAmount,
        platform_fee: platformFee,
        gateway_fee: gatewayFee,
        status: "PENDING",
        payment_source: "NUVEI",
        payment_method: cardType.toUpperCase(),
        external_transaction_id: clientTransactionId,
        clinic_id: appointment.clinic_id || null,
      },
    });

    // Calcular IVA 15% requerido por el perfil de la cuenta de Nuvei
    const vat = Number((costDecimal * 0.15 / 1.15).toFixed(2));
    const taxableAmount = Number((costDecimal - vat).toFixed(2));

    // Llamar a la API de Nuvei para procesar el cargo
    const nuveiResult = await nuveiService.debitWithToken({
      cardToken: body.cardToken,
      userId: authContext.user.id,
      userEmail: appointment.patients?.users?.email || authContext.user.email || "paciente@docalink.com",
      userPhone: body.userPhone || undefined,
      amount: costDecimal,
      description: description,
      devReference: clientTransactionId,
      vat,
      taxableAmount,
    });

    console.log("📡 [NUVEI] Respuesta recibida:", JSON.stringify(nuveiResult));

    const status = nuveiResult?.transaction?.status || "";
    const statusDetail = Number(nuveiResult?.transaction?.status_detail);
    const transactionId = nuveiResult?.transaction?.id;
    const authorizationCode = nuveiResult?.transaction?.authorization_code;

    // Transacción Exitosa: Status "success" y status_detail 3
    if (status === "success" && statusDetail === 3) {
      await prisma.payments.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
        },
      });

      const updatedApp = await prisma.appointments.update({
        where: { id: appointment.id },
        data: {
          status: "CONFIRMED",
          is_paid: true,
        },
        include: {
          providers: { select: { commercial_name: true } },
          clinics: { select: { name: true } },
        },
      });

      // Enviar correo de confirmación de pago obligatorio requerido por Nuvei
      sendPaymentConfirmationEmailHelper(
        appointment.id,
        costDecimal,
        transactionId || "N/A",
        authorizationCode || "AUT-N/A"
      ).catch(err => console.error("❌ [PAYMENTS] Error en envío de email de confirmación:", err));

      // Enviar notificaciones push
      if (updatedApp.patient_id) {
        const formattedDoctorName = updatedApp.providers?.commercial_name || "Médico";
        const clinicName = updatedApp.clinics?.name || formattedDoctorName;
        const formattedDate = updatedApp.scheduled_for ? updatedApp.scheduled_for.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }) : "";
        const formattedTime = updatedApp.scheduled_for ? updatedApp.scheduled_for.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }) : "";

        const { patientNotificationService } = await import("../shared/patient-notification.service");
        await patientNotificationService.create({
          patientId: updatedApp.patient_id,
          type: "cita",
          title: "Pago Exitoso y Cita Confirmada",
          body: `Tu pago fue procesado con éxito. Tu cita con Dr(a). ${formattedDoctorName} en ${clinicName} está confirmada para el ${formattedDate} a las ${formattedTime}.`,
          data: {
            targetScreen: "Citas",
            appointmentId: updatedApp.id,
          },
        }).catch((err: any) => console.error("❌ [PAYMENTS] Error enviando push:", err.message));
      }

      // Crear el payout correspondiente (clínica o médico independiente)
      const payoutId = randomUUID();
      const isClinicAppointment = !!updatedApp.clinic_id;
      let finalProviderId = appointment.provider_id || null;

      if (isClinicAppointment && updatedApp.clinic_id) {
        finalProviderId = updatedApp.clinic_id;
        
        // Bypassear el constraint de llave foránea creando un provider placeholder para la clínica si no existe
        const existingProvider = await prisma.providers.findUnique({
          where: { id: updatedApp.clinic_id }
        });
        
        if (!existingProvider) {
          console.log(`🏥 [PAYMENTS] Creando provider placeholder para clínica: ${updatedApp.clinic_id}`);
          const clinic = await prisma.clinics.findUnique({
            where: { id: updatedApp.clinic_id }
          });
          
          await prisma.providers.create({
            data: {
              id: updatedApp.clinic_id,
              user_id: clinic?.user_id || null,
              commercial_name: clinic?.name || "Clínica",
              verification_status: "APPROVED"
            }
          }).catch((err: any) => console.error("❌ [PAYMENTS] Error creando provider placeholder para clínica:", err.message));
        }
      }

      await prisma.payouts.create({
        data: {
          id: payoutId,
          provider_id: finalProviderId,
          total_amount: providerAmount,
          currency: "USD",
          status: "pending",
          payout_type: isClinicAppointment ? PAYOUT_TYPE_CLINIC : PAYOUT_TYPE_DOCTOR,
          payments: { connect: { id: payment.id } },
        },
      });
      console.log(`📦 [PAYMENTS] Payout creado: tipo=${isClinicAppointment ? "clinic" : "doctor"}, monto=$${providerAmount}`);

      console.log(`✅ [PAYMENTS] Transacción ${transactionId} aprobada y cita confirmada.`);

      return successResponse({
        status: "success",
        transactionId: transactionId,
        authorizationCode: authorizationCode,
        amount: costDecimal,
      });
    } else {
      // Transacción rechazada o fallida
      await prisma.payments.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });

      console.warn(`❌ [PAYMENTS] Pago fallido. Status: ${status}, Detail: ${statusDetail}`);
      return errorResponse(
        nuveiResult?.transaction?.message || "La transacción fue rechazada. Por favor verifica tus fondos o intenta con otra tarjeta.",
        400
      );
    }

  } catch (error: any) {
    let detailedError = error.message;
    if (error.response?.data) {
      detailedError = JSON.stringify(error.response.data);
    }
    console.error(`❌ Error en processNuveiPayment:`, detailedError);
    logger.error("Payment processing failed", error);

    return internalErrorResponse(
      "No se pudo procesar el pago. Por favor intenta de nuevo."
    );
  }
}

/**
 * Webhook/Callback de Nuvei (Paymentez)
 * Recibe notificaciones asíncronas de la pasarela
 */
export async function handleNuveiWebhook(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("🔔 [PAYMENTS] Webhook Nuvei invocado");

  const prisma = getPrismaClient();

  try {
    let body;
    try {
      body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (e) {
      console.error("❌ [WEBHOOK] Error de deserialización:", e);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false }),
      };
    }

    const transaction = body?.transaction;
    const clientTransactionId = transaction?.dev_reference;
    const status = transaction?.status;
    const statusDetail = Number(transaction?.status_detail);
    const transactionId = transaction?.id;

    if (!clientTransactionId) {
      console.warn("⚠️ [WEBHOOK] Sin dev_reference en el cuerpo:", body);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false }),
      };
    }

    const payment = await prisma.payments.findFirst({
      where: { external_transaction_id: clientTransactionId },
    });

    if (!payment) {
      console.warn(`⚠️ [WEBHOOK] Pago no encontrado: ${clientTransactionId}`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false }),
      };
    }

    if (payment.status === "PAID") {
      console.log(`ℹ️ [WEBHOOK] Transacción ya estaba procesada.`);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      };
    }

    if (status === "success" && statusDetail === 3) {
      await prisma.payments.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paid_at: new Date(),
        },
      });

      if (payment.appointment_id) {
        await prisma.appointments.update({
          where: { id: payment.appointment_id },
          data: {
            status: "CONFIRMED",
            is_paid: true,
          },
        });

        // Enviar correo de confirmación de pago obligatorio requerido por Nuvei
        sendPaymentConfirmationEmailHelper(
          payment.appointment_id,
          Number(payment.amount_total) || 0,
          transactionId || "N/A",
          transaction?.authorization_code || "AUT-N/A"
        ).catch(err => console.error("❌ [PAYMENTS] Error en envío de email de confirmación (webhook):", err));
      }

      console.log(`✅ [WEBHOOK] Pago ${transactionId} confirmado vía webhook.`);
    } else {
      await prisma.payments.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      console.log(`❌ [WEBHOOK] Pago ${transactionId} fallido/rechazado.`);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };

  } catch (error: any) {
    console.error("❌ [WEBHOOK] Error interno:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false }),
    };
  }

}

/**
 * Genera el Auth-Token cliente para que la App Móvil pueda tokenizar tarjetas directamente
 * GET /api/payments/client-auth
 */
export async function getClientAuthToken(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("🔑 [PAYMENTS] Generando token de autenticación para cliente móvil...");

  try {
    const appCode = process.env.NUVEI_CLIENT_APP_CODE || "NUVEISTG-EC-CLIENT";
    const appKey = process.env.NUVEI_CLIENT_APP_KEY || "rvpKAv2tc49x6YL38fvtv5jJxRRiPs";

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHash("sha256").update(appKey + timestamp).digest("hex");
    const tokenString = `${appCode};${timestamp};${signature}`;
    const authToken = Buffer.from(tokenString).toString("base64");

    return successResponse({
      authToken,
      clientAppCode: appCode,
      clientAppKey: appKey,
    });
  } catch (error: any) {
    console.error("❌ Error en getClientAuthToken:", error.message);
    return internalErrorResponse("Failed to generate client auth token");
  }
}

/**
 * Inicializa una transacción en Nuvei y devuelve el ID de referencia para el Checkout modal
 * POST /api/payments/init-checkout
 */
export async function initNuveiCheckout(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("💰 [PAYMENTS] Iniciando checkout con initReference en Nuvei...");

  const authResult = await requireAuth(event);
  if ("statusCode" in authResult) return authResult;
  const authContext = authResult as AuthContext;

  const prisma = getPrismaClient();

  try {
    let body;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return errorResponse("Invalid JSON body", 400);
    }

    if (!body || !body.appointmentId) {
      return errorResponse("El campo appointmentId es requerido", 400);
    }

    const appointment = await prisma.appointments.findUnique({
      where: { id: body.appointmentId },
      include: {
        patients: {
          include: {
            users: true
          }
        },
        providers: {
          include: {
            provider_branches: true
          }
        },
      },
    });

    if (!appointment) return notFoundResponse("Cita no encontrada");

    // Validar seguridad
    if (appointment.patients?.user_id !== authContext.user.id) {
      return errorResponse("No tienes permiso para pagar esta cita", 403);
    }

    // Validar estado
    if (!["PENDING_PAYMENT", "PROCESSING"].includes(appointment.status || "")) {
      return errorResponse(
        `No se puede pagar una cita en estado: ${appointment.status}`,
        400,
      );
    }

    if (appointment.is_paid) {
      return errorResponse("Esta cita ya se encuentra pagada", 400);
    }

    const costDecimal = Number(appointment.cost);

    if (isNaN(costDecimal) || costDecimal <= 0) {
      return errorResponse(
        `El costo de la consulta ($${costDecimal}) no es válido para procesar el pago.`,
        400,
      );
    }

    // Obtener comisiones desde la base de datos (admin_settings)
    let settings = await prisma.admin_settings.findUnique({
      where: { id: 1 },
    });
    if (!settings) {
      settings = await prisma.admin_settings.create({
        data: { id: 1 },
      });
    }

    const commissionPercent = appointment.clinic_id
      ? Number(settings.commission_clinic)
      : Number(settings.commission_doctor);

    const platformFee = Number((costDecimal * (commissionPercent / 100)).toFixed(2));
    const providerAmount = Number((costDecimal - platformFee).toFixed(2));

    // Estimar gateway fee usando tarjeta de crédito (6.345% + $0.046) - se ajusta al recibir el webhook
    const gatewayFee = Number((costDecimal * 0.06345 + 0.046).toFixed(2));

    const clientTransactionId = generateClientTransactionId();

    const doctorName = appointment.providers?.commercial_name || "Doctor";
    const branchName = appointment.providers?.provider_branches?.[0]?.name || "Consultorio";
    const description = `Consulta - ${doctorName} (${branchName})`;

    // Registrar el pago inicialmente como PENDING
    const paymentId = randomUUID();
    await prisma.payments.create({
      data: {
        id: paymentId,
        appointment_id: appointment.id,
        amount_total: costDecimal,
        provider_amount: providerAmount,
        platform_fee: platformFee,
        gateway_fee: gatewayFee,
        status: "PENDING",
        payment_source: "NUVEI",
        payment_method: "CARD",
        external_transaction_id: clientTransactionId,
        clinic_id: appointment.clinic_id || null,
      },
    });

    // Calcular IVA 15% requerido por el perfil de la cuenta de Nuvei
    const vat = Number((costDecimal * 0.15 / 1.15).toFixed(2));
    const taxableAmount = Number((costDecimal - vat).toFixed(2));

    // Llamar a Nuvei para inicializar la referencia del checkout
    const nuveiResult = await nuveiService.initReference({
      userId: authContext.user.id,
      userEmail: appointment.patients?.users?.email || authContext.user.email || "paciente@docalink.com",
      amount: costDecimal,
      description: description,
      devReference: clientTransactionId,
      vat,
      taxableAmount,
      phone: appointment.patients?.phone || undefined,
    });

    console.log("📡 [NUVEI] Referencia obtenida exitosamente:", JSON.stringify(nuveiResult));

    const checkoutReference = nuveiResult?.reference;

    if (!checkoutReference) {
      throw new Error("No se pudo obtener el ID de referencia de Nuvei.");
    }

    // Actualizar el pago en DB con la referencia del checkout (opcional, dev_reference ya está guardado)
    await prisma.payments.update({
      where: { id: paymentId },
      data: {
        external_transaction_id: clientTransactionId, // Guardamos devReference para emparejar webhook
      }
    });

    return successResponse({
      reference: checkoutReference,
    });

  } catch (error: any) {
    console.error("❌ Error en initNuveiCheckout:", error.message || error);
    return internalErrorResponse("No se pudo inicializar la referencia de pago de Nuvei");
  }
}

