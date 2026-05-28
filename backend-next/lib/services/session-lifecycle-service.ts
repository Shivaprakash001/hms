import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { generateRefreshToken, hashToken } from "@/lib/auth";

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 20 * 60;
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const WARNING_AFTER_MS = 25 * 60 * 1000;
export const TENANT_REFRESH_DAYS = 30;
export const OWNER_ABSOLUTE_MS = 12 * 60 * 60 * 1000;

type SessionUser = {
  id: string;
  role: string;
  email?: string | null;
  owner_id?: string | null;
};

type SessionMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function absoluteExpiryFor(role: string, now = new Date()) {
  if (role === "OWNER" || role === "ADMIN") {
    return new Date(now.getTime() + OWNER_ABSOLUTE_MS);
  }
  return addDays(now, TENANT_REFRESH_DAYS);
}

function isEpochRevoked(date: Date) {
  return date.getTime() === 0;
}

export function getSessionCookieOptions(maxAge: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

export class SessionLifecycleService {
  async createSession(user: SessionUser, meta: SessionMeta = {}) {
    const now = new Date();
    const refreshToken = generateRefreshToken();
    const sessionId = randomUUID();
    const expiresAt = addDays(now, TENANT_REFRESH_DAYS);
    const absoluteExpiresAt = absoluteExpiryFor(user.role, now);

    await prisma.refresh_tokens.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        session_id: sessionId,
        token_hash: hashToken(refreshToken),
        expires_at: expiresAt,
        absolute_expires_at: absoluteExpiresAt,
        last_activity_at: now,
        device_info: meta.userAgent || null,
        ip_address: meta.ipAddress || null,
      },
    });

    return { refreshToken, sessionId, expiresAt, absoluteExpiresAt };
  }

  async rotateRefreshToken(refreshToken: string, meta: SessionMeta = {}) {
    const now = new Date();
    const tokenHash = hashToken(refreshToken);
    const tokenRecord = await prisma.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
      include: { profiles: true },
    });

    if (!tokenRecord) {
      return { ok: false as const, reason: "missing" as const };
    }

    const sessionId = tokenRecord.session_id || tokenRecord.id;

    if (tokenRecord.revoked_at || isEpochRevoked(tokenRecord.expires_at)) {
      await prisma.refresh_tokens.updateMany({
        where: {
          user_id: tokenRecord.user_id,
          OR: [{ id: tokenRecord.id }, ...(tokenRecord.session_id ? [{ session_id: tokenRecord.session_id }] : [])],
        },
        data: { revoked_at: now },
      });
      return { ok: false as const, reason: "reused" as const };
    }

    if (now > tokenRecord.expires_at) {
      await this.revokeTokenFamily(tokenRecord.id, tokenRecord.session_id, tokenRecord.user_id);
      return { ok: false as const, reason: "expired" as const };
    }

    if (tokenRecord.absolute_expires_at && now > tokenRecord.absolute_expires_at) {
      await this.revokeTokenFamily(tokenRecord.id, tokenRecord.session_id, tokenRecord.user_id);
      return { ok: false as const, reason: "absolute_expired" as const };
    }

    if (now.getTime() - tokenRecord.last_activity_at.getTime() > INACTIVITY_TIMEOUT_MS) {
      await this.revokeTokenFamily(tokenRecord.id, tokenRecord.session_id, tokenRecord.user_id);
      return { ok: false as const, reason: "inactive" as const };
    }

    if (!tokenRecord.profiles.is_active) {
      await this.revokeTokenFamily(tokenRecord.id, tokenRecord.session_id, tokenRecord.user_id);
      return { ok: false as const, reason: "disabled" as const };
    }

    const newRefreshToken = generateRefreshToken();
    const expiresAt = addDays(now, TENANT_REFRESH_DAYS);
    const absoluteExpiresAt = tokenRecord.absolute_expires_at || absoluteExpiryFor(tokenRecord.profiles.role, now);

    await prisma.$transaction([
      prisma.refresh_tokens.update({
        where: { id: tokenRecord.id },
        data: {
          revoked_at: now,
          rotated_at: now,
          expires_at: new Date(0),
        },
      }),
      prisma.refresh_tokens.create({
        data: {
          id: randomUUID(),
          user_id: tokenRecord.user_id,
          session_id: sessionId,
          token_hash: hashToken(newRefreshToken),
          expires_at: expiresAt,
          absolute_expires_at: absoluteExpiresAt,
          last_activity_at: now,
          device_info: meta.userAgent || tokenRecord.device_info,
          ip_address: meta.ipAddress || tokenRecord.ip_address,
        },
      }),
    ]);

    return {
      ok: true as const,
      refreshToken: newRefreshToken,
      sessionId,
      expiresAt,
      profile: tokenRecord.profiles,
    };
  }

  async touchSession(sessionId: string | null | undefined, userId: string) {
    if (!sessionId) return false;
    const now = new Date();
    const result = await prisma.refresh_tokens.updateMany({
      where: {
        session_id: sessionId,
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: now },
      },
      data: { last_activity_at: now },
    });
    return result.count > 0;
  }

  async revokeSession(sessionId: string | null | undefined, userId?: string) {
    if (!sessionId && !userId) return;
    await prisma.refresh_tokens.updateMany({
      where: {
        ...(sessionId ? { session_id: sessionId } : {}),
        ...(userId ? { user_id: userId } : {}),
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        expires_at: new Date(0),
      },
    });
  }

  private async revokeTokenFamily(tokenId: string, sessionId: string | null, userId: string) {
    await prisma.refresh_tokens.updateMany({
      where: {
        user_id: userId,
        OR: [{ id: tokenId }, ...(sessionId ? [{ session_id: sessionId }] : [])],
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        expires_at: new Date(0),
      },
    });
  }
}

export const sessionLifecycleService = new SessionLifecycleService();
