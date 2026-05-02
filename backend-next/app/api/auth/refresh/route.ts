export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateToken, generateRefreshToken, hashToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("hms_refresh_token")?.value;

    if (!refreshToken) {
      return apiError("No refresh token provided", "UNAUTHORIZED", 401);
    }

    const tokenHash = hashToken(refreshToken);

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { profile: true },
    });

    if (!tokenRecord) {
      return apiError("Invalid refresh token", "UNAUTHORIZED", 401);
    }

    // SECURITY: Refresh Token Reuse Detection
    // We mark consumed tokens by setting their expires_at to 1970-01-01T00:00:00.000Z.
    // If someone tries to use a consumed token, we assume compromise.
    if (tokenRecord.expires_at.getTime() === 0) {
      console.warn(`[SECURITY] Refresh token reuse detected for user ${tokenRecord.profile.id}`);
      await prisma.refreshToken.deleteMany({ where: { user_id: tokenRecord.profile.id } });
      return apiError("Session compromised. Please log in again.", "FORBIDDEN", 403);
    }

    if (new Date() > tokenRecord.expires_at) {
      // Delete normally expired token
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      return apiError("Refresh token expired", "UNAUTHORIZED", 401);
    }

    if (!tokenRecord.profile.is_active) {
      return apiError("Account is disabled", "FORBIDDEN", 403);
    }

    let effectiveOwnerId = tokenRecord.profile.owner_id;
    if (tokenRecord.profile.role === "OWNER" && (!effectiveOwnerId || effectiveOwnerId.trim() === "")) {
      console.warn("[auth.refresh] repairing missing owner_id for OWNER", { user_id: tokenRecord.profile.id });
      const updated = await prisma.profile.update({
        where: { id: tokenRecord.profile.id },
        data: { owner_id: tokenRecord.profile.id },
        select: { owner_id: true },
      });
      effectiveOwnerId = updated.owner_id;
    }

    if (tokenRecord.profile.role === "OWNER" && !effectiveOwnerId) {
      return apiError("Invalid OWNER: missing owner_id", "UNAUTHORIZED", 401);
    }

    // Generate new tokens (Rotation)
    const newAccessToken = await generateToken({
      sub: tokenRecord.profile.id,
      role: tokenRecord.profile.role,
      email: tokenRecord.profile.email,
      owner_id: effectiveOwnerId || null,
    });

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    // Consume old token (set to epoch) and create new one
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { expires_at: new Date(0) }
      }),
      prisma.refreshToken.create({
        data: {
          user_id: tokenRecord.profile.id,
          token_hash: newRefreshTokenHash,
          expires_at: expiresAt,
        },
      }),
    ]);

    const response = NextResponse.json({ access_token: newAccessToken }, { status: 200 });

    response.cookies.set("hms_session", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    response.cookies.set("hms_refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    return apiError(error.message || "Failed to refresh token", "INTERNAL_ERROR", 500);
  }
}
