export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { dashboardService } from "@/lib/services/dashboard-service";
import { activityService } from "@/lib/services/activity-service";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const { searchParams } = new URL(req.url);
  const monthsStr = searchParams.get("months");
  const months = monthsStr ? parseInt(monthsStr, 10) : 6;

  try {
    // Run everything in parallel! The real secret to production performance
    const [summary, monthlyStats, activityRes] = await Promise.all([
      dashboardService.getOwnerStats(session.sub),
      dashboardService.getMonthlyStats(session.sub, months),
      activityService.getOwnerActivity({ userId: session.sub, limit: 5, offset: 0 }).catch(() => ({ items: [], total: 0 }))
    ]);

    return apiResponse({
      stats: summary,
      collectionData: monthlyStats,
      recentActivity: activityRes?.items || []
    });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch dashboard");
  }
}
