export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { documentService } from "@/lib/services/document-service";

/**
 * 👨‍🎓 TENANT ME DOCUMENTS
 * GET /api/tenants/me/documents
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") {
    return apiError("Forbidden: Only tenants can access this endpoint", "FORBIDDEN", 403);
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { profile_id: session.sub },
      select: { id: true }
    });

    if (!tenant) return apiError("Tenant record not found", "NOT_FOUND", 404);

    const docs = await documentService.getTenantDocuments(tenant.id, {
      sub: session.sub,
      role: session.role,
    });

    return apiResponse({ documents: docs });
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    return apiError(msg || "Failed to fetch documents");
  }
}

