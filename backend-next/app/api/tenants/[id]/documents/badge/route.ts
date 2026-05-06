import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { documentService } from "@/lib/services/document-service";
import { prisma } from "@/lib/db";

/**
 * 🏅 VERIFICATION BADGE
 * GET /api/tenants/[id]/documents/badge
 *
 * Returns the tenant's computed verification badge derived from active KYC docs.
 * VERIFIED | PENDING | REJECTED | NOT_STARTED
 *
 * Accessible by: the tenant themselves, or the owner of that tenant.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const tenant = await prisma.tenant.findUnique({
      where:  { id: params.id },
      select: { profile_id: true, owner_id: true },
    });
    if (!tenant) return apiError("Tenant not found", "NOT_FOUND", 404);

    if (session.role === "TENANT" && tenant.profile_id !== session.sub)
      return apiError("Access denied", "FORBIDDEN", 403);
    if (session.role === "OWNER" && tenant.owner_id !== session.sub)
      return apiError("Access denied", "FORBIDDEN", 403);

    const badge = await documentService.getVerificationBadge(params.id);
    return apiResponse({ badge });
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    return apiError(msg || "Failed to fetch verification badge");
  }
}
