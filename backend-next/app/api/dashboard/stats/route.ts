export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { dashboardSnapshotService } from "@/lib/services/dashboard-snapshot-service";


/**
 * 📊 DASHBOARD STATS
 * GET — Same as /dashboard/summary (frontend calls both)
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const stats = await dashboardSnapshotService.getOwnerStats(session.sub);
    return apiResponse(stats);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch dashboard stats");
  }
}
