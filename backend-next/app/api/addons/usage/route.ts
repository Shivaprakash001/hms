export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-edge";
import { getReminderCredits } from "@/lib/services/plan-gate-service";
import { prisma } from "@/lib/db";

/**
 * GET /api/addons/usage
 * Returns reminder credit balance for the authenticated owner.
 * Used by the Preferences page to decide whether to show the credit-exhausted banner.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Auto-create addon row if missing (free users start with 0 credits)
    let addon = await prisma.addonUsage.findUnique({
      where: { owner_id: user.sub },
    });

    if (!addon) {
      addon = await prisma.addonUsage.create({
        data: { owner_id: user.sub, reminders_remaining: 0, reminders_used: 0 },
      });
    }

    return NextResponse.json({
      reminders_remaining: Number(addon.reminders_remaining),
      reminders_used: Number(addon.reminders_used),
    });
  } catch (err: any) {
    console.error("[ADDONS/USAGE] Error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
