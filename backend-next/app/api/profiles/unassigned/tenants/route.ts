export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiError, apiResponse } from "@/lib/auth";
import { prisma } from "@/lib/db";


/**
 * GET /api/profiles/unassigned/tenants
 * Returns tenant profiles that are not currently allocated to an active room.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const tenants = await prisma.tenants.findMany({
      where: {
        owner_id: session.sub,
        status: { not: "LEFT" },
        allocations: {
          none: {
            is_active: true,
            end_date: null,
          },
        },
      },
      select: {
        id: true,
        profile_id: true,
        status: true,
        profile: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const profiles = tenants.map((tenant) => ({
      id: tenant.profile_id,
      tenant_id: tenant.id,
      name: tenant.profile.name,
      email: tenant.profile.email,
      phone: tenant.profile.phone,
      status: tenant.status,
    }));

    return apiResponse({ profiles });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch unassigned tenants");
  }
}
