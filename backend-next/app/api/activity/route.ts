import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { activityService } from "@/lib/services/activity-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * 📊 Activity Collection
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const type = searchParams.get("event_type") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const activity = await activityService.getOwnerActivity({
      userId: session.sub,
      search,
      type,
      limit,
      offset
    });

    return apiResponse(activity);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch activity");
  }
}
