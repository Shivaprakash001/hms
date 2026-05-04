export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-edge";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { eventLog } from "@/lib/services/event-log-service";

const logger = getLogger("addons.usage");

/**
 * GET /api/addons/usage
 * Returns reminder credit balance + auto-topup flag + reconciliation status.
 *
 * PATCH /api/addons/usage
 * Updates auto_topup preference.
 * Body: { auto_topup: boolean, trigger?: string }  (trigger for analytics)
 */

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    let addon = await prisma.addonUsage.findUnique({
      where: { owner_id: user.sub },
    });

    if (!addon) {
      addon = await prisma.addonUsage.create({
        data: { owner_id: user.sub, reminders_remaining: 0, reminders_used: 0 },
      });
    }

    const remaining = Number(addon.reminders_remaining);
    const used      = Number(addon.reminders_used);

    // Check if a cron-stop event happened (auto reminders paused)
    const lastExhausted = await prisma.systemEventLog.findFirst({
      where: {
        owner_id:   user.sub,
        event_type: "AUTO_TOPUP_TRIGGERED",
      },
      orderBy: { created_at: "desc" },
      select:  { created_at: true },
    }).catch(() => null);

    return NextResponse.json({
      reminders_remaining:  remaining,
      reminders_used:       used,
      auto_topup:           (addon as any).auto_topup ?? false,
      // Dashboard alert: true when cron was stopped due to zero credits
      cron_stopped:         remaining === 0 && !!lastExhausted,
      last_exhausted_at:    lastExhausted?.created_at ?? null,
    });
  } catch (err: any) {
    logger.error("addons.usage.get_error", { error: err?.message });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { auto_topup, trigger } = body;

    if (typeof auto_topup !== "boolean") {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "auto_topup must be boolean" }, { status: 400 });
    }

    await prisma.addonUsage.upsert({
      where: { owner_id: user.sub },
      update: { auto_topup } as any,
      create: { owner_id: user.sub, reminders_remaining: 0, reminders_used: 0, auto_topup } as any,
    });

    // Analytics: log auto-topup toggle
    await eventLog.log("ADDON_AUTO_TOPUP_CHANGED", user.sub, {
      auto_topup,
      trigger: trigger || "settings",
    }).catch(() => {});

    logger.info("addons.auto_topup.changed", { owner_id: user.sub, auto_topup });

    return NextResponse.json({ ok: true, auto_topup });
  } catch (err: any) {
    logger.error("addons.usage.patch_error", { error: err?.message });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
