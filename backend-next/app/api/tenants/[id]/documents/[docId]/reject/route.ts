export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session = await getSession(req);
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id: tenantId, docId } = params;
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || "Verification failed").trim();

    const doc = await prisma.identificationDocument.findUnique({
      where: { id: docId },
      include: { tenant: true },
    });

    if (!doc || doc.tenant_id !== tenantId) {
      return NextResponse.json({ error: { message: "Document not found" } }, { status: 404 });
    }

    // Get owner's name
    const ownerProfile = await prisma.profile.findUnique({
      where: { id: session.sub },
      select: { name: true },
    });
    const ownerName = ownerProfile?.name || "Owner";

    // Initialize/append message thread in rejection_reason
    let messages = [];
    try {
      if (doc.rejection_reason && doc.rejection_reason.startsWith("[") && doc.rejection_reason.endsWith("]")) {
        messages = JSON.parse(doc.rejection_reason);
      } else if (doc.rejection_reason) {
        messages = [{ sender: "owner", sender_name: ownerName, message: doc.rejection_reason, timestamp: doc.updated_at || doc.created_at }];
      }
    } catch {
      messages = [];
    }

    messages.push({
      sender: "owner",
      sender_name: ownerName,
      message: reason,
      timestamp: new Date().toISOString(),
    });

    const updatedDoc = await prisma.identificationDocument.update({
      where: { id: docId },
      data: {
        document_status: "REJECTED",
        is_verified: false,
        rejection_reason: JSON.stringify(messages),
        rejected_by: session.sub,
        rejected_at: new Date(),
      },
    });

    // Notify the tenant
    await prisma.notifications.create({
      data: {
        id: crypto.randomUUID(),
        profile_id: doc.tenant.profile_id,
        title: "Document Rejected",
        message: `Your uploaded ${doc.doc_type} was rejected: "${reason}". Please review and upload a valid copy.`,
        type: "WARNING",
      },
    });

    // Set tenant's document_verified flag to false
    await prisma.tenants.update({
      where: { id: tenantId },
      data: { document_verified: false },
    });

    return NextResponse.json({ success: true, data: updatedDoc });
  } catch (error) {
    console.error("Reject document error:", error);
    return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
  }
}
