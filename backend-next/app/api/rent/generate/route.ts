export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { rentGenerationService } from "@/lib/services/rent-generation-service";
import { requireAutomation } from "@/lib/services/plan-gate-service";
import { invalidateDashboardCache } from "@/lib/cache/dashboard-cache";

/**
 * 🏦 RENT GENERATION — Owner Manual Trigger
 * GET  /api/rent/generate — Preview what will be generated (no automation check needed)
 * POST /api/rent/generate — Actually generate rent obligations (requires automation)
 *
 * Plan gate: POST requires automation feature (Starter+).
 * Free plan owners receive a 402 with upgrade instructions.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get("month");

    let targetDate: Date | undefined;
    if (monthStr) {
      const [year, month] = monthStr.split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, 1));
    }

    const preview = await rentGenerationService.previewMonthlyRent(targetDate, session.sub);
    return apiResponse(preview);
  } catch (error: any) {
    return apiError(error.message || "Failed to preview rent generation");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  // 🔒 Automation gate — Starter plan required
  try {
    await requireAutomation(session.sub);
  } catch (gateErr: any) {
    if (gateErr?.code === "FEATURE_NOT_AVAILABLE") {
      return NextResponse.json({
        error: "FEATURE_NOT_AVAILABLE",
        feature: "automation",
        message: "Upgrade to Starter to enable automation",
        upgrade_required: true,
        recommended_plan: "starter",
      }, { status: 402 });
    }
    throw gateErr;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const monthStr = body?.month;

    let targetDate: Date | undefined;
    if (monthStr) {
      const [year, month] = monthStr.split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, 1));
    }

    const summary = await rentGenerationService.generateMonthlyRent(targetDate, session.sub, "manual");

    try { invalidateDashboardCache(session.sub); } catch { /* best-effort */ }

    return apiResponse(summary, 201);
  } catch (error: any) {
    return apiError(error.message || "Failed to generate rent obligations");
  }
}
