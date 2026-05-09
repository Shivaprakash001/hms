export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { activationAnalyticsService } from "@/lib/services/activation-analytics-service";
import { abandonmentService } from "@/lib/services/abandonment-service";

/**
 * GET /api/admin/activation-analytics
 *
 * Returns the full onboarding funnel metrics for the admin panel.
 * Includes: funnel steps, milestones, time-to-value, abandonment breakdown.
 *
 * Query params:
 *   from: ISO date string (optional)
 *   to:   ISO date string (optional)
 *
 * POST /api/admin/activation-analytics/nudges
 *   Trigger the abandonment nudge batch manually (also runs via cron).
 */

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "ADMIN") {
    return apiError("Admin access required", "FORBIDDEN", 403);
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
  const to   = searchParams.get("to")   ? new Date(searchParams.get("to")!)   : undefined;

  try {
    const [funnel, milestones, timeToValue] = await Promise.all([
      activationAnalyticsService.getFunnelMetrics(from, to),
      activationAnalyticsService.getActivationMilestones(),
      activationAnalyticsService.getTimeToValue(),
    ]);

    return apiResponse({ funnel, milestones, time_to_value: timeToValue });
  } catch (error: any) {
    console.error("[ACTIVATION ANALYTICS]", error);
    return apiError(error?.message || "Failed to fetch activation analytics");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "ADMIN") {
    return apiError("Admin access required", "FORBIDDEN", 403);
  }

  try {
    const result = await abandonmentService.processAbandonmentNudges();
    return apiResponse({ ok: true, ...result });
  } catch (error: any) {
    console.error("[ABANDONMENT NUDGES]", error);
    return apiError(error?.message || "Failed to process abandonment nudges");
  }
}
