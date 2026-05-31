export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80) || "document";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id: tenantId, docId } = params;
  const doc = await prisma.identificationDocument.findUnique({
    where: { id: docId },
    include: { tenant: { select: { id: true, profile_id: true, owner_id: true } } },
  });

  if (!doc || doc.tenant_id !== tenantId || !doc.is_active) {
    return NextResponse.json({ error: { message: "Document not found" } }, { status: 404 });
  }

  if (session.role === "TENANT" && doc.tenant.profile_id !== session.sub) {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  if (session.role === "OWNER" && doc.tenant.owner_id !== session.sub) {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  if (!["TENANT", "OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }

  const upstream = await fetch(doc.file_url, { cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json({ error: { message: "Document file unavailable" } }, { status: 502 });
  }

  const body = await upstream.arrayBuffer();
  const contentType = doc.mime_type || upstream.headers.get("content-type") || "application/octet-stream";
  const extension = contentType.includes("pdf")
    ? "pdf"
    : contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeFileName(`${doc.doc_type.toLowerCase()}-${doc.id}.${extension}`)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
