import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomBytes, randomUUID } from "crypto";
import { AuthContext, requireAuth } from "../shared/auth";
import { logger } from "../shared/logger";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
} from "../shared/response";
import { payPhoneService } from "./payphone.service";

/**
 * Genera un ID de transacción corto y único (Máx 15 chars)
 * Formato: TX-xxxxxxxxx
 */
const generateClientTransactionId = (): string => {
  const randomPart = randomBytes(6).toString("hex").toUpperCase();
  return `TX-${randomPart}`;
};

export async function generatePaymentLink(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("💰 [PAYMENTS] Generando link de pago...");

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

    if (!body || !body.appointmentId) {
      return errorResponse("El campo appointmentId es requerido", 400);
    }

    const appointment = await prisma.appointments.findUnique({
      where: { id: body.appointmentId },
      include: {
        patients: true,
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

    const branchFee = appointment.provider_branches?.consultation_fee;

    const rawPrice =
      branchFee !== null && branchFee !== undefined
        ? branchFee
        : appointment.cost;

    const costDecimal = Number(rawPrice);

    console.log(
      `💰 [DEBUG] Fee Sucursal: ${branchFee} | Costo Cita Backup: ${appointment.cost}`,
    );
    console.log(`💰 [DEBUG] Costo Final a Procesar (USD): ${costDecimal}`);

    if (isNaN(costDecimal) || costDecimal <= 0) {
      return errorResponse(
        `El costo de la consulta ($${costDecimal}) no es válido para procesar el pago. Verifica la configuración de la sucursal.`,
        400,
      );
    }

    const amountInCents = Math.round(costDecimal * 100);

    const amountWithTax = 0;
    const amountWithoutTax = amountInCents;
    const tax = 0;

    const total = amountWithoutTax + amountWithTax + tax;

    console.log(
      `💰 [DEBUG] Total a enviar a PayPhone (Entero/Centavos): ${total}`,
    );

    const clientTransactionId = generateClientTransactionId();

    await prisma.payments.create({
      data: {
        id: randomUUID(),
        appointment_id: appointment.id,
        amount_total: costDecimal,
        provider_amount: costDecimal,
        platform_fee: 0,
        status: "PENDING",
        payment_source: "PAYPHONE",
        payment_method: "CARD",
        external_transaction_id: clientTransactionId,
      },
    });

    const doctorName = appointment.providers?.commercial_name || "Doctor";
    const branchName = appointment.provider_branches?.name || "Consultorio";
    const description = `Consulta - ${doctorName} (${branchName})`;

    const paymentUrl = await payPhoneService.createPaymentLink({
      amount: total,
      amountWithoutTax: amountWithoutTax,
      amountWithTax: amountWithTax,
      tax: tax,
      currency: "USD",
      clientTransactionId: clientTransactionId,
      reference: description.substring(0, 50),
    });

    console.log(`✅ Link generado: ${paymentUrl}`);

    return successResponse({
      paymentUrl: paymentUrl,
      clientTransactionId: clientTransactionId,
      amount: costDecimal,
    });
  } catch (error: any) {
    let detailedError = error.message;

    if (error.response?.data) {
      detailedError = JSON.stringify(error.response.data, null, 2);
    } else if (error.message && error.message.startsWith("{")) {
      try {
        detailedError = JSON.stringify(JSON.parse(error.message), null, 2);
      } catch (e) {}
    }

    console.error(`❌ Error en generatePaymentLink:\n${detailedError}\n`);

    if (
      detailedError &&
      (detailedError.includes("Validaciones fallidas") ||
        detailedError.includes("Amount"))
    ) {
      return errorResponse(
        "Error de validación con PayPhone. Verifica que el monto o los datos de la sucursal sean correctos.",
        400,
      );
    }

    logger.error("Payment generation failed", error);

    return internalErrorResponse(
      "No se pudo generar el enlace de pago. Por favor intenta de nuevo.",
    );
  }
}

export async function handlePayphoneWebhook(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("🔔 [PAYMENTS] Webhook NotificacionPago invocado");

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
        body: JSON.stringify({ Response: false, ErrorCode: "111" }),
      };
    }

    const {
      Amount,
      AuthorizationCode,
      ClientTransactionId,
      StatusCode,
      TransactionStatus,
      StoreId,
      TransactionId,
    } = body;

    if (
      Amount == null ||
      !AuthorizationCode ||
      !ClientTransactionId ||
      StatusCode == null ||
      !TransactionStatus ||
      !StoreId ||
      TransactionId == null
    ) {
      console.warn("⚠️ [WEBHOOK] Faltan variables requeridas:", body);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Response: false, ErrorCode: "444" }),
      };
    }

    if (StoreId !== process.env.PAYPHONE_STORE_ID) {
      console.warn(
        `⚠️ [WEBHOOK] StoreId no coincide. Recibido: ${StoreId}, Esperado: ${process.env.PAYPHONE_STORE_ID}`,
      );
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Response: false, ErrorCode: "666" }),
      };
    }

    const payment = await prisma.payments.findFirst({
      where: { external_transaction_id: ClientTransactionId },
    });

    if (!payment) {
      console.warn(
        `⚠️ [WEBHOOK] Pago no encontrado para ClientTxId: ${ClientTransactionId}`,
      );
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Response: false, ErrorCode: "222" }),
      };
    }

    if (payment.status === "PAID" || payment.status === "COMPLETED") {
      console.log(
        `ℹ️ [WEBHOOK] Transacción ${TransactionId} ya estaba procesada.`,
      );
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Response: false, ErrorCode: "333" }),
      };
    }

    if (StatusCode === 3 && TransactionStatus === "Approved") {
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
          },
        });
      }

      console.log(
        `✅ [WEBHOOK] Pago ${TransactionId} APROBADO y guardado con éxito.`,
      );

      // RESPUESTA DE ÉXITO A PAYPHONE (000)
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Response: true, ErrorCode: "000" }),
      };
    } else {
      await prisma.payments.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });

      console.log(
        `❌ [WEBHOOK] Pago ${TransactionId} fue rechazado o cancelado.`,
      );

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Response: true, ErrorCode: "000" }),
      };
    }
  } catch (error: any) {
    console.error("❌ [WEBHOOK] Error interno procesando notificación:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Response: false, ErrorCode: "222" }),
    };
  }
}
