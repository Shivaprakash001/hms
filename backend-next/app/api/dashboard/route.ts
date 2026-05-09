export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { dashboardService } from "@/lib/services/dashboard-service";
import { activityService } from "@/lib/services/activity-service";
import { getCachedDashboard, setDashboardCache } from "@/lib/cache/dashboard-cache";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { assertHostelBelongsToOwner } from "@/lib/security/scoped-query";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const { searchParams } = new URL(req.url);
  const monthsStr = searchParams.get("months");
  const months = monthsStr ? parseInt(monthsStr, 10) : 6;
  const hostelId = searchParams.get("hostelId") || undefined; // Phase 4: hostel isolation

  let scope;
  try {
    scope = resolveOwnerScope(session);
    await assertHostelBelongsToOwner(scope.owner_id, hostelId);
  } catch (error: any) {
    return apiError(error.message || "Forbidden", error.code || "FORBIDDEN", error.code === "UNAUTHORIZED" ? 401 : 403);
  }

  const cacheKey = `${scope.owner_id}_${months}_${hostelId || "ALL"}`;

  const cachedResult = getCachedDashboard(cacheKey);
  if (cachedResult) {
    return apiResponse(cachedResult);
  }

  try {
    // Run everything in parallel! The real secret to production performance
    const [summary, monthlyStats, activityRes] = await Promise.all([
      dashboardService.getOwnerStats(scope.owner_id, hostelId),
      dashboardService.getMonthlyStats(scope.owner_id, months, hostelId),
      activityService.getOwnerActivity({ userId: scope.owner_id, limit: 5, offset: 0 }).catch(() => ({ items: [], total: 0 }))
    ]);

    const finalResponse = {
      stats: summary,
      collectionData: monthlyStats,
      recentActivity: activityRes?.items || []
    };

    setDashboardCache(cacheKey, finalResponse);

    return apiResponse(finalResponse);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch dashboard");
  }
}
