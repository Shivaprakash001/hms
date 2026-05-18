export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { portfolioPerformanceService } from "@/lib/services/portfolio-performance-service";

/**
 * GET /api/dashboard/portfolio-performance
 * Portfolio-wide revenue trends and hostel rankings (owner scope).
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const parsed = parseInt(searchParams.get("months") || "6", 10);
    const months = Number.isNaN(parsed) ? 6 : parsed;
    const data = await portfolioPerformanceService.getPortfolioPerformance(session.sub, months);
    return apiResponse(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch portfolio performance";
    return apiError(message);
  }
}
