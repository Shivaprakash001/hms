import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { activityService } from "@/lib/services/activity-service";

export const runtime = "nodejs";

/**
 * 🔍 Audit & Activity Timeline
 * Access: Owner/Admin only
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  const type = searchParams.get("type") || undefined;
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  try {
    const activity = await activityService.getOwnerActivity({
      userId: session.sub,
      search,
      type,
      offset,
      limit
    });

    return apiResponse(activity);
  } catch (error: any) {
    return apiError("Failed to fetch activity logs");
  }
}
