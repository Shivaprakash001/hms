import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { tenantId: string, docId: string } }) {
  try {
    const session = await getSession(req);
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { tenantId, docId } = params;

    // First ensure the student actually belongs to this owner
    const student = await prisma.student.findUnique({
      where: { id: tenantId, owner_id: session.sub }
    });

    if (!student) {
      return NextResponse.json({ error: { message: "Student not found or access denied" } }, { status: 404 });
    }

    // Now update the document
    const updated = await prisma.identificationDocument.update({
      where: { 
        id: docId,
        tenant_id: tenantId 
      },
      data: { 
        is_verified: true,
        // Optional: you could also track `verified_by: session.sub` if the schema supported it
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Document verify error:", error);
    return NextResponse.json({ error: { message: "Failed to verify document" } }, { status: 500 });
  }
}
