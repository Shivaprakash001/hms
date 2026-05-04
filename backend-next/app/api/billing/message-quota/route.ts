import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth-edge";
import { planEnforcementService } from "@/lib/services/plan-enforcement-service";

/**
 * GET /api/billing/message-quota
 * Fetch current message credits and packs.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const credits = await planEnforcementService.assertMessageQuota(user.sub, 0); // Don't throw, just fetch
    const packs = await (prisma as any).messagePacks.findMany({
      where: { owner_id: user.sub },
      orderBy: { purchased_at: "desc" }
    });

    return NextResponse.json({ credits, packs }, { status: 200 });
  } catch (err: any) {
    console.error("[MSG QUOTA] Error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * POST /api/billing/message-quota
 * Purchase a message pack (₹99 → 200 messages, ₹199 → 500 messages)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json();
    const { pack_type } = body;

    if (!["200", "500"].includes(pack_type)) {
      return NextResponse.json({ error: "VALIDATION_ERROR: Invalid pack type" }, { status: 400 });
    }

    const packConfig = pack_type === "200" ? { messages: 200, price: 99 } : { messages: 500, price: 199 };

    // Create message pack record
    const id = require("crypto").randomUUID();
    const pack = await (prisma as any).messagePacks.create({
      data: {
        id,
        owner_id: user.sub,
        purchased_at: new Date(),
        messages_total: packConfig.messages,
        messages_remaining: packConfig.messages,
        price_inr: packConfig.price
      }
    });

    return NextResponse.json({ pack }, { status: 201 });
  } catch (err: any) {
    console.error("[MSG PURCHASE] Error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
