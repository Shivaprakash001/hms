import { NextRequest, NextResponse } from "next/server";
import { tenantAnalyticsService } from "@/lib/services/tenant-analytics-service";
import { getLogger } from "@/lib/logger";

const logger = getLogger("cron.tenant-analytics");

export async function POST(req: NextRequest) {
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting background job: recalculateAllTenantScores");
    const result = await tenantAnalyticsService.recalculateAllTenantScores();
    logger.info("Finished background job: recalculateAllTenantScores", result);
    return NextResponse.json(result);
  } catch (error: any) {
    logger.error("Cron tenant analytics failed", { err: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
