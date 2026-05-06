export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth-edge";

/**
 * GET /api/billing/plans
 * Fetch all plans and current subscription for an owner.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Fetch all plans
    const plans = await prisma.plan.findMany({
      orderBy: { price_inr: "asc" },
      select: {
        id: true,
        name: true,
        price_inr: true,
        tenant_limit: true,
        hostel_limit: true,
        automation: true,
        multi_hostel: true,
        analytics: true,
        profile_photo: true,
        document_verification: true,
        is_custom: true,
        can_generate_receipts: true,
        features: true,
      },
    });

    // Fetch owner's current subscription
    const subscription = await prisma.ownerSubscription.findUnique({
      where: { owner_id: user.sub },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            price_inr: true,
            tenant_limit: true,
            hostel_limit: true,
            automation: true,
            multi_hostel: true,
            analytics: true,
            profile_photo: true,
            document_verification: true,
            is_custom: true,
            can_generate_receipts: true,
            features: true,
          },
        },
      }
    });

    return NextResponse.json({
      plans: plans.map((p) => ({
        ...p,
        price: p.price_inr / 100,
        amount_paise: p.price_inr,
        addons_enabled: p.id !== "FREE",
        is_custom_pricing: p.id === "SCALE",
        is_popular: p.id === "GROWTH",
      })),
      subscription
    }, { status: 200 });
  } catch (err: any) {
    console.error("[PLANS] Error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
