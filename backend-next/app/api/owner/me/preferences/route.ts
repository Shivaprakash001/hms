export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { propertyService } from "@/lib/services/property-service";
import { getPreferences } from "@/lib/preferences";

/**
 * GET — Return resolved preferences (defaults merged with hostel overrides).
 * Used by the invite form to prefill advance/maintenance defaults.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }
  try {
    const prefs = await getPreferences(session.sub);
    return apiResponse(prefs);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch preferences");
  }
}

/**
 * ⚙️ OWNER PREFERENCES
 * PATCH — Update hostel preferences (currency, rent_cycle, timezone, etc.)
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const result = await propertyService.updatePreferences(session.sub, body);
    return apiResponse(result);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("VALIDATION"))
      return apiError(msg.split(": ")[1] ?? msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("NOT_FOUND"))
      return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    return apiError(msg || "Failed to update preferences");
  }
}
