import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";

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

    const loginResult = await authService.googleLogin(code, redirect_uri);

    const { refresh_token, ...jsonResponse } = loginResult;
    const response = NextResponse.json(jsonResponse, { status: 200 });

    const isProd = process.env.NODE_ENV === "production";

    response.cookies.set("hms_session", loginResult.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    response.cookies.set("hms_refresh_token", refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    if (error.message.startsWith("UNAUTHORIZED")) 
      return apiError(error.message.split(": ")[1], "UNAUTHORIZED", 401);
    return apiError(error.message || "Google authentication failed");
  }
}
