import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { propertyService } from "@/lib/services/property-service";

export const runtime = "nodejs";

/**
 * 🏠 OWNER HOSTEL DETAILS
 * PATCH — Update hostel info (name, phone, address, upi, etc.)
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const result = await propertyService.updateHostel(session.sub, body);
    return apiResponse(result);
  } catch (error: any) {
    const msg = typeof error === "string" ? error : (error && typeof error.message === "string" ? error.message : String(error));
    if (msg.startsWith("NOT_FOUND"))
      return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    return apiError(msg || "Failed to update hostel details");
  }
}
