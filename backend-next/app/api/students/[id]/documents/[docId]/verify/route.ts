import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { documentService } from "@/lib/services/document-service";

/**
 * ✅ VERIFY DOCUMENT
 * PATCH /api/students/[id]/documents/[docId]/verify
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  try {
    const { docId } = params;
    const body = await req.json().catch(() => ({}));
    const isVerified = body.isVerified !== undefined ? body.isVerified : true;

    const updated = await documentService.verifyDocument(docId, session.sub, isVerified);
    return apiResponse(updated);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    return apiError(msg || "Failed to verify document");
  }
}
