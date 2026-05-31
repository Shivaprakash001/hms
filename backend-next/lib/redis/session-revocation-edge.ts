import { Redis } from "@upstash/redis";

let edgeRedisClient: Redis | null | undefined;
const SESSION_ACTIVITY_THROTTLE_SECONDS = 5 * 60;
const localActivityTouchMs = new Map<string, number>();

function clean(value: string | number | null | undefined) {
  return encodeURIComponent(String(value ?? "none"));
}

function edgeRedisKey(...parts: Array<string | number | null | undefined>) {
  const prefix = process.env.REDIS_KEY_PREFIX || "hms";
  return [prefix, "v1", ...parts.map(clean)].join(":");
}

const edgeSessionKeys = {
  revoked: (sessionId: string) => edgeRedisKey("session", "revoked", sessionId),
  userRevokedAfter: (userId: string) => edgeRedisKey("session", "user-revoked-after", userId),
  activity: (sessionId: string) => edgeRedisKey("session", "activity", sessionId),
  activityThrottle: (sessionId: string) => edgeRedisKey("session", "activity-throttle", sessionId),
};

function getEdgeRedisClient() {
  if (process.env.REDIS_ENABLED === "false") return null;
  if (edgeRedisClient !== undefined) return edgeRedisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  edgeRedisClient = url && token ? new Redis({ url, token }) : null;
  return edgeRedisClient;
}

export type SessionRevocationCheck =
  | { ok: true }
  | { ok: false; reason: "missing_session" | "session_revoked" | "user_revoked" };

export function evaluateSessionRevocation(
  payload: { sid?: string | null; sub: string; iat?: number },
  sessionRevoked: number | string | null,
  userRevokedAfter: number | string | null,
): SessionRevocationCheck {
  if (!payload.sid) return { ok: false, reason: "missing_session" };
  if (sessionRevoked !== null) return { ok: false, reason: "session_revoked" };

  const issuedAtMs = payload.iat ? payload.iat * 1000 : 0;
  if (userRevokedAfter !== null && issuedAtMs <= Number(userRevokedAfter)) {
    return { ok: false, reason: "user_revoked" };
  }

  return { ok: true };
}

export async function checkSessionRevocationEdge(payload: {
  sid?: string | null;
  sub: string;
  iat?: number;
}): Promise<SessionRevocationCheck> {
  if (!payload.sid) return { ok: false, reason: "missing_session" };

  const redis = getEdgeRedisClient();
  if (!redis) return { ok: true };

  const [sessionRevoked, userRevokedAfter] = await Promise.all([
    redis.get<number>(edgeSessionKeys.revoked(payload.sid)),
    redis.get<number>(edgeSessionKeys.userRevokedAfter(payload.sub)),
  ]);

  return evaluateSessionRevocation(payload, sessionRevoked, userRevokedAfter);
}

export async function touchSessionActivityEdge(sessionId: string | null | undefined) {
  if (!sessionId) return;
  const now = Date.now();
  const lastLocalTouch = localActivityTouchMs.get(sessionId) || 0;
  if (now - lastLocalTouch < SESSION_ACTIVITY_THROTTLE_SECONDS * 1000) return;

  const redis = getEdgeRedisClient();
  if (!redis) return;
  const throttle = await redis.set(edgeSessionKeys.activityThrottle(sessionId), "1", {
    nx: true,
    ex: SESSION_ACTIVITY_THROTTLE_SECONDS,
  });
  if (throttle !== "OK") {
    localActivityTouchMs.set(sessionId, now);
    return;
  }
  await redis.set(edgeSessionKeys.activity(sessionId), now, { ex: 60 * 60 * 24 * 30 });
  localActivityTouchMs.set(sessionId, now);
}
