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

    // =================================================================
    // 3. CÁLCULOS MONETARIOS
    // =================================================================

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
      reference: description.substring(0, 100),
    });

    console.log(`✅ Link generado: ${paymentUrl}`);

    return successResponse({
      paymentUrl: paymentUrl,
      clientTransactionId: clientTransactionId,
      amount: costDecimal,
    });
  } catch (error: any) {
    console.error("❌ Error en generatePaymentLink:", error);

    if (
      error.message &&
      (error.message.includes("Validaciones fallidas") ||
        error.message.includes("Amount"))
    ) {
      return errorResponse(
        "Error de validación con PayPhone. El monto calculado no es aceptado por la pasarela.",
        400,
      );
    }

    logger.error("Payment generation failed", error);

    return internalErrorResponse(
      "No se pudo generar el enlace de pago. Por favor intenta de nuevo.",
    );
  }
}
