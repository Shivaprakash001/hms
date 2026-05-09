export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { dashboardService } from "@/lib/services/dashboard-service";


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
    const hostelId = req.nextUrl.searchParams.get("hostelId") || undefined;
    const stats = await dashboardService.getOwnerStats(session.sub, hostelId);
    return apiResponse(stats);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch dashboard stats");
  }
}
