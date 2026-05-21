import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = params;

    const tenant = await prisma.tenants.findFirst({
      where: {
        id,
        ...(session.role === "OWNER" ? { owner_id: session.sub } : {}),
      },
      include: {
        profiles: true,
        room_allocations: {
          where: { is_active: true, end_date: null },
          orderBy: { start_date: "desc" },
          take: 1,
          include: { room: true },
        },
        payments: {
          take: 5,
          orderBy: { created_at: "desc" },
        },
        rent_obligations: {
          take: 5,
          orderBy: { due_date: "desc" },
        },
        identification_documents: {
          where: { is_active: true },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: { message: "Tenant not found" } }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Full profile fetch error:", error);
    return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
  }
}
