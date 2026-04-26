export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { rentGenerationService } from "@/lib/services/rent-generation-service";
import { invalidateDashboardCache } from "@/lib/cache/dashboard-cache";


/**
 * 🏦 RENT GENERATION — Owner Manual Trigger
 * GET  /api/rent/generate — Preview what will be generated
 * POST /api/rent/generate — Actually generate rent obligations
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const monthStr = searchParams.get("month"); // optional: "2026-05"

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

  try {
    const body = await req.json().catch(() => ({}));
    const monthStr = body?.month; // optional: "2026-05"

    let targetDate: Date | undefined;
    if (monthStr) {
      const [year, month] = monthStr.split("-").map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, 1));
    }

    const summary = await rentGenerationService.generateMonthlyRent(targetDate, session.sub);

    // Invalidate dashboard cache so next load reflects new obligations
    invalidateDashboardCache(session.sub);

    return apiResponse(summary, 201);
  } catch (error: any) {
    return apiError(error.message || "Failed to generate rent obligations");
  }
}
