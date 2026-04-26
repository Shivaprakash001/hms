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
    const body = await req.json();
    const reason = body.reason || "Rejected by owner";

    // First ensure the student actually belongs to this owner
    const student = await prisma.student.findUnique({
      where: { id: tenantId, owner_id: session.sub }
    });

    if (!student) {
      return NextResponse.json({ error: { message: "Student not found or access denied" } }, { status: 404 });
    }

    // Now update the document
    // We could delete it, or set is_verified false and perhaps store the reason 
    // if the schema supports it. Currently assuming it just sets is_verified: false
    const updated = await prisma.identificationDocument.update({
      where: { 
        id: docId,
        tenant_id: tenantId 
      },
      data: { 
        is_verified: false,
      }
    });

    // Optionally: emit a notification/event to the student that document was rejected
    
    return NextResponse.json({ ...updated, action: "REJECTED", reason });
  } catch (error) {
    console.error("Document reject error:", error);
    return NextResponse.json({ error: { message: "Failed to reject document" } }, { status: 500 });
  }
}
