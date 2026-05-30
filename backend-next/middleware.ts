import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./lib/auth-edge";
import { getCorsAllowOrigin } from "./lib/config/domains";
import { checkSessionRevocationEdge, touchSessionActivityEdge } from "./lib/redis/session-revocation-edge";

const CSRF_COOKIE_NAME = "hms_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const PUBLIC_ROUTES = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/send-phone-otp",
  "/api/auth/verify-phone-otp",
  "/api/auth/refresh",
  "/api/auth/google-callback",
  "/api/tenants/activate",
  "/api/visit",
  "/api/webhooks/payments/phonepe",
  "/api/webhooks/notifications/whatsapp",
  "/api/plans",
  // Vercel-Cron hits these with `Authorization: Bearer $CRON_SECRET`,
  // which is NOT a JWT. Each route handler enforces the secret check
  // itself (see app/api/cron/*/route.ts), so middleware must step aside.
  "/api/cron",
];

function isValidCsrfPair(cookieToken?: string | null, headerToken?: string | null) {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length < 32 || headerToken.length < 32) return false;
  return cookieToken === headerToken;
}

/**
 * 🔐 PRODUCTION CORS & SECURITY AUDIT
 * Policy: No Wildcards Allowed + Strictly Credentialed Cookies.
 */
function getCorsHeaders(req: NextRequest) {
  const requestOrigin = req.headers.get("origin") || "";
  const origin = getCorsAllowOrigin(requestOrigin);

  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,DELETE,PATCH,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
    "Vary": "Origin",
  };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const corsHeaders = getCorsHeaders(req);

  // 1. Handle Preflight Options Request (CORS)
  if (req.method === "OPTIONS") {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  // 2. Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // 3. Extract Token (Priority: Header -> Cookie -> Query param for SSE)
  //    Header takes priority because the frontend explicitly sets it from
  //    localStorage on every request. The cookie may be stale on mobile
  //    browsers that block cross-origin Set-Cookie (Safari ITP, etc.).
  const authHeader = req.headers.get("authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const cookieToken = req.cookies.get("hms_session")?.value;
  const queryToken = pathname === "/api/events" ? req.nextUrl.searchParams.get("token") : null;
  const token = headerToken || cookieToken || queryToken;

  if (!token) {
    return NextResponse.json(
      { error: { message: "Authentication required", code: "UNAUTHORIZED" } },
      { status: 401, headers: corsHeaders }
    );
  }

  // 4. Verify Token
  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: { message: "Invalid session", code: "UNAUTHORIZED" } },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const revocation = await checkSessionRevocationEdge(payload);
    if (!revocation.ok) {
      return NextResponse.json(
        { error: { message: "Your secure session has expired. Please sign in again.", code: "SESSION_REVOKED" } },
        { status: 401, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.warn("[middleware] session revocation check unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (UNSAFE_METHODS.has(req.method)) {
    const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value;
    const csrfHeader = req.headers.get(CSRF_HEADER_NAME);
    if (!isValidCsrfPair(csrfCookie, csrfHeader)) {
      return NextResponse.json(
        { error: { message: "Security check failed. Refresh the page and try again.", code: "CSRF_VALIDATION_FAILED" } },
        { status: 403, headers: corsHeaders }
      );
    }
  }

  // 5. Attach Context & Return with CORS
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-email", payload.email || "");
  if (payload.owner_id) requestHeaders.set("x-owner-id", payload.owner_id);
  if (payload.tenant_id) requestHeaders.set("x-tenant-id", payload.tenant_id);
  if (payload.sid) requestHeaders.set("x-session-id", payload.sid);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (payload.sid) {
    touchSessionActivityEdge(payload.sid).catch((error) => {
      console.warn("[middleware] session activity touch failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
  
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
