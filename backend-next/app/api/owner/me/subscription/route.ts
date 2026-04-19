import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { billingService } from "@/lib/services/billing-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const details = await billingService.getSubscriptionDetails(session.sub);
    return apiResponse(details);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch subscription details");
  }
}
