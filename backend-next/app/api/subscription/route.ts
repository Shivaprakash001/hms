export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth-edge";
import { planEnforcementService } from "@/lib/services/plan-enforcement-service";

export async function GET(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const subscription = await planEnforcementService._getOwnerSubscription(user.sub).catch(() => null);

    return NextResponse.json({ subscription }, { status: 200 });
  } catch (err: any) {
    console.error("[SUBSCRIPTION] Error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}