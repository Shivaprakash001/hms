export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { eventSystem } from "@/lib/events";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const hostelId = params.id;
  try {
    const hostel = await prisma.hostels.findFirst({
      where: { id: hostelId, owner_id: session.sub },
      include: { profiles: { select: { name: true } } },
    });
    if (!hostel) return apiError("Hostel not found", "NOT_FOUND", 404);

    let template = await prisma.agreementTemplate.findFirst({
      where: { hostel_id: hostelId, is_active: true },
      orderBy: { created_at: "desc" },
    });

    if (!template) {
      template = await prisma.agreementTemplate.create({
        data: {
          id: crypto.randomUUID(),
          hostel_id: hostelId,
          version: "v1-default",
          title: "Standard Tenant Agreement",
          owner_name: hostel.profiles?.name || hostel.name,
          custom_rules: "",
          is_active: true,
        },
      });
    }

    return apiResponse(template);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch agreement template");
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const hostelId = params.id;
  try {
    const hostel = await prisma.hostels.findFirst({
      where: { id: hostelId, owner_id: session.sub },
    });
    if (!hostel) return apiError("Hostel not found", "NOT_FOUND", 404);

    const body = await req.json();
    const title = String(body.title || "Standard Tenant Agreement").trim();
    const owner_name = String(body.owner_name || "").trim();
    const owner_signature_url = body.owner_signature_url ? String(body.owner_signature_url).trim() : null;
    const custom_rules = String(body.custom_rules || "").trim();

    if (!owner_name) {
      return apiError("Authorized Signatory Name is required", "VALIDATION_ERROR", 400);
    }

    await prisma.agreementTemplate.updateMany({
      where: { hostel_id: hostelId },
      data: { is_active: false },
    });

    const newTemplate = await prisma.agreementTemplate.create({
      data: {
        id: crypto.randomUUID(),
        hostel_id: hostelId,
        version: `v-${Date.now()}`,
        title,
        owner_name,
        owner_signature_url,
        custom_rules,
        is_active: true,
      },
    });

    await eventSystem.trigger("agreement_template_updated", {
      owner_id: session.sub,
      hostel_id: hostelId,
      actionType: "UPDATE",
      version: newTemplate.version,
      title: newTemplate.title,
      owner_signature_url: newTemplate.owner_signature_url,
    }).catch((err: any) => console.error("Event trigger failed:", err));

    return apiResponse(newTemplate);
  } catch (error: any) {
    return apiError(error.message || "Failed to update agreement template");
  }
}
