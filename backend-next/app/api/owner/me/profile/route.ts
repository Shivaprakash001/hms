import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { propertyService } from "@/lib/services/property-service";

export const runtime = "nodejs";

/**
 * 👤 OWNER PROFILE
 * GET  — Fetch owner profile + hostel + preferences
 * PATCH — Update owner name/phone
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const profile = await propertyService.getOwnerProfile(session.sub);
    return apiResponse(profile);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("NOT_FOUND"))
      return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    return apiError(msg || "Failed to fetch owner profile");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const result = await propertyService.updateOwnerProfile(session.sub, body);
    return apiResponse(result);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("VALIDATION"))
      return apiError(msg.split(": ")[1] ?? msg, "VALIDATION_ERROR", 400);
    return apiError(msg || "Failed to update owner profile");
  }
}
