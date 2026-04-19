import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { propertyService } from "@/lib/services/property-service";

export const runtime = "nodejs";

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
    if (error.message.startsWith("VALIDATION"))
      return apiError(error.message.split(": ")[1], "VALIDATION_ERROR", 400);
    if (error.message.startsWith("NOT_FOUND"))
      return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    return apiError(error.message || "Failed to update preferences");
  }
}
