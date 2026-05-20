export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { notifyMoveOutTransition } from "@/lib/services/move-out-notifications";
import { moveOutService } from "@/lib/services/move-out-service";

/**
 * 🕐 CRON — Daily Move-Out Room Releases
 * GET /api/cron/move-out-releases
 *
 * Runs daily at midnight. Processes COMPLETED move-outs where:
 *   - physical_exit_date has passed
 *   - room has NOT been released yet (room_release_date is null)
 *
 * Actions:
 *   1. Deactivate room allocation
 *   2. Set tenant status to LEFT
 *   3. Record room_release_date
 *
 * Protected by CRON_SECRET.
 * Idempotent: safe to call multiple times.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find COMPLETED move-outs with past physical exit dates that haven't released rooms
    const pending = await prisma.move_out_requests.findMany({
      where: {
        status: "COMPLETED",
        room_release_date: null,
        physical_exit_date: { lte: now },
      },
      select: { id: true, tenant_id: true, physical_exit_date: true, reason: true, reason_text: true },
    });

    let released = 0;
    let failed = 0;

    for (const req of pending) {
      try {
        const exitDate = req.physical_exit_date || now;

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await moveOutService.executeCompletionSideEffects(
            tx,
            req.tenant_id,
            req.id,
            exitDate,
            req.reason,
            req.reason_text || null,
            now
          );
        });

        released++;
      } catch (err: any) {
        console.error(`[CRON] Room release failed for ${req.id}:`, err.message);
        failed++;
      }
    }

    console.log(`[CRON] Move-out room releases: ${released} released, ${failed} failed, ${pending.length} total`);

    return NextResponse.json({
      success: true,
      processed: pending.length,
      released,
      failed,
    });
  } catch (error: any) {
    console.error("[CRON] Move-out releases failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
