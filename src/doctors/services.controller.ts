import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { randomUUID } from "crypto";
import { enum_roles } from "../generated/prisma/client";
import { AuthContext, requireRole } from "../shared/auth";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  successResponse,
  paginatedResponse,
} from "../shared/response";
import { parseBody, extractIdFromPath } from "../shared/validators";
import { z } from "zod";

const createServiceSchema = z.object({
  name: z.string().min(1, "El nombre del tratamiento es requerido"),
  description: z.string().optional(),
  price: z.number().min(0, "El precio debe ser un número positivo"),
  duration: z.number().optional().default(60), // Duración en minutos
  is_available: z.boolean().optional().default(true),
  image_url: z.string().optional(),
});

const updateServiceSchema = createServiceSchema.partial();

const INITIAL_AESTHETIC_TREATMENTS = [
  { name: "Limpieza Facial Profunda + Alta Frecuencia", duration: 60, price: 35.0, description: "Tratamiento facial purificante e hidratante profundo." },
  { name: "Peeling Químico Renovador", duration: 45, price: 45.0, description: "Exfoliación médica para renovar las capas superficiales de la piel." },
  { name: "Masaje Descontracturante / Relajante", duration: 60, price: 40.0, description: "Terapia corporal para liberar tensión muscular y estrés." },
  { name: "Tratamiento Corporal Reductor", duration: 50, price: 50.0, description: "Sesión intensiva para remodelación corporal y firmeza." },
  { name: "Hidratación Facial con Ácido Hialurónico", duration: 45, price: 60.0, description: "Nutrición celular profunda para devolver elasticidad y brillo." },
];

async function getProviderByUserId(prisma: ReturnType<typeof getPrismaClient>, userId: string) {
  return prisma.providers.findFirst({
    where: { user_id: userId },
    select: { id: true },
  });
}

/**
 * GET /api/doctors/services
 */
export async function getServices(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const provider = await getProviderByUserId(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Proveedor no encontrado");

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || '1', 10);
    const limit = parseInt(queryParams.limit || '10', 10);
    const offset = (page - 1) * limit;

    const where = { provider_id: provider.id };

    let total = await prisma.provider_catalog.count({ where });

    // Si el catálogo está totalmente vacío, sembrar los 5 tratamientos iniciales automáticamente
    if (total === 0) {
      console.log(`🌱 [AESTHETIC] Sembrando catálogo inicial para el proveedor ${provider.id}...`);
      await prisma.provider_catalog.createMany({
        data: INITIAL_AESTHETIC_TREATMENTS.map((t) => ({
          id: randomUUID(),
          provider_id: provider.id,
          name: t.name,
          description: t.description,
          price: t.price,
          stock: t.duration, // usamos stock para almacenar la duración en minutos
          is_available: true,
          type: "aesthetic_treatment",
        })),
      });

      total = await prisma.provider_catalog.count({ where });
    }

    const items = await prisma.provider_catalog.findMany({
      where,
      orderBy: { created_at: "asc" },
      skip: offset,
      take: limit,
    });

    const services = items.map((item) => ({
      id: item.id,
      name: item.name || "",
      description: item.description || "",
      price: item.price !== null ? Number(item.price) : 0,
      duration: item.stock !== null && item.stock > 0 ? item.stock : 60,
      is_available: item.is_available ?? true,
      image_url: item.image_url || null,
      payment_method: "cash",
      type: item.type || "aesthetic_treatment",
    }));

    return paginatedResponse(services, total, page, limit);
  } catch (err: any) {
    console.error("❌ [AESTHETIC] getServices error:", err.message);
    return internalErrorResponse("Error al obtener el catálogo de tratamientos");
  }
}

/**
 * POST /api/doctors/services
 */
export async function createService(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body ?? null, createServiceSchema);
    const provider = await getProviderByUserId(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Proveedor no encontrado");

    const createdItem = await prisma.provider_catalog.create({
      data: {
        id: randomUUID(),
        provider_id: provider.id,
        name: body.name,
        description: body.description || null,
        price: body.price,
        stock: body.duration || 60,
        is_available: body.is_available ?? true,
        image_url: body.image_url || null,
        type: "aesthetic_treatment",
      },
    });

    return successResponse(
      {
        id: createdItem.id,
        name: createdItem.name,
        description: createdItem.description || "",
        price: Number(createdItem.price || 0),
        duration: createdItem.stock || 60,
        is_available: createdItem.is_available ?? true,
        image_url: createdItem.image_url || null,
        payment_method: "cash",
      },
      201
    );
  } catch (err: any) {
    console.error("❌ [AESTHETIC] createService error:", err.message);
    return internalErrorResponse("Error al crear el tratamiento");
  }
}

/**
 * PUT /api/doctors/services/:id
 */
export async function updateService(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const serviceId = extractIdFromPath(event.requestContext.http.path, "/api/doctors/services/");

  if (!serviceId) return errorResponse("ID de tratamiento no válido", 400);

  try {
    const body = parseBody(event.body ?? null, updateServiceSchema);
    const provider = await getProviderByUserId(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Proveedor no encontrado");

    const existing = await prisma.provider_catalog.findFirst({
      where: { id: serviceId, provider_id: provider.id },
    });

    if (!existing) return notFoundResponse("Tratamiento no encontrado o no autorizado");

    const updated = await prisma.provider_catalog.update({
      where: { id: serviceId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.duration !== undefined && { stock: body.duration }),
        ...(body.is_available !== undefined && { is_available: body.is_available }),
        ...(body.image_url !== undefined && { image_url: body.image_url }),
      },
    });

    return successResponse({
      id: updated.id,
      name: updated.name,
      description: updated.description || "",
      price: Number(updated.price || 0),
      duration: updated.stock || 60,
      is_available: updated.is_available ?? true,
      image_url: updated.image_url || null,
      payment_method: "cash",
    });
  } catch (err: any) {
    console.error("❌ [AESTHETIC] updateService error:", err.message);
    return internalErrorResponse("Error al actualizar el tratamiento");
  }
}

/**
 * DELETE /api/doctors/services/:id
 */
export async function deleteService(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();
  const serviceId = extractIdFromPath(event.requestContext.http.path, "/api/doctors/services/");

  if (!serviceId) return errorResponse("ID de tratamiento no válido", 400);

  try {
    const provider = await getProviderByUserId(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Proveedor no encontrado");

    const existing = await prisma.provider_catalog.findFirst({
      where: { id: serviceId, provider_id: provider.id },
    });

    if (!existing) return notFoundResponse("Tratamiento no encontrado");

    await prisma.provider_catalog.delete({
      where: { id: serviceId },
    });

    return successResponse({ message: "Tratamiento eliminado exitosamente" });
  } catch (err: any) {
    console.error("❌ [AESTHETIC] deleteService error:", err.message);
    return internalErrorResponse("Error al eliminar el tratamiento");
  }
}
