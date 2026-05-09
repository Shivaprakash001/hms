export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";
import { dashboardService } from "@/lib/services/dashboard-service";


/**
 * 📊 Advanced Analytics Dashboard
 * Access: Owner/Admin only
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const hostelId = req.nextUrl.searchParams.get("hostelId") || undefined;
    await requireHostelBelongsToOwner(scope.owner_id, hostelId);
    if (!hostelId) return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);
    const stats = await dashboardService.getOwnerStats(scope.owner_id, hostelId);
    const monthlyTrend = await dashboardService.getMonthlyStats(scope.owner_id, hostelId, 6);

    return apiResponse({
      metrics: stats,
      trends: monthlyTrend,
      hostel_scope: hostelId,
      generated_at: new Date().toISOString()
    });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch dashboard analytics");
  }
}
