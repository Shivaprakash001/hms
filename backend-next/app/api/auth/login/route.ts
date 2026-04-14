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
    const { user, token } = await authService.login(email, password);
    
    const response = NextResponse.json({ user, token }, { status: 200 });

    // Set HTTP-only Cookie for security (Prevents XSS)
    response.cookies.set("hms_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days              
      path: "/",
    });

    return response;
  } catch (error: any) {
    if (error.message.startsWith("UNAUTHORIZED")) return apiError(error.message.split(": ")[1], "UNAUTHORIZED", 401);
    return apiError(error.message || "Login failed");
  }
}
