import { getRedisClient } from "@/lib/redis/client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("whatsapp-selection-state");

export interface BalanceSelectionState {
  phone: string;
  action: "BALANCE_SELECTION";
  tenantIds: string[];
  createdAt: string;
  expiresAt: string;
}

const memoryState = new Map<string, { state: BalanceSelectionState; expiresAt: number }>();

function getRedisKey(phone: string): string {
  // Use prefix/version conventions consistent with keys.ts
  const prefix = process.env.REDIS_KEY_PREFIX || "hms";
  return `${prefix}:v1:whatsapp:selection:${phone}`;
}

export async function getSelectionState(phone: string): Promise<BalanceSelectionState | null> {
  const redisKey = getRedisKey(phone);
  const redis = getRedisClient();

  if (redis) {
    try {
      const val = await redis.get<BalanceSelectionState>(redisKey);
      if (val) {
        return val;
      }
    } catch (err) {
      logger.warn("whatsapp.redis.getSelectionState.error", {
        phone,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback to local memory state
  const entry = memoryState.get(phone);
  if (!entry) return null;
  return entry.state;
}

export async function setSelectionState(
  phone: string,
  state: Omit<BalanceSelectionState, "createdAt" | "expiresAt">,
  ttlSeconds = 600
): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlSeconds * 1000);

  const fullState: BalanceSelectionState = {
    ...state,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const redisKey = getRedisKey(phone);
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(redisKey, fullState, { ex: ttlSeconds });
    } catch (err) {
      logger.warn("whatsapp.redis.setSelectionState.error", {
        phone,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Set local memory state
  memoryState.set(phone, {
    state: fullState,
    expiresAt: expires.getTime(),
  });
}

export async function deleteSelectionState(phone: string): Promise<void> {
  const redisKey = getRedisKey(phone);
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.del(redisKey);
    } catch (err) {
      logger.warn("whatsapp.redis.deleteSelectionState.error", {
        phone,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  memoryState.delete(phone);
}
