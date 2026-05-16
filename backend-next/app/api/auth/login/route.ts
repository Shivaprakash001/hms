export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";
import { LoginSchema } from "@/lib/validators";


/**
 * 🔐 AUTH LOGIN (Production Secure)
 * Now sets a secure, HTTP-only cookie for session management.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log(`[auth.login] Attempting login for email: ${body?.email}`);
    
    const validated = LoginSchema.safeParse(body);
    
    if (!validated.success) {
      console.warn(`[auth.login] Validation failed for ${body?.email}`);
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const { email, password } = validated.data;
    const loginResult = await authService.login(email, password);
    
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
