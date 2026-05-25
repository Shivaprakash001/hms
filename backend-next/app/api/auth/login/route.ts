export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";
import { LoginSchema } from "@/lib/validators";
import { rateLimitService } from "@/lib/services/rate-limit-service";
import { getClientIp } from "@/lib/security/api-guard";


/**
 * 🔐 AUTH LOGIN (Production Secure)
 * Rate-limited per identifier (email) + IP.
 * Sets secure, HTTP-only cookies for session management.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? undefined;

  try {
    const body = await req.json().catch(() => ({}));

    const validated = LoginSchema.safeParse(body);

    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const { email, password } = validated.data;

    // ── Rate limit check (per email identifier + IP) ───────────────────────
    const rlResult = await rateLimitService.checkRateLimit(email, "REGULAR", ip);
    if (!rlResult.allowed) {
      return apiError(
        `Too many login attempts. Please wait ${Math.ceil((rlResult.retryAfterSeconds ?? 900) / 60)} minutes.`,
        "RATE_LIMITED",
        429,
      );
    }

    let loginResult: Awaited<ReturnType<typeof authService.login>>;
    try {
      loginResult = await authService.login(email, password);
    } catch (loginErr: any) {
      // Record failed attempt before re-throwing
      await rateLimitService.recordAttempt(email, "REGULAR", false, ip, req.headers.get("user-agent") ?? undefined, loginErr?.message);
      throw loginErr;
    }

    // Record successful attempt
    await rateLimitService.recordAttempt(email, "REGULAR", true, ip);
    
    // We don't want to return the raw refresh token in the JSON response
    const { refresh_token, ...jsonResponse } = loginResult;

    const response = NextResponse.json({
      success: true,
      ...jsonResponse
    }, { status: 200 });

    const isProd = process.env.NODE_ENV === "production";

    response.cookies.set("hms_session", jsonResponse.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Set HTTP-only Cookie for refresh token (Prevents XSS)
    response.cookies.set("hms_refresh_token", refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    console.log(`[auth.login] Login successful for ${email}`);
    return response;
  } catch (error: any) {
    console.error("Detailed API Error [auth.login]:", error);
    const message = error?.message || "Login failed";

    if (
      message.includes("DATABASE_URL") ||
      message.includes("Error validating datasource") ||
      message.includes("Authentication failed against database server") ||
      message.includes("provided database credentials")
    ) {
      return apiError(
        "Server configuration error: the Vercel backend database connection is missing, invalid, or using incorrect credentials.",
        "SERVER_MISCONFIGURED",
        500
      );
    }
    
    if (message.startsWith("UNAUTHORIZED")) {
      return apiError(message.split(": ")[1] || "Invalid credentials", "UNAUTHORIZED", 401);
    }
    if (message.startsWith("FORBIDDEN")) {
      return apiError(message.split(": ")[1] || "Access denied", "FORBIDDEN", 403);
    }
    if (message.startsWith("PASSWORD_RESET_REQUIRED")) {
      return apiError(
        message.split(": ")[1] || "Password reset required",
        "PASSWORD_RESET_REQUIRED",
        403
      );
    }
    if (message.startsWith("ONBOARDING_EXPIRED")) {
      return apiError(
        message.split(": ")[1] || "Onboarding credentials expired",
        "ONBOARDING_EXPIRED",
        403
      );
    }
    if (message.startsWith("VALIDATION_ERROR")) {
      return apiError(message.split(": ")[1] || "Validation failed", "VALIDATION_ERROR", 400);
    }
    
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
