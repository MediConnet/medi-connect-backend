import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import * as crypto from "crypto";
import { z } from "zod";
import { getPrismaClient } from "../shared/prisma";
import {
  errorResponse,
  internalErrorResponse,
  notFoundResponse,
  paginatedResponse,
  successResponse,
} from "../shared/response";
import { requireAuth, requireRole } from "../shared/auth";

const commentSchema = z.object({
  subject: z.string().min(5, "El asunto debe tener al menos 5 caracteres").max(200, "El asunto no puede exceder 200 caracteres"),
  message: z.string().min(10, "El mensaje debe tener al menos 10 caracteres").max(3000, "El mensaje no puede exceder 3000 caracteres"),
});

const statusSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "RESOLVED", "REJECTED"]),
});

const responseSchema = z.object({
  adminResponse: z.string().min(1, "La respuesta no puede estar vacía").max(3000, "La respuesta no puede exceder 3000 caracteres"),
});

const updateSchema = z.object({
  subject: z.string().min(5).max(200).optional(),
  message: z.string().min(10).max(3000).optional(),
});

function validateBody<T extends z.ZodTypeAny>(body: string | null | undefined, schema: T): z.infer<T> {
  try {
    const parsed = JSON.parse(body || "{}");
    return schema.parse(parsed);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Validation error: ${messages}`);
    }
    throw new Error("Invalid JSON body");
  }
}

function extractUuidFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[2];
}

// POST /api/comments - Create comment (any authenticated user)
export async function createComment(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireAuth(event);
    if ("statusCode" in authResult) return authResult;
    const authContext = authResult;

    const data = validateBody(event.body, commentSchema);

    const prisma = getPrismaClient();
    const comment = await prisma.comments.create({
      data: {
        id: crypto.randomUUID(),
        user_id: authContext.user.id,
        user_type: authContext.user.role || "user",
        user_email: authContext.user.email || undefined,
        subject: data.subject,
        message: data.message,
        status: "PENDING",
      },
    });

    return successResponse({
      id: comment.id,
      subject: comment.subject,
      message: comment.message,
      status: comment.status,
      createdAt: comment.created_at.toISOString(),
    }, 201);
  } catch (error: any) {
    if (error.message && error.message.startsWith("Validation error")) {
      return errorResponse(error.message, 400);
    }
    console.error("[COMMENTS] Error creating comment:", error);
    return internalErrorResponse("Error creating comment");
  }
}

// GET /api/comments - List comments (admin only, paginated)
export async function getComments(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, ["admin"]);
    if ("statusCode" in authResult) return authResult;

    const queryParams = event.queryStringParameters || {};
    const page = parseInt(queryParams.page || "1", 10);
    const limit = parseInt(queryParams.limit || "20", 10);
    const offset = (page - 1) * limit;
    const search = queryParams.search || "";
    const status = queryParams.status || "";
    const dateFrom = queryParams.dateFrom || "";
    const dateTo = queryParams.dateTo || "";

    const prisma = getPrismaClient();
    const where: any = { deleted_at: null };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
        { user_name: { contains: search, mode: "insensitive" } },
        { user_email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.created_at = {};
      if (dateFrom) where.created_at.gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.created_at.lte = endDate;
      }
    }

    const [comments, total] = await Promise.all([
      prisma.comments.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.comments.count({ where }),
    ]);

    return paginatedResponse(
      comments.map((c) => ({
        id: c.id,
        userId: c.user_id,
        userType: c.user_type,
        userName: c.user_name,
        userEmail: c.user_email,
        subject: c.subject,
        message: c.message,
        status: c.status,
        adminResponse: c.admin_response,
        createdAt: c.created_at.toISOString(),
        updatedAt: c.updated_at.toISOString(),
      })),
      total,
      page,
      limit,
    );
  } catch (error: any) {
    console.error("[COMMENTS] Error listing comments:", error);
    return internalErrorResponse("Error listing comments");
  }
}

// GET /api/comments/:id - Get comment detail
export async function getCommentById(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, ["admin"]);
    if ("statusCode" in authResult) return authResult;

    const id = extractUuidFromPath(event.requestContext.http.path);
    if (!id) return errorResponse("Comment ID is required", 400);

    const prisma = getPrismaClient();
    const comment = await prisma.comments.findFirst({
      where: { id, deleted_at: null },
    });

    if (!comment) return notFoundResponse("Comment not found");

    return successResponse({
      id: comment.id,
      userId: comment.user_id,
      userType: comment.user_type,
      userName: comment.user_name,
      userEmail: comment.user_email,
      subject: comment.subject,
      message: comment.message,
      status: comment.status,
      adminResponse: comment.admin_response,
      createdAt: comment.created_at.toISOString(),
      updatedAt: comment.updated_at.toISOString(),
    });
  } catch (error: any) {
    console.error("[COMMENTS] Error getting comment:", error);
    return internalErrorResponse("Error getting comment");
  }
}

// PUT /api/comments/:id - Update comment
export async function updateComment(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, ["admin"]);
    if ("statusCode" in authResult) return authResult;

    const id = extractUuidFromPath(event.requestContext.http.path);
    if (!id) return errorResponse("Comment ID is required", 400);

    const data = validateBody(event.body, updateSchema);

    const prisma = getPrismaClient();
    const existing = await prisma.comments.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) return notFoundResponse("Comment not found");

    const updated = await prisma.comments.update({
      where: { id },
      data: {
        ...(data.subject && { subject: data.subject }),
        ...(data.message && { message: data.message }),
      },
    });

    return successResponse({
      id: updated.id,
      subject: updated.subject,
      message: updated.message,
      status: updated.status,
      updatedAt: updated.updated_at.toISOString(),
    });
  } catch (error: any) {
    if (error.message && error.message.startsWith("Validation error")) {
      return errorResponse(error.message, 400);
    }
    console.error("[COMMENTS] Error updating comment:", error);
    return internalErrorResponse("Error updating comment");
  }
}

// PATCH /api/comments/:id/status - Update comment status
export async function updateCommentStatus(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, ["admin"]);
    if ("statusCode" in authResult) return authResult;

    const path = event.requestContext.http.path;
    const id = extractUuidFromPath(path);
    if (!id) return errorResponse("Comment ID is required", 400);

    const data = validateBody(event.body, statusSchema);

    const prisma = getPrismaClient();
    const existing = await prisma.comments.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) return notFoundResponse("Comment not found");

    const updated = await prisma.comments.update({
      where: { id },
      data: { status: data.status },
    });

    return successResponse({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updated_at.toISOString(),
    });
  } catch (error: any) {
    if (error.message && error.message.startsWith("Validation error")) {
      return errorResponse(error.message, 400);
    }
    console.error("[COMMENTS] Error updating status:", error);
    return internalErrorResponse("Error updating status");
  }
}

// PATCH /api/comments/:id/response - Admin responds to comment
export async function respondComment(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, ["admin"]);
    if ("statusCode" in authResult) return authResult;

    const path = event.requestContext.http.path;
    const id = extractUuidFromPath(path);
    if (!id) return errorResponse("Comment ID is required", 400);

    const data = validateBody(event.body, responseSchema);

    const prisma = getPrismaClient();
    const existing = await prisma.comments.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) return notFoundResponse("Comment not found");

    const updated = await prisma.comments.update({
      where: { id },
      data: {
        admin_response: data.adminResponse,
        status: "RESOLVED",
      },
    });

    return successResponse({
      id: updated.id,
      status: updated.status,
      adminResponse: updated.admin_response,
      updatedAt: updated.updated_at.toISOString(),
    });
  } catch (error: any) {
    if (error.message && error.message.startsWith("Validation error")) {
      return errorResponse(error.message, 400);
    }
    console.error("[COMMENTS] Error responding to comment:", error);
    return internalErrorResponse("Error responding to comment");
  }
}

// DELETE /api/comments/:id - Soft delete comment
export async function deleteComment(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await requireRole(event, ["admin"]);
    if ("statusCode" in authResult) return authResult;

    const id = extractUuidFromPath(event.requestContext.http.path);
    if (!id) return errorResponse("Comment ID is required", 400);

    const prisma = getPrismaClient();
    const existing = await prisma.comments.findFirst({
      where: { id, deleted_at: null },
    });

    if (!existing) return notFoundResponse("Comment not found");

    await prisma.comments.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return successResponse({ message: "Comment deleted successfully" });
  } catch (error: any) {
    console.error("[COMMENTS] Error deleting comment:", error);
    return internalErrorResponse("Error deleting comment");
  }
}
