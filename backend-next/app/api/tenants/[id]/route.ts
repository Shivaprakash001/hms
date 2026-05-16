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
  if (!session) {
    console.warn("[tenants.id.GET] Unauthorized access attempt");
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  try {
    console.log(`[tenants.id.GET] Fetching tenant ${params.id} for user ${session.sub}`);
    const tenant = await tenantService.getTenantById(params.id, { sub: session.sub, role: session.role });
    
    return apiResponse({
      success: true,
      data: tenant
    });
  } catch (error: any) {
    console.error(`Detailed API Error [tenants.id.GET] (${params.id}):`, error);
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    console.warn(`[tenants.id.PUT] Forbidden access attempt by ${session?.role} ${session?.sub}`);
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json().catch(() => ({}));
    
    console.log(`[tenants.id.PUT] Updating tenant ${params.id} for owner ${scope.owner_id}`, body);
    
    if (body?.invitation_edit === true) {
      const validated = InvitationUpdateSchema.safeParse(body);
      if (!validated.success) {
        console.warn(`[tenants.id.PUT] Invitation validation failed for tenant ${params.id}`);
        return apiError("Validation failed", "VALIDATION_ERROR", 400);
      }
      
      const result = await invitationService.updateInvitation(params.id, scope.owner_id, validated.data);
      
      return apiResponse({
        success: true,
        data: result
      }, result?.email_sent === false ? 202 : 200);
    }

    const updated = await tenantService.updateTenant(params.id, body, scope.owner_id);
    
    console.log(`[tenants.id.PUT] Tenant ${params.id} updated successfully`);
    return apiResponse({
      success: true,
      data: updated
    });
  } catch (error: any) {
    console.error(`Detailed API Error [tenants.id.PUT] (${params.id}):`, error);
    const msg = typeof error?.message === "string" ? error.message : String(error);
    
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    if (msg.startsWith("VALIDATION")) return apiError(msg.split(": ")[1] ?? msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("ALREADY_EXISTS")) return apiError(msg.split(": ")[1] ?? msg, "ALREADY_EXISTS", 409);
    if (msg.startsWith("CAPACITY_EXCEEDED")) return apiError(msg.split(": ")[1] ?? msg, "CAPACITY_EXCEEDED", 409);
    
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    console.warn(`[tenants.id.DELETE] Forbidden access attempt by ${session?.role} ${session?.sub}`);
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    console.log(`[tenants.id.DELETE] Deleting tenant ${params.id} for owner ${scope.owner_id}`);
    
    const result = await tenantService.deleteTenant(params.id, scope.owner_id);
    
    console.log(`[tenants.id.DELETE] Tenant ${params.id} deleted successfully`);
    return apiResponse({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error(`Detailed API Error [tenants.id.DELETE] (${params.id}):`, error);
    const msg = typeof error?.message === "string" ? error.message : String(error);
    
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(": ")[1] ?? msg, "FORBIDDEN", 403);
    
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
