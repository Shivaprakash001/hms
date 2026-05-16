export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { billingService } from "@/src/services/payments/billing-service";


export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const usage = await billingService.getOwnerUsage(session.sub);
    return apiResponse(usage);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch usage statistics");
  }
}
