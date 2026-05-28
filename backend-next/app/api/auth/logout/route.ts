export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth";
import { sessionLifecycleService } from "@/lib/services/session-lifecycle-service";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("hms_refresh_token")?.value;

    if (refreshToken) {
      console.log("[auth.logout] Clearing refresh token session");
      const tokenHash = hashToken(refreshToken);
      const tokenRecord = await prisma.refresh_tokens.findUnique({
        where: { token_hash: tokenHash },
        select: { session_id: true, user_id: true },
      });
      if (tokenRecord) {
        await sessionLifecycleService.revokeSession(tokenRecord.session_id || undefined, tokenRecord.user_id);
      }
    }

    const response = NextResponse.json({ success: true });
    
    response.cookies.set("hms_session", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    });

    response.cookies.set("hms_refresh_token", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Detailed API Error [auth.logout]:", error);
    
    // Even if DB fails, clear cookies and return success if possible, 
    // or return a standard error if it's a critical failure.
    const response = NextResponse.json({ 
      success: true, 
      warning: "Session partially cleared" 
    });
    
    response.cookies.set("hms_session", "", { httpOnly: true, expires: new Date(0), path: "/" });
    response.cookies.set("hms_refresh_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
    
    return response;
  }
}
