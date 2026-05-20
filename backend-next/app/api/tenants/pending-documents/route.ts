export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const hostelId = searchParams.get("hostelId");

    const documents = await prisma.identificationDocument.findMany({
      where: {
        document_status: "PENDING",
        is_active: true,
        tenant: {
          owner_id: session.sub,
          ...(hostelId ? { hostel_id: hostelId } : {}),
        },
      },
      include: {
        tenant: {
          include: {
            profiles: {
              select: {
                name: true,
                phone: true,
              },
            },
            room_allocations: {
              where: { is_active: true },
              include: {
                room: {
                  select: {
                    room_no: true,
                  },
                },
              },
            },
            hostel: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const items = documents.map((doc) => {
      const activeAlloc = doc.tenant.room_allocations[0];
      return {
        id: doc.id,
        tenant_id: doc.tenant_id,
        doc_type: doc.doc_type,
        file_url: doc.file_url,
        uploaded_at: doc.created_at,
        tenant_name: doc.tenant.profiles?.name || "Tenant",
        tenant_phone: doc.tenant.profiles?.phone || doc.tenant.phone_1 || "",
        room_no: activeAlloc?.room?.room_no || "N/A",
        hostel_name: doc.tenant.hostel?.name || "Hostel",
        hostel_id: doc.tenant.hostel_id,
      };
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("Fetch pending documents error:", error);
    return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
  }
}
