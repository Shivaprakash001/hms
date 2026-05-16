export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { billingService } from "@/src/services/payments/billing-service";


/**
 * 💰 Billing & Subscription Center
 * Access: Owner only
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "OWNER") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const billingInfo = await billingService.getSubscriptionDetails(session.sub);
    return apiResponse(billingInfo);
  } catch (error: any) {
    return apiError("Failed to fetch billing information");
  }
}
