export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("hms_refresh_token")?.value;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refresh_tokens.deleteMany({
        where: { token_hash: tokenHash }
      });
    }
  } catch (error) {
    console.error("Failed to delete refresh token during logout", error);
    // Continue with logout anyway
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
}
