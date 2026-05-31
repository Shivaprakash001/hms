export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { dashboardService } from "@/lib/services/dashboard-service";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";
import { getCachedDashboard, setDashboardCache } from "@/lib/cache/dashboard-cache";
import { redisKeys } from "@/lib/redis/keys";

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

    const cacheKey = redisKeys.dashboard.statsActivity(scope.owner_id, hostelId);
    const cached = await getCachedDashboard(cacheKey);
    if (cached) return apiResponse(cached);

    const activity = await dashboardService.getOwnerStatsActivity(scope.owner_id, hostelId);
    await setDashboardCache(cacheKey, activity, 60, [
      redisKeys.tag.ownerDashboard(scope.owner_id),
      redisKeys.tag.hostelDashboard(hostelId),
    ]);

    return apiResponse(activity);
  } catch (error: any) {
    console.error("Detailed API Error [dashboard.stats-activity]:", error);
    return apiError(error.message || "Failed to fetch dashboard stats activity");
  }
}
