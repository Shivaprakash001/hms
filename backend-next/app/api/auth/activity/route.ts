export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { apiError, apiResponse, getSession } from "@/lib/auth";
import { sessionLifecycleService } from "@/lib/services/session-lifecycle-service";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Authentication required", "UNAUTHORIZED", 401);

  const touched = await sessionLifecycleService.touchSession(session.sid, session.sub);
  if (!touched) {
    return apiError(
      "Your secure session has expired. Please sign in again.",
      "SESSION_EXPIRED",
      401,
    );
  }

  return apiResponse({ success: true, last_active_at: new Date().toISOString() });
}
