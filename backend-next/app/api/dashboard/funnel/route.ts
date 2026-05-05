export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { analyticsService, getDateRange } from "@/lib/services/analytics-service";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const { searchParams } = new URL(req.url);
  const { start, end } = getDateRange(searchParams.get("from"), searchParams.get("to"));

  try {
    const data = await analyticsService.getReminderFunnelDashboard(session.sub, start, end);
    return apiResponse(data);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch reminder funnel data");
  }
}
