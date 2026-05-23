export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const requiredDocumentTypes = (profileType?: string | null) => {
  const type = String(profileType || "STUDENT").toUpperCase();
  return type === "WORKING_PROFESSIONAL" ? ["AADHAAR", "WORK_ID"] : ["AADHAAR", "COLLEGE_ID"];
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = params;

    // Owners see documents of their tenants, tenants can only see their own.
    // Admin may inspect across owners.
    let tenantProfileType: string | null | undefined;
    if (session.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: session.sub },
        select: { id: true, profile_type: true },
      });
      if (!tenant || tenant.id !== id) {
        return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
      }
      tenantProfileType = tenant.profile_type;
    } else if (session.role === "OWNER") {
      const tenant = await prisma.tenants.findFirst({
        where: { id, owner_id: session.sub },
        select: { id: true, profile_type: true },
      });
      if (!tenant) {
        return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
      }
      tenantProfileType = tenant.profile_type;
    } else if (session.role !== "ADMIN") {
      return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
    } else {
      const tenant = await prisma.tenants.findUnique({
        where: { id },
        select: { profile_type: true },
      });
      tenantProfileType = tenant?.profile_type;
    }

    const requiredDocuments = requiredDocumentTypes(tenantProfileType);
    const documents = await prisma.identificationDocument.findMany({
      where: {
        tenant_id: id,
        is_active: true,
        doc_type: { in: requiredDocuments },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({ success: true, data: { documents, required_documents: requiredDocuments } });
  } catch (error) {
    console.error("Fetch documents error:", error);
    return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
  }
}
