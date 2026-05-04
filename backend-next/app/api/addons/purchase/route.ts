export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-edge";
import { prisma } from "@/lib/db";
import { PaymentProviderFactory } from "@/lib/services/payments/provider-factory";
import { getLogger } from "@/lib/logger";
import { eventLog } from "@/lib/services/event-log-service";
import crypto from "crypto";

const logger = getLogger("addons.purchase");

// ─── Addon pack catalog ───────────────────────────────────────────────────────

const ADDON_PACKS: Record<string, { credits: number; amount: number; label: string }> = {
  "200": { credits: 200, amount:  99, label: "200 Reminders — ₹99" },
  "500": { credits: 500, amount: 199, label: "500 Reminders — ₹199" },
};

/**
 * POST /api/addons/purchase
 * Creates a PhonePe payment intent for a reminder credit pack.
 *
 * Body: { pack: "200" | "500" }
 * Response: { checkout_url, attempt_id, amount, credits }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { pack } = body;

    if (!pack || !ADDON_PACKS[pack]) {
      return NextResponse.json({
        error: "VALIDATION_ERROR",
        message: `Invalid pack. Choose one of: ${Object.keys(ADDON_PACKS).join(", ")}`,
      }, { status: 400 });
    }

    const packDef = ADDON_PACKS[pack];

    // Get provider config (PhonePe credentials from env)
    const config = await getProviderConfig(user.sub);
    const provider = "PHONEPE";
    const instance = PaymentProviderFactory.getProvider(provider, config);

    const profile = await prisma.profile.findUnique({
      where: { id: user.sub },
      select: { name: true, email: true, phone: true },
    });

    const merchantTxnId = `addon_${user.sub.replace(/-/g, "").substring(0, 8)}_${crypto.randomBytes(4).toString("hex")}`;

    // Create the attempt record — use `as any` for addon_pack until migration is applied
    const attempt = await (prisma.paymentAttempt as any).create({
      data: {
        owner_id: user.sub,
        provider,
        merchant_txn_id: merchantTxnId,
        amount: packDef.amount,
        status: "CREATED",
        payment_type: "ADDON",
        addon_pack: pack,
      },
    });

    logger.info("addons.purchase.intent_start", {
      owner_id: user.sub,
      pack,
      amount: packDef.amount,
      attempt_id: attempt.id,
    });

    const result = await instance.createIntent({
      amount: packDef.amount,
      merchant_txn_id: merchantTxnId,
      tenant_name: profile?.name || "Owner",
      tenant_email: profile?.email || "",
      tenant_phone: profile?.phone || "",
      metadata: {
        payment_type: "ADDON",
        addon_pack: pack,
        owner_id: user.sub,
        attempt_id: attempt.id,
        credits: packDef.credits,
      },
    });

    const updated = await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "PENDING",
        gateway_txn_id: result.gateway_txn_id,
        checkout_url: result.checkout_url,
        expires_at: result.expires_at,
        raw_create_response: result.raw_response as any,
      },
    });

    logger.info("addons.purchase.intent_ready", {
      attempt_id: attempt.id,
      checkout_url: result.checkout_url ? "present" : "missing",
    });

    // Analytics: log purchase trigger for conversion funnel analysis
    const trigger = body?.trigger || "manual"; // 'empty' | 'low' | 'manual'
    await eventLog.log("ADDON_PURCHASE_INITIATED", user.sub, {
      pack,
      amount: packDef.amount,
      credits: packDef.credits,
      trigger,
      attempt_id: updated.id,
    }).catch(() => {});

    return NextResponse.json({
      checkout_url: result.checkout_url,
      attempt_id: updated.id,
      amount: packDef.amount,
      credits: packDef.credits,
      pack,
    });
  } catch (err: any) {
    logger.error("addons.purchase.failed", { error: err?.message });
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 });
  }
}

async function getProviderConfig(ownerId: string) {
  const hostel = await prisma.hostel.findFirst({
    where: { owner_id: ownerId, is_active: true },
    select: { upi_id: true },
  });

  return {
    merchantId: process.env.PHONEPE_MERCHANT_ID!,
    saltKey: process.env.PHONEPE_SALT_KEY!,
    saltIndex: process.env.PHONEPE_SALT_INDEX!,
    environment: (process.env.PHONEPE_ENV as "SANDBOX" | "PRODUCTION") || "SANDBOX",
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/payments/phonepe`,
    upiId: hostel?.upi_id || undefined,
  };
}
