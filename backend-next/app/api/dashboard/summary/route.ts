export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";
import { dashboardService } from "@/lib/services/dashboard-service";
import { getCachedDashboard, setDashboardCache } from "@/lib/cache/dashboard-cache";
import { redisKeys } from "@/lib/redis/keys";


/**
 * 📊 DASHBOARD SUMMARY / STATS
 * GET — Owner/Admin dashboard statistics
 * Frontend calls both /dashboard/summary and /dashboard/stats — both return the same data.
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
    const cacheKey = redisKeys.dashboard.stats(scope.owner_id, hostelId);
    const cached = await getCachedDashboard(cacheKey);
    if (cached) return apiResponse(cached);

    const stats = await dashboardService.getOwnerStats(scope.owner_id, hostelId);
    await setDashboardCache(cacheKey, stats, 45, [
      redisKeys.tag.ownerDashboard(scope.owner_id),
      redisKeys.tag.hostelDashboard(hostelId),
    ]);
    return apiResponse(stats);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch dashboard stats");
  }
}
