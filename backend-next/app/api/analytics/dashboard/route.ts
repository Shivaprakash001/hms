import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
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
    const stats = await dashboardService.getOwnerStats(session.sub);
    const monthlyTrend = await dashboardService.getMonthlyStats(session.sub);

    return apiResponse({
      metrics: stats,
      trends: monthlyTrend,
      generated_at: new Date().toISOString()
    });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch dashboard analytics");
  }
}
