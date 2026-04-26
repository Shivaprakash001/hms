import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { documentService } from "@/lib/services/document-service";

/**
 * 📄 DOCUMENTS — Get and Upload
 * GET  /api/students/[id]/documents
 * POST /api/students/[id]/documents
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const docs = await documentService.getTenantDocuments(params.id, {
      sub: session.sub,
      role: session.role,
    });
    return apiResponse(docs);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    return apiError(msg || "Failed to fetch documents");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  // For students, they can only upload to their own account
  if (session.role === "STUDENT" && session.sub !== params.id) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const docType = formData.get("docType") as string;
    const docNumber = formData.get("docNumber") as string;

    if (!file) return apiError("File is required", "VALIDATION", 400);
    if (!docType) return apiError("Document type is required", "VALIDATION", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const doc = await documentService.uploadDocument(
      params.id,
      buffer,
      file.name,
      docType,
      docNumber
    );

    return apiResponse(doc);
  } catch (error: any) {
    console.error("Upload error:", error);
    const msg = typeof error?.message === "string" ? error.message : String(error);
    return apiError(msg || "Failed to upload document");
  }
}
