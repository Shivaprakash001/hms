export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";


export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        role: true,
        owner_id: true,
        is_profile_completed: true
      }
    });

    if (!profile) return apiError("Session expired. Please log in again.", "UNAUTHORIZED", 401);

    const extra: any = {};
    let tenantId: string | null = null;

    if (profile.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: profile.id },
        include: {
          room_allocations: {
            where: { is_active: true },
            orderBy: { created_at: "desc" },
            take: 1,
            include: { room: true }
          }
        }
      });

      if (tenant) {
      tenantId = tenant.id;
      extra.monthly_rent = tenant.monthly_rent;
      extra.tenant_status = tenant.status;
      extra.is_profile_completed = tenant.profile_completed || profile.is_profile_completed;

      const activeAlloc = (tenant as any).room_allocations[0];
      if (activeAlloc) {
        extra.room_id = activeAlloc.room_id;
        extra.room_no = activeAlloc.room.room_no;
        extra.room_capacity = activeAlloc.room.capacity;
      }
      }
    } else {
      extra.is_profile_completed = profile.is_profile_completed;
    }

    return apiResponse({
      user_id: profile.id,
      owner_id: profile.role === "OWNER" ? profile.id : profile.owner_id,
      email: profile.email,
      role: profile.role,
      tenant_id: tenantId,
      is_admin: profile.role === "ADMIN",
      is_owner: profile.role === "OWNER",
      is_tenant: profile.role === "TENANT",
      ...extra
    });
  } catch (error) {
    return apiError("Internal server error");
  }
}
