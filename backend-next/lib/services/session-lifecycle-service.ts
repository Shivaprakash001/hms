import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { generateRefreshToken, hashToken } from "@/lib/auth";
import {
  getSessionActivity,
  markSessionRevoked,
  markUserSessionsRevokedAfter,
  touchSessionActivity,
} from "@/lib/redis/session-revocation";

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 12 * 60 * 60;
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const WARNING_AFTER_MS = 25 * 60 * 1000;
export const TENANT_REFRESH_DAYS = 30;
export const OWNER_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

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

type SessionLifecycleDeps = {
  prismaClient?: typeof prisma;
  generateRefreshTokenFn?: () => string;
  hashTokenFn?: (token: string) => string;
  getSessionActivityFn?: typeof getSessionActivity;
  touchSessionActivityFn?: typeof touchSessionActivity;
  markSessionRevokedFn?: typeof markSessionRevoked;
  markUserSessionsRevokedAfterFn?: typeof markUserSessionsRevokedAfter;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function absoluteExpiryFor(role: string, now = new Date()) {
  if (role === "OWNER") {
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
  private readonly db: typeof prisma;
  private readonly generateRefreshTokenValue: () => string;
  private readonly hashTokenValue: (token: string) => string;
  private readonly getSessionActivityValue: typeof getSessionActivity;
  private readonly touchSessionActivityValue: typeof touchSessionActivity;
  private readonly markSessionRevokedValue: typeof markSessionRevoked;
  private readonly markUserSessionsRevokedAfterValue: typeof markUserSessionsRevokedAfter;

  constructor(deps: SessionLifecycleDeps = {}) {
    this.db = deps.prismaClient || prisma;
    this.generateRefreshTokenValue = deps.generateRefreshTokenFn || generateRefreshToken;
    this.hashTokenValue = deps.hashTokenFn || hashToken;
    this.getSessionActivityValue = deps.getSessionActivityFn || getSessionActivity;
    this.touchSessionActivityValue = deps.touchSessionActivityFn || touchSessionActivity;
    this.markSessionRevokedValue = deps.markSessionRevokedFn || markSessionRevoked;
    this.markUserSessionsRevokedAfterValue =
      deps.markUserSessionsRevokedAfterFn || markUserSessionsRevokedAfter;
  }

  async createSession(user: SessionUser, meta: SessionMeta = {}) {
    const now = new Date();
    const refreshToken = this.generateRefreshTokenValue();
    const sessionId = randomUUID();
    const expiresAt = addDays(now, TENANT_REFRESH_DAYS);
    const absoluteExpiresAt = absoluteExpiryFor(user.role, now);

    await this.db.refresh_tokens.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        session_id: sessionId,
        token_hash: this.hashTokenValue(refreshToken),
        expires_at: expiresAt,
        absolute_expires_at: absoluteExpiresAt,
        last_activity_at: now,
        device_info: meta.userAgent || null,
        ip_address: meta.ipAddress || null,
      },
    });
    await this.touchSessionActivityValue(sessionId);

    return { refreshToken, sessionId, expiresAt, absoluteExpiresAt };
  }

  async rotateRefreshToken(refreshToken: string, meta: SessionMeta = {}) {
    const now = new Date();
    const tokenHash = this.hashTokenValue(refreshToken);
    const tokenRecord = await this.db.refresh_tokens.findUnique({
      where: { token_hash: tokenHash },
      include: { profiles: true },
    });

    if (!tokenRecord) {
      return { ok: false as const, reason: "missing" as const };
    }

    const sessionId = tokenRecord.session_id || tokenRecord.id;

    if (!tokenRecord.profiles) {
      await this.revokeTokenFamily(tokenRecord.id, tokenRecord.session_id, tokenRecord.user_id);
      return { ok: false as const, reason: "expired" as const };
    }

    if (tokenRecord.revoked_at || isEpochRevoked(tokenRecord.expires_at)) {
      await this.revokeAllUserSessions(tokenRecord.user_id);
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

    const redisActivityMs = await this.getSessionActivityValue(sessionId);
    const effectiveLastActivityMs = Math.max(
      tokenRecord.last_activity_at.getTime(),
      Number(redisActivityMs || 0),
    );

    if (now.getTime() - effectiveLastActivityMs > INACTIVITY_TIMEOUT_MS) {
      await this.revokeTokenFamily(tokenRecord.id, tokenRecord.session_id, tokenRecord.user_id);
      return { ok: false as const, reason: "inactive" as const };
    }

    if (!tokenRecord.profiles.is_active) {
      await this.revokeTokenFamily(tokenRecord.id, tokenRecord.session_id, tokenRecord.user_id);
      return { ok: false as const, reason: "disabled" as const };
    }

    const newRefreshToken = this.generateRefreshTokenValue();
    const expiresAt = addDays(now, TENANT_REFRESH_DAYS);
    const absoluteExpiresAt = tokenRecord.absolute_expires_at || absoluteExpiryFor(tokenRecord.profiles.role, now);

    const rotated = await this.db.$transaction(async (tx) => {
      const rotateResult = await tx.refresh_tokens.updateMany({
        where: {
          id: tokenRecord.id,
          token_hash: tokenHash,
          revoked_at: null,
          expires_at: { gt: now },
        },
        data: {
          revoked_at: now,
          rotated_at: now,
          expires_at: new Date(0),
        },
      });

      if (rotateResult.count !== 1) return false;

      await tx.refresh_tokens.create({
        data: {
          id: randomUUID(),
          user_id: tokenRecord.user_id,
          session_id: sessionId,
          token_hash: this.hashTokenValue(newRefreshToken),
          expires_at: expiresAt,
          absolute_expires_at: absoluteExpiresAt,
          last_activity_at: now,
          device_info: meta.userAgent || tokenRecord.device_info,
          ip_address: meta.ipAddress || tokenRecord.ip_address,
        },
      });

      return true;
    });

    if (!rotated) {
      await this.revokeAllUserSessions(tokenRecord.user_id);
      return { ok: false as const, reason: "reused" as const };
    }
    await this.touchSessionActivityValue(sessionId);

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
    const activityTouch = await this.touchSessionActivityValue(sessionId);
    if (activityTouch.available && !activityTouch.touched) {
      return true;
    }
    const result = await this.db.refresh_tokens.updateMany({
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
    const revokedAt = Date.now();
    await this.db.refresh_tokens.updateMany({
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
    if (sessionId) await this.markSessionRevokedValue(sessionId);
    if (!sessionId && userId) await this.markUserSessionsRevokedAfterValue(userId, revokedAt);
  }

  private async revokeTokenFamily(tokenId: string, sessionId: string | null, userId: string) {
    await this.db.refresh_tokens.updateMany({
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
    if (sessionId) await this.markSessionRevokedValue(sessionId);
  }

  private async revokeAllUserSessions(userId: string) {
    const revokedAt = Date.now();
    await this.db.refresh_tokens.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(revokedAt),
        expires_at: new Date(0),
      },
    });
    await this.markUserSessionsRevokedAfterValue(userId, revokedAt);
  }
}

export const sessionLifecycleService = new SessionLifecycleService();
