import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";

const requiredDocumentTypes = (profileType?: string | null) => {
  const type = String(profileType || "STUDENT").toUpperCase();
  return type === "WORKING_PROFESSIONAL" ? ["AADHAAR", "WORK_ID"] : ["AADHAAR", "COLLEGE_ID"];
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = params;

    const ownerScope = session.role === "OWNER" ? resolveOwnerScope(session).owner_id : null;
    const tenant = await prisma.tenants.findFirst({
      where: {
        id,
        ...(ownerScope ? { owner_id: ownerScope } : {}),
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

    const requiredDocuments = requiredDocumentTypes(tenant.profile_type);
    return NextResponse.json({
      ...tenant,
      identification_documents: (tenant.identification_documents || []).filter((doc) =>
        requiredDocuments.includes(doc.doc_type)
      ),
      required_document_types: requiredDocuments,
    });
  } catch (error) {
    console.error("Full profile fetch error:", error);
    return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
  }
}
