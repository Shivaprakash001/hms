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

    const student = await prisma.student.findUnique({
      where: {
        id: id,
        owner_id: session.sub, // Enforce multi-tenant boundary!
      },
      include: {
        profile: true,
        documents: true,
        allocations: {
          where: { is_active: true, end_date: null },
          orderBy: { start_date: "desc" },
          take: 1,
          include: { room: true },
        },
        payments: {
          take: 5,
          orderBy: { created_at: "desc" },
        },
        obligations: {
          take: 5,
          orderBy: { due_date: "desc" },
        }
      },
    });

    if (!student) {
      return NextResponse.json({ error: { message: "Student not found" } }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error("Full profile fetch error:", error);
    return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
  }
}
