import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";
import { ACCESS_TOKEN_MAX_AGE_SECONDS, getSessionCookieOptions, TENANT_REFRESH_DAYS } from "@/lib/services/session-lifecycle-service";
import { setCsrfCookie } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * 🔐 GOOGLE CALLBACK
 */
export async function POST(req: NextRequest) {
  try {
    const { code, redirect_uri } = await req.json();
    
    if (!code) {
      return apiError("Missing authorization code", "VALIDATION_ERROR", 400);
    }

    const loginResult = await authService.googleLogin(code, redirect_uri, {
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    });

    const { refresh_token, ...jsonResponse } = loginResult;
    const response = NextResponse.json(jsonResponse, { status: 200 });

    response.cookies.set("hms_session", loginResult.access_token, {
      ...getSessionCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    });

    response.cookies.set("hms_refresh_token", refresh_token, {
      ...getSessionCookieOptions(60 * 60 * 24 * TENANT_REFRESH_DAYS),
    });
    setCsrfCookie(response, 60 * 60 * 24 * TENANT_REFRESH_DAYS);

    return response;
  } catch (error: any) {
    if (error.message.startsWith("UNAUTHORIZED")) 
      return apiError(error.message.split(": ")[1], "UNAUTHORIZED", 401);
    if (error.message.startsWith("FORBIDDEN"))
      return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    return apiError(error.message || "Google authentication failed");
  }
}
