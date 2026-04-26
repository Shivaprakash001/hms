export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { rentGenerationService } from "@/lib/services/rent-generation-service";


/**
 * 🕐 CRON — Monthly Rent Generation
 * GET /api/cron/generate-rent
 * 
 * Called by Vercel Cron on the 1st of every month.
 * Protected by CRON_SECRET bearer token.
 * 
 * Idempotent: safe to call multiple times.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await rentGenerationService.generateMonthlyRent();

    console.log("[CRON] Monthly rent generation complete:", summary);

    return NextResponse.json({
      success: true,
      ...summary
    });
  } catch (error: any) {
    console.error("[CRON] Rent generation failed:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Rent generation failed"
    }, { status: 500 });
  }
}
