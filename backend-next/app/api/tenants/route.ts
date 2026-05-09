export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantService } from "@/lib/services/tenant-service";
import { planGate, TenantHardCapError } from "@/lib/services/plan-gate-service";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";


/**
 * 👨‍🎓 TENANTS — List & Create
 * GET  /api/tenants/ — List all tenants with search and filters
 * POST /api/tenants/ — Enroll a new tenant (admin/warden only)
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const parsedLimit = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;

    const hostelId = searchParams.get("hostelId") || undefined;
    await requireHostelBelongsToOwner(scope.owner_id, hostelId);
    if (!hostelId) return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);

    const result = await tenantService.getAllTenants({
      status, search, ownerId: scope.owner_id, limit, offset,
      hostelId, // Phase 4: hostel isolation
    });

    return apiResponse(result);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch tenants");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json();
    
    if (!body.profile_id) {
      return apiError("profile_id is required", "VALIDATION_ERROR", 400);
    }
    if (!body.monthly_rent || body.monthly_rent <= 0) {
      return apiError("monthly_rent must be > 0", "VALIDATION_ERROR", 400);
    }

    await planGate.assertTenantLimit(scope.owner_id);

    const tenant = await tenantService.createTenant(body, scope.owner_id);
    return apiResponse(tenant, 201);
  } catch (error: any) {
    if (error instanceof TenantHardCapError) {
      return NextResponse.json({
        error: {
          code: "TENANT_HARD_CAP_EXCEEDED",
          message: `Tenant hard cap reached (${error.current}/${error.hard_cap}). Upgrade to ${error.recommended_plan} to add more tenants.`,
          upgrade_required: true,
          recommended_plan: error.recommended_plan,
          current_count: error.current,
          hard_cap: error.hard_cap,
        }
      }, { status: 402 });
    }
    if (error.message?.startsWith("PLAN_LIMIT:")) {
      const code = error.message.replace("PLAN_LIMIT:", "").trim();
      return apiError(code, code, 402);
    }
    return apiError(error.message || "Failed to create tenant enrollment");
  }
}
