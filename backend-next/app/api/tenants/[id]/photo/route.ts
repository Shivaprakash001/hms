export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { documentService } from "@/lib/services/document-service";

/**
 * 📷 PROFILE PHOTO UPDATE
 * POST /api/tenants/[id]/photo
 *
 * Multipart form-data: field "file" (image/jpeg | image/png | image/webp, max 2MB)
 * Auth: TENANT (own) or OWNER (their tenant). STARTER plan or higher required.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return apiError("File is required", "VALIDATION", 400);

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type))
      return apiError("Photo must be JPEG, PNG or WEBP", "VALIDATION", 400);
    if (file.size > 2 * 1024 * 1024)
      return apiError("Photo must be under 2MB", "VALIDATION", 400);

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await documentService.uploadProfilePhoto(
      params.id,
      buffer,
      file.name || "photo.jpg",
      file.type,
      { sub: session.sub, role: session.role }
    );

    return apiResponse(result);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("VALIDATION")) return apiError(msg.split(": ")[1] ?? msg, "VALIDATION", 400);
    if (msg.startsWith("FORBIDDEN"))  return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    if (msg.startsWith("NOT_FOUND"))  return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("PLAN_LIMIT")) return apiError(msg.split(": ").slice(2).join(": ") || msg, "PLAN_LIMIT", 403);
    return apiError(msg || "Failed to upload photo");
  }
}
