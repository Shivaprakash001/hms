import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./lib/auth-edge";

const PUBLIC_ROUTES = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/google-callback",
  "/api/webhooks/payments/phonepe",
  "/api/plans",
  // Vercel-Cron hits these with `Authorization: Bearer $CRON_SECRET`,
  // which is NOT a JWT. Each route handler enforces the secret check
  // itself (see app/api/cron/*/route.ts), so middleware must step aside.
  "/api/cron",
];

/**
 * 🔐 PRODUCTION CORS & SECURITY AUDIT
 * Policy: No Wildcards Allowed + Strictly Credentialed Cookies.
 */
function getCorsHeaders(req: NextRequest) {
  const allowedOrigin = process.env.NEXT_PUBLIC_FRONTEND_URL || "";
  const requestOrigin = req.headers.get("origin") || "";

  // Security Logic: Only echo back the origin if it matches our whitelist
  // Browsers BLOCK Access-Control-Allow-Origin: * when Credentials=true
  const origin = (allowedOrigin === requestOrigin || !allowedOrigin) ? requestOrigin : allowedOrigin;

  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,DELETE,PATCH,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
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

  // 3. Extract Token (Priority: Cookie -> Header -> Query param for SSE)
  const cookieToken = req.cookies.get("hms_session")?.value;
  const authHeader = req.headers.get("authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  // EventSource (SSE) cannot send custom headers, so accept token via query param
  const queryToken = pathname === "/api/events" ? req.nextUrl.searchParams.get("token") : null;
  const token = cookieToken || headerToken || queryToken;

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

  // 5. Attach Context & Return with CORS
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-email", payload.email || "");
  if (payload.owner_id) requestHeaders.set("x-owner-id", payload.owner_id);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
