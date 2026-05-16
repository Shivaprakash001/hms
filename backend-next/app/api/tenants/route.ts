export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { tenantService } from "@/src/services/tenants/tenant-service";
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
    console.warn(`[tenants.GET] Forbidden access attempt by user ${session?.sub}`);
    return ApiResponse.error(ApiError.forbidden("Forbidden"));
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
    
    console.log(`[tenants.GET] Fetching tenants for owner ${scope.owner_id}, hostel ${hostelId}`);
    
    await requireHostelBelongsToOwner(scope.owner_id, hostelId);
    if (!hostelId) {
      console.warn("[tenants.GET] Missing hostelId context");
      return ApiResponse.error(ApiError.validationError("hostelId is required", { code: "HOSTEL_CONTEXT_REQUIRED" }));
    }

    const result = await tenantService.getAllTenants({
      status, search, ownerId: scope.owner_id, limit, offset,
      hostelId,
    });

    return ApiResponse.success({ ...result });
  } catch (error: any) {
    console.error("Detailed API Error [tenants.GET]:", error);
    return ApiResponse.error(ApiError.internal(error.message || "Internal Server Error"));
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    console.warn(`[tenants.POST] Forbidden access attempt by user ${session?.sub}`);
    return ApiResponse.error(ApiError.forbidden("Forbidden"));
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json().catch(() => ({}));
    
    console.log(`[tenants.POST] Creating tenant for owner ${scope.owner_id}`, body);

    if (!body.profile_id) {
      return ApiResponse.error(ApiError.validationError("profile_id is required"));
    }
    if (!body.monthly_rent || body.monthly_rent <= 0) {
      return ApiResponse.error(ApiError.validationError("monthly_rent must be > 0"));
    }

    await planGate.assertTenantLimit(scope.owner_id);

    const tenant = await tenantService.createTenant(body, scope.owner_id);
    
    console.log(`[tenants.POST] Tenant created: ${tenant.id}`);
    
    return ApiResponse.success(tenant, 201);
  } catch (error: any) {
    console.error("Detailed API Error [tenants.POST]:", error);
    
    if (error instanceof TenantHardCapError) {
      return NextResponse.json({
        success: false,
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
      return ApiResponse.error(new ApiError(402, code, code));
    }
    
    return ApiResponse.error(ApiError.internal(error.message || "Internal Server Error"));
  }
}
