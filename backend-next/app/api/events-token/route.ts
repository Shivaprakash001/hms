import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError, generateShortToken } from "@/lib/auth";

/**
 * GET /api/events-token
 * Issues a short-lived (60s) JWT for SSE connections.
 * The frontend fetches this, then passes it as a query param to /api/events.
 * Even if the URL appears in logs, the token is worthless after 60 seconds.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  const sseToken = await generateShortToken({
    sub: session.sub,
    email: session.email || "",
    role: session.role,
    owner_id: session.owner_id,
  });

  return apiResponse({ token: sseToken });
}
