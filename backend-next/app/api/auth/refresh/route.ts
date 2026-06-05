export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { apiError, generateToken, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  getSessionCookieOptions,
  TENANT_REFRESH_DAYS,
} from "@/lib/services/session-lifecycle-service";
import { getClientIp } from "@/lib/security/api-guard";
import { clearCsrfCookie, setCsrfCookie } from "@/lib/security/csrf";

function sessionError(reason: string) {
  if (reason === "inactive") {
    return apiError(
      "You were signed out because your account was inactive for more than 30 minutes.",
      "SESSION_INACTIVE",
      401,
    );
  }
  if (reason === "absolute_expired") {
    return apiError(
      "Your secure session reached its maximum duration. Please sign in again.",
      "SESSION_MAX_AGE_REACHED",
      401,
    );
  }
  if (reason === "reused") {
    return apiError(
      "We detected unusual session activity. Please sign in again to protect your account.",
      "SESSION_REUSE_DETECTED",
      403,
    );
  }
  if (reason === "disabled") {
    return apiError("Account is disabled", "FORBIDDEN", 403);
  }
  return apiError("Your secure session has expired. Please sign in again.", "UNAUTHORIZED", 401);
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set("hms_session", "", { httpOnly: true, expires: new Date(0), path: "/" });
  response.cookies.set("hms_refresh_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  clearCsrfCookie(response);
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("hms_refresh_token")?.value;

    if (!refreshToken) {
      return apiError("Your secure session has expired. Please sign in again.", "UNAUTHORIZED", 401);
    }

    const now = new Date();
    const tokenRecord = await prisma.refresh_tokens.findUnique({
      where: { token_hash: hashToken(refreshToken) },
      include: { profiles: true },
    });

    if (!tokenRecord || !tokenRecord.profiles) {
      return clearSessionCookies(sessionError("expired"));
    }

    if (!tokenRecord.profiles.is_active) {
      return clearSessionCookies(sessionError("disabled"));
    }

    if (tokenRecord.absolute_expires_at && now > tokenRecord.absolute_expires_at) {
      return clearSessionCookies(sessionError("absolute_expired"));
    }

    if (now > tokenRecord.expires_at) {
      return clearSessionCookies(sessionError("expired"));
    }

    const wasRotatedByLegacyRefresh = Boolean(tokenRecord.revoked_at && tokenRecord.rotated_at);
    if (tokenRecord.revoked_at && !wasRotatedByLegacyRefresh) {
      return clearSessionCookies(sessionError("expired"));
    }

    let effectiveOwnerId = tokenRecord.profiles.owner_id;
    if (tokenRecord.profiles.role === "OWNER" && (!effectiveOwnerId || effectiveOwnerId.trim() === "")) {
      console.warn("[auth.refresh] repairing missing owner_id for OWNER", { user_id: tokenRecord.profiles.id });
      const updated = await prisma.profile.update({
        where: { id: tokenRecord.profiles.id },
        data: { owner_id: tokenRecord.profiles.id },
        select: { owner_id: true },
      });
      effectiveOwnerId = updated.owner_id;
    }

    if (tokenRecord.profiles.role === "OWNER" && !effectiveOwnerId) {
      return apiError("Invalid OWNER: missing owner_id", "UNAUTHORIZED", 401);
    }

    let tenantId: string | null = null;
    if (tokenRecord.profiles.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: tokenRecord.profiles.id },
        select: { id: true },
      });
      tenantId = tenant?.id || null;
    }

    const sessionId = tokenRecord.session_id || tokenRecord.id;
    await prisma.refresh_tokens.updateMany({
      where: {
        user_id: tokenRecord.user_id,
        session_id: tokenRecord.session_id,
        revoked_at: null,
        expires_at: { gt: now },
      },
      data: {
        last_activity_at: now,
        device_info: req.headers.get("user-agent") || tokenRecord.device_info,
        ip_address: getClientIp(req) || tokenRecord.ip_address,
      },
    });

    const newAccessToken = await generateToken({
      sub: tokenRecord.profiles.id,
      role: tokenRecord.profiles.role,
      email: tokenRecord.profiles.email,
      owner_id: effectiveOwnerId || null,
      tenant_id: tenantId,
      sid: sessionId,
    });

    const response = NextResponse.json({
      access_token: newAccessToken,
      refreshed_at: new Date().toISOString(),
    }, { status: 200 });

    response.cookies.set("hms_session", newAccessToken, {
      ...getSessionCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    });

    response.cookies.set("hms_refresh_token", refreshToken, {
      ...getSessionCookieOptions(60 * 60 * 24 * TENANT_REFRESH_DAYS),
    });
    setCsrfCookie(response, 60 * 60 * 24 * TENANT_REFRESH_DAYS);

    return response;
  } catch (error: any) {
    const message = String(error?.message || "");
    const code = String(error?.code || "").toUpperCase();

    console.error("[auth.refresh] refresh failed", {
      code: error?.code,
      message,
    });

    if (code === "FORBIDDEN" || message.startsWith("FORBIDDEN")) {
      return clearSessionCookies(apiError("Please sign in again.", "FORBIDDEN", 403));
    }

    if (
      code === "UNAUTHORIZED" ||
      code === "P2025" ||
      message.startsWith("UNAUTHORIZED") ||
      /refresh token|session|token|profile|user/i.test(message)
    ) {
      return clearSessionCookies(sessionError("expired"));
    }

    return clearSessionCookies(apiError("Your secure session has expired. Please sign in again.", "UNAUTHORIZED", 401));
  }
}
