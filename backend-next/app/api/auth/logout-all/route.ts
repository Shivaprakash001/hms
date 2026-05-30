export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { apiError, getSession } from "@/lib/auth";
import { sessionLifecycleService } from "@/lib/services/session-lifecycle-service";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Authentication required", "UNAUTHORIZED", 401);

  await sessionLifecycleService.revokeSession(undefined, session.sub);

  const response = NextResponse.json({ success: true });
  response.cookies.set("hms_session", "", { httpOnly: true, expires: new Date(0), path: "/" });
  response.cookies.set("hms_refresh_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  response.cookies.set("hms_csrf", "", { expires: new Date(0), path: "/" });
  return response;
}
