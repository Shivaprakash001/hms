import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { dashboardService } from "@/lib/services/dashboard-service";

export const runtime = "nodejs";

/**
 * 📊 DASHBOARD MONTHLY STATS (Charts)
 * GET — Monthly revenue/collection trends for owner dashboard
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") || "6");
    const stats = await dashboardService.getMonthlyStats(session.sub, months);
    return apiResponse(stats);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch monthly stats");
  }
}
