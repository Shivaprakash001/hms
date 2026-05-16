export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { rentGenerationService } from "@/src/services/payments/rent-generation-service";
import { prisma } from "@/lib/db";


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
    const hostels = await prisma.hostels.findMany({
      where: { is_active: true },
      select: { id: true, owner_id: true },
    });

    const results = [];
    for (const hostel of hostels) {
      const result = await rentGenerationService.generateMonthlyRent(undefined, hostel.owner_id, "cron", hostel.id);
      results.push({ hostel_id: hostel.id, ...result });
    }

    const summary = results.reduce(
      (acc, result: any) => ({
        created: acc.created + Number(result.created || 0),
        skipped: acc.skipped + Number(result.skipped || 0),
        failed: acc.failed + Number(result.failed || 0),
        locked: acc.locked + (result.locked ? 1 : 0),
      }),
      { created: 0, skipped: 0, failed: 0, locked: 0 }
    );

    console.log("[CRON] Monthly rent generation complete:", summary);

    return NextResponse.json({
      success: true,
      ...summary,
      hostels_processed: hostels.length,
      results,
    });
  } catch (error: any) {
    console.error("[CRON] Rent generation failed:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Rent generation failed"
    }, { status: 500 });
  }
}
