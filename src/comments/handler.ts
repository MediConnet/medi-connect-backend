import { APIGatewayProxyEventV2, APIGatewayProxyResult } from "aws-lambda";
import { errorResponse, internalErrorResponse, optionsResponse } from "../shared/response";
import {
  createComment,
  deleteComment,
  getCommentById,
  getComments,
  respondComment,
  updateComment,
  updateCommentStatus,
} from "./comments.controller";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log(`[COMMENTS] Método: ${method}, Path: ${path}`);

  if (method === "OPTIONS") return optionsResponse(event);

  try {
    // POST /api/comments - Create comment (authenticated)
    if (path === "/api/comments" && method === "POST") {
      return await createComment(event);
    }

    // GET /api/comments - List comments (admin only)
    if (path === "/api/comments" && method === "GET") {
      return await getComments(event);
    }

    // GET /api/comments/:id - Get comment detail (admin only)
    if (path.match(/^\/api\/comments\/[^/]+$/) && method === "GET") {
      return await getCommentById(event);
    }

    // PUT /api/comments/:id - Update comment (admin only)
    if (path.match(/^\/api\/comments\/[^/]+$/) && method === "PUT") {
      return await updateComment(event);
    }

    // PATCH /api/comments/:id/status - Update status (admin only)
    if (path.match(/^\/api\/comments\/[^/]+\/status$/) && method === "PATCH") {
      return await updateCommentStatus(event);
    }

    // PATCH /api/comments/:id/response - Admin responds (admin only)
    if (path.match(/^\/api\/comments\/[^/]+\/response$/) && method === "PATCH") {
      return await respondComment(event);
    }

    // DELETE /api/comments/:id - Soft delete (admin only)
    if (path.match(/^\/api\/comments\/[^/]+$/) && method === "DELETE") {
      return await deleteComment(event);
    }

    return errorResponse(`Route not found: ${method} ${path}`, 404);
  } catch (error: any) {
    console.error("[COMMENTS] Error in handler:", error);
    return internalErrorResponse(error.message || "Internal server error");
  }
}
