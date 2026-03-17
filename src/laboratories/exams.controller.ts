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
} from "../shared/response";
import {
  parseBody,
  createLaboratoryExamSchema,
  updateLaboratoryExamSchema,
  extractIdFromPath,
} from "../shared/validators";

async function getLabProvider(prisma: ReturnType<typeof getPrismaClient>, userId: string) {
  const category = await prisma.service_categories.findFirst({
    where: {
      OR: [{ slug: "laboratory" }, { slug: "laboratorio" }],
    },
    select: { id: true },
  });
  if (!category) return null;
  return prisma.providers.findFirst({
    where: { user_id: userId, category_id: category.id },
    select: { id: true },
  });
}

/**
 * GET /api/laboratories/exams
 */
export async function getExams(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const provider = await getLabProvider(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Laboratory not found");

    const items = await prisma.provider_catalog.findMany({
      where: { provider_id: provider.id },
      orderBy: { name: "asc" },
    });

    const exams = items.map((e) => ({
      id: e.id,
      name: e.name ?? "",
      description: e.description ?? "",
      price: e.price != null ? Number(e.price) : 0,
      is_available: e.is_available ?? true,
      type: e.type ?? "exam",
    }));

    return successResponse({ exams });
  } catch (err: any) {
    console.error("❌ [LABORATORIES] getExams error:", err.message);
    return internalErrorResponse("Failed to get exams");
  }
}

/**
 * POST /api/laboratories/exams
 */
export async function createExam(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const body = parseBody(event.body ?? null, createLaboratoryExamSchema);
    const provider = await getLabProvider(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Laboratory not found");

    const description = [body.description, body.preparation].filter(Boolean).join("\n\nPreparación: ").trim() || null;

    const exam = await prisma.provider_catalog.create({
      data: {
        id: randomUUID(),
        provider_id: provider.id,
        type: "exam",
        name: body.name,
        description: description || null,
        price: body.price ?? 0,
        is_available: body.is_available ?? true,
      },
    });

    return successResponse(
      {
        id: exam.id,
        name: exam.name ?? "",
        description: exam.description ?? "",
        price: exam.price != null ? Number(exam.price) : 0,
        is_available: exam.is_available ?? true,
      },
      201,
    );
  } catch (err: any) {
    console.error("❌ [LABORATORIES] createExam error:", err.message);
    if (err.message?.includes("Validation")) return errorResponse(err.message, 400);
    return internalErrorResponse("Failed to create exam");
  }
}

/**
 * PUT /api/laboratories/exams/:id
 */
export async function updateExam(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const examId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/laboratories/exams/",
      "",
    );
    if (!examId) return errorResponse("Exam ID required", 400);

    const body = parseBody(event.body ?? null, updateLaboratoryExamSchema);
    const provider = await getLabProvider(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Laboratory not found");

    const existing = await prisma.provider_catalog.findFirst({
      where: { id: examId, provider_id: provider.id },
    });
    if (!existing) return notFoundResponse("Exam not found");

    let description: string | null | undefined;
    if (body.description !== undefined) description = body.description;
    else if (body.preparation !== undefined)
      description = [existing.description, "Preparación: " + body.preparation].filter(Boolean).join("\n") || null;

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (description !== undefined) updateData.description = description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.is_available !== undefined) updateData.is_available = body.is_available;

    const updated = await prisma.provider_catalog.update({
      where: { id: examId },
      data: updateData,
    });

    return successResponse({
      id: updated.id,
      name: updated.name ?? "",
      description: updated.description ?? "",
      price: updated.price != null ? Number(updated.price) : 0,
      is_available: updated.is_available ?? true,
    });
  } catch (err: any) {
    console.error("❌ [LABORATORIES] updateExam error:", err.message);
    if (err.message?.includes("Validation") || err.message?.includes("Invalid path")) return errorResponse(err.message, 400);
    return internalErrorResponse("Failed to update exam");
  }
}

/**
 * DELETE /api/laboratories/exams/:id
 */
export async function deleteExam(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const authResult = await requireRole(event, [enum_roles.provider]);
  if ("statusCode" in authResult) return authResult;

  const authContext = authResult as AuthContext;
  const prisma = getPrismaClient();

  try {
    const examId = extractIdFromPath(
      event.requestContext.http.path,
      "/api/laboratories/exams/",
      "",
    );
    if (!examId) return errorResponse("Exam ID required", 400);

    const provider = await getLabProvider(prisma, authContext.user.id);
    if (!provider) return notFoundResponse("Laboratory not found");

    const existing = await prisma.provider_catalog.findFirst({
      where: { id: examId, provider_id: provider.id },
    });
    if (!existing) return notFoundResponse("Exam not found");

    await prisma.provider_catalog.delete({ where: { id: examId } });

    return successResponse({ message: "Exam deleted" });
  } catch (err: any) {
    console.error("❌ [LABORATORIES] deleteExam error:", err.message);
    if (err.message?.includes("Invalid path")) return errorResponse(err.message, 400);
    return internalErrorResponse("Failed to delete exam");
  }
}
