export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { assertHostelBelongsToOwner } from "@/lib/security/scoped-query";
import { analyticsService, getDateRange } from "@/lib/services/analytics-service";
import { timed } from "@/lib/perf";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const { searchParams } = new URL(req.url);
  const { start, end } = getDateRange(searchParams.get("from"), searchParams.get("to"));
  const hostelId = searchParams.get("hostelId") || undefined; // Phase 4: hostel isolation

  try {
    const scope = resolveOwnerScope(session);
    await assertHostelBelongsToOwner(scope.owner_id, hostelId);
    const data = await timed(
      "analytics.funnel",
      () => analyticsService.getReminderFunnelDashboard(scope.owner_id, start, end, hostelId),
      { owner_id: scope.owner_id, slow_ms: 1_500 }
    );
    return apiResponse(data);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch reminder funnel data");
  }
}
