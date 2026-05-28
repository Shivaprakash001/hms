export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { apiError, generateToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  getSessionCookieOptions,
  sessionLifecycleService,
  TENANT_REFRESH_DAYS,
} from "@/lib/services/session-lifecycle-service";
import { getClientIp } from "@/lib/security/api-guard";

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

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("hms_refresh_token")?.value;

    if (!refreshToken) {
      return apiError("Your secure session has expired. Please sign in again.", "UNAUTHORIZED", 401);
    }

    const rotation = await sessionLifecycleService.rotateRefreshToken(refreshToken, {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    if (!rotation.ok) {
      const response = sessionError(rotation.reason);
      response.cookies.set("hms_session", "", { httpOnly: true, expires: new Date(0), path: "/" });
      response.cookies.set("hms_refresh_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
      return response;
    }

    let effectiveOwnerId = rotation.profile.owner_id;
    if (rotation.profile.role === "OWNER" && (!effectiveOwnerId || effectiveOwnerId.trim() === "")) {
      console.warn("[auth.refresh] repairing missing owner_id for OWNER", { user_id: rotation.profile.id });
      const updated = await prisma.profile.update({
        where: { id: rotation.profile.id },
        data: { owner_id: rotation.profile.id },
        select: { owner_id: true },
      });
      effectiveOwnerId = updated.owner_id;
    }

    if (rotation.profile.role === "OWNER" && !effectiveOwnerId) {
      return apiError("Invalid OWNER: missing owner_id", "UNAUTHORIZED", 401);
    }

    let tenantId: string | null = null;
    if (rotation.profile.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: rotation.profile.id },
        select: { id: true },
      });
      tenantId = tenant?.id || null;
    }

    const newAccessToken = await generateToken({
      sub: rotation.profile.id,
      role: rotation.profile.role,
      email: rotation.profile.email,
      owner_id: effectiveOwnerId || null,
      tenant_id: tenantId,
      sid: rotation.sessionId,
    });

    const response = NextResponse.json({
      access_token: newAccessToken,
      refreshed_at: new Date().toISOString(),
    }, { status: 200 });

    response.cookies.set("hms_session", newAccessToken, {
      ...getSessionCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    });

    response.cookies.set("hms_refresh_token", rotation.refreshToken, {
      ...getSessionCookieOptions(60 * 60 * 24 * TENANT_REFRESH_DAYS),
    });

    return response;
  } catch (error: any) {
    return apiError(error.message || "Failed to refresh secure session", "INTERNAL_ERROR", 500);
  }
}
