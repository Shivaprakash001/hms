import { safeRedis } from "./client";
import { redisKeys } from "./keys";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function markSessionRevoked(
  sessionId: string | null | undefined,
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
) {
  if (!sessionId) return false;
  return safeRedis(
    "session.markRevoked",
    (redis) => redis.set(redisKeys.session.revoked(sessionId), Date.now(), { ex: ttlSeconds }).then(() => true),
    false,
  );
}

export async function markUserSessionsRevokedAfter(
  userId: string | null | undefined,
  revokedAfterMs = Date.now(),
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
) {
  if (!userId) return false;
  return safeRedis(
    "session.markUserRevokedAfter",
    (redis) =>
      redis
        .set(redisKeys.session.userRevokedAfter(userId), revokedAfterMs, { ex: ttlSeconds })
        .then(() => true),
    false,
  );
}

export async function touchSessionActivity(
  sessionId: string | null | undefined,
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
) {
  if (!sessionId) return false;
  return safeRedis(
    "session.touchActivity",
    (redis) => redis.set(redisKeys.session.activity(sessionId), Date.now(), { ex: ttlSeconds }).then(() => true),
    false,
  );
}

export async function getSessionActivity(sessionId: string | null | undefined) {
  if (!sessionId) return null;
  return safeRedis<number | null>(
    "session.getActivity",
    (redis) => redis.get<number>(redisKeys.session.activity(sessionId)),
    null,
  );
}
