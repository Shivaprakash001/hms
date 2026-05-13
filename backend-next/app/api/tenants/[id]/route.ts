export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantService } from "@/lib/services/tenant-service";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { invitationService } from "@/lib/services/invitation-service";
import { InvitationUpdateSchema } from "@/lib/validators";


/**
 * 👨‍🎓 TENANT BY ID — Get, Update, Delete
 * GET    /api/tenants/[id]
 * PUT    /api/tenants/[id]
 * DELETE /api/tenants/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const tenant = await tenantService.getTenantById(params.id, { sub: session.sub, role: session.role });
    return apiResponse(tenant);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    return apiError(msg || "Failed to fetch tenant");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json();
    if (body?.invitation_edit === true) {
      const validated = InvitationUpdateSchema.safeParse(body);
      if (!validated.success) return apiError("Validation failed", "VALIDATION_ERROR", 400);
      const result = await invitationService.updateInvitation(params.id, scope.owner_id, validated.data);
      if (result?.email_sent === false) {
        return apiResponse(result, 202);
      }
      return apiResponse(result);
    }
    const updated = await tenantService.updateTenant(params.id, body, scope.owner_id);
    return apiResponse(updated);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    if (msg.startsWith("VALIDATION")) return apiError(msg.split(": ")[1] ?? msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("ALREADY_EXISTS")) return apiError(msg.split(": ")[1] ?? msg, "ALREADY_EXISTS", 409);
    if (msg.startsWith("CAPACITY_EXCEEDED")) return apiError(msg.split(": ")[1] ?? msg, "CAPACITY_EXCEEDED", 409);
    if (msg.startsWith("INTERNAL_ERROR")) return apiError(msg.split(": ")[1] ?? msg, "INTERNAL_ERROR", 500);
    return apiError(msg || "Failed to update tenant");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const result = await tenantService.deleteTenant(params.id, scope.owner_id);
    return apiResponse(result);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    return apiError(msg || "Failed to delete tenant");
  }
}
