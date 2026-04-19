import { NextRequest, NextResponse } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";
import { LoginSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * 🔐 AUTH LOGIN (Production Secure)
 * Now sets a secure, HTTP-only cookie for session management.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = LoginSchema.safeParse(body);
    
    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const { email, password } = validated.data;
    const loginResult = await authService.login(email, password);
    
    const response = NextResponse.json(loginResult, { status: 200 });

    // Set HTTP-only Cookie for security (Prevents XSS)
    response.cookies.set("hms_session", loginResult.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days              
      path: "/",
    });

    return response;
  } catch (error: any) {
    if (
      error?.message?.includes("DATABASE_URL") ||
      error?.message?.includes("Error validating datasource") ||
      error?.message?.includes("Authentication failed against database server") ||
      error?.message?.includes("provided database credentials")
    ) {
      return apiError(
        "Server configuration error: the Vercel backend database connection is missing, invalid, or using incorrect credentials.",
        "SERVER_MISCONFIGURED",
        500
      );
    }
    if (error.message.startsWith("UNAUTHORIZED")) return apiError(error.message.split(": ")[1], "UNAUTHORIZED", 401);
    if (error.message.startsWith("FORBIDDEN")) return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    return apiError(error.message || "Login failed");
  }
}
