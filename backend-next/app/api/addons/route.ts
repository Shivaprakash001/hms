import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth-edge";

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

    return NextResponse.json({ addon }, { status: 200 });
  } catch (err: any) {
    console.error("[ADDONS] Error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession(req);
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { pack } = await req.json(); // 200 or 500
    if (pack !== 200 && pack !== 500) {
      return NextResponse.json({ error: "INVALID_PACK" }, { status: 400 });
    }

    let addon = await prisma.addonUsage.findUnique({
      where: { owner_id: user.sub },
    });

    if (!addon) {
      addon = await prisma.addonUsage.create({
        data: { owner_id: user.sub, reminders_remaining: pack, reminders_used: 0 },
      });
    } else {
      addon = await prisma.addonUsage.update({
        where: { owner_id: user.sub },
        data: { reminders_remaining: { increment: pack } },
      });
    }

    return NextResponse.json({ addon }, { status: 200 });
  } catch (err: any) {
    console.error("[ADDONS] POST Error:", err?.message);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}