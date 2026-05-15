export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiError, apiResponse } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTenantOperationalContext } from "@/lib/hostel-context";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") {
    return apiError("Only tenants can access onboarding settings", "FORBIDDEN", 403);
  }

  try {
    const tenant = await prisma.tenants.findUnique({
      where: { profile_id: session.sub },
      select: { id: true, owner_id: true, hostel_id: true },
    });

    if (!tenant) {
      return apiError("Tenant record not found", "NOT_FOUND", 404);
    }

    const { prefs } = tenant.owner_id
      ? await getTenantOperationalContext(tenant.id, tenant.owner_id, tenant.hostel_id)
      : { prefs: null as any };

    return apiResponse({
      require_profile_photo_onboarding: Boolean(prefs?.require_profile_photo_onboarding),
    });
  } catch (error: any) {
    return apiError(error?.message || "Failed to fetch onboarding settings");
  }
}
