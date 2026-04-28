import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { documentService } from "@/lib/services/document-service";

/**
 * 🗑️ DELETE DOCUMENT
 * DELETE /api/students/[id]/documents/[docId]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const result = await documentService.deleteDocument(params.docId, {
      sub: session.sub,
      role: session.role,
    });
    return apiResponse(result);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    return apiError(msg || "Failed to delete document");
  }
}
