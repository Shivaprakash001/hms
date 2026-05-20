export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = params;

    // Owners see documents of their tenants, tenants can only see their own
    if (session.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: session.sub },
      });
      if (!tenant || tenant.id !== id) {
        return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
      }
    }

    const documents = await prisma.identificationDocument.findMany({
      where: {
        tenant_id: id,
        is_active: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    console.error("Fetch documents error:", error);
    return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
  }
}
