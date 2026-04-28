export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantService } from "@/lib/services/tenant-service";


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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const parsedLimit = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;
    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Number.isNaN(parsedOffset) ? 0 : parsedOffset;

    const result = await tenantService.getAllTenants({
      status, search, ownerId: session.sub, limit, offset
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
    const body = await req.json();
    
    if (!body.profile_id) {
      return apiError("profile_id is required", "VALIDATION_ERROR", 400);
    }
    if (!body.monthly_rent || body.monthly_rent <= 0) {
      return apiError("monthly_rent must be > 0", "VALIDATION_ERROR", 400);
    }

    const tenant = await tenantService.createTenant(body, session.sub);
    return apiResponse(tenant, 201);
  } catch (error: any) {
    return apiError(error.message || "Failed to create tenant enrollment");
  }
}
