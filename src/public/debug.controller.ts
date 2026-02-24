import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { getPrismaClient } from "../shared/prisma";
import { successResponse, errorResponse, internalErrorResponse } from "../shared/response";

/**
 * DEBUG ENDPOINT - Verificar datos de consultation_prices
 * GET /api/public/debug/consultation-prices/:doctorId
 * 
 * TEMPORAL - ELIMINAR EN PRODUCCIÓN
 */
export async function debugConsultationPrices(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> {
  console.log("🐛 [DEBUG] Verificando consultation_prices");

  try {
    const pathParts = event.requestContext.http.path.split("/");
    const doctorIdIndex = pathParts.indexOf("consultation-prices") + 1;
    const doctorId = pathParts[doctorIdIndex];

    if (!doctorId) {
      return errorResponse("Doctor ID requerido", 400, undefined, event);
    }

    const prisma = getPrismaClient();

    // 1. Verificar doctor
    const doctor = await prisma.providers.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        commercial_name: true,
        verification_status: true,
        users: {
          select: { email: true },
        },
      },
    });

    // 2. Buscar TODOS los consultation_prices (activos e inactivos)
    const allPrices = await prisma.consultation_prices.findMany({
      where: { provider_id: doctorId },
      include: {
        specialties: {
          select: { id: true, name: true },
        },
      },
    });

    // 3. Contar activos e inactivos
    const activePrices = allPrices.filter((p) => p.is_active);
    const inactivePrices = allPrices.filter((p) => p.is_active === false);

    // 4. Buscar especialidades del doctor
    const specialties = await prisma.provider_specialties.findMany({
      where: { provider_id: doctorId },
      include: {
        specialties: {
          select: { id: true, name: true },
        },
      },
    });

    const debugInfo = {
      doctor: doctor
        ? {
            id: doctor.id,
            name: doctor.commercial_name,
            email: doctor.users?.email,
            status: doctor.verification_status,
          }
        : null,
      consultationPrices: {
        total: allPrices.length,
        active: activePrices.length,
        inactive: inactivePrices.length,
        data: allPrices.map((cp) => ({
          id: cp.id,
          consultationType: cp.consultation_type,
          price: parseFloat(cp.price.toString()),
          specialtyId: cp.specialty_id,
          specialtyName: cp.specialties?.name || null,
          isActive: cp.is_active,
          createdAt: cp.created_at,
          updatedAt: cp.updated_at,
        })),
      },
      specialties: specialties.map((ps) => ({
        specialtyId: ps.specialty_id,
        specialtyName: ps.specialties.name,
        fee: parseFloat(ps.fee.toString()),
      })),
    };

    console.log("🐛 [DEBUG] Resultado:", JSON.stringify(debugInfo, null, 2));

    return successResponse(debugInfo, 200, event);
  } catch (error: any) {
    console.error("❌ [DEBUG] Error:", error.message);
    return internalErrorResponse(error.message, event);
  }
}
