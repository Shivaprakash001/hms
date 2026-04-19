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
    if (error.message.startsWith("NOT_FOUND"))
      return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    return apiError(error.message || "Failed to fetch owner profile");
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
    if (error.message.startsWith("VALIDATION"))
      return apiError(error.message.split(": ")[1], "VALIDATION_ERROR", 400);
    return apiError(error.message || "Failed to update owner profile");
  }
}
