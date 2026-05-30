import assert from "node:assert/strict";
import { SessionLifecycleService, INACTIVITY_TIMEOUT_MS } from "@/lib/services/session-lifecycle-service";
import { evaluateSessionRevocation } from "@/lib/redis/session-revocation-edge";

type TokenRecord = {
  id: string;
  user_id: string;
  session_id: string | null;
  token_hash: string;
  expires_at: Date;
  absolute_expires_at: Date | null;
  last_activity_at: Date;
  revoked_at: Date | null;
  rotated_at: Date | null;
  device_info: string | null;
  ip_address: string | null;
  profiles: {
    id: string;
    email: string;
    role: string;
    owner_id: string | null;
    is_active: boolean;
  };
};

const nowPlus = (ms: number) => new Date(Date.now() + ms);
const hash = (token: string) => `hash:${token}`;
const delay = () => new Promise((resolve) => setTimeout(resolve, 0));

function createFakeDb(seed: TokenRecord[]) {
  const records = seed;
  let txLock = Promise.resolve();

  const matchesWhere = (record: TokenRecord, where: any): boolean => {
    if (where.id && record.id !== where.id) return false;
    if (where.token_hash && record.token_hash !== where.token_hash) return false;
    if (where.user_id && record.user_id !== where.user_id) return false;
    if (where.session_id && record.session_id !== where.session_id) return false;
    if (where.revoked_at === null && record.revoked_at !== null) return false;
    if (where.expires_at?.gt && !(record.expires_at > where.expires_at.gt)) return false;
    if (where.OR) {
      const ok = where.OR.some((condition: any) => matchesWhere(record, condition));
      if (!ok) return false;
    }
    return true;
  };

  const refresh_tokens = {
    async findUnique({ where }: any) {
      await delay();
      const record = records.find((candidate) => candidate.token_hash === where.token_hash);
      return record ? { ...record, profiles: { ...record.profiles } } : null;
    },
    async updateMany({ where, data }: any) {
      let count = 0;
      for (const record of records) {
        if (!matchesWhere(record, where)) continue;
        Object.assign(record, data);
        count += 1;
      }
      return { count };
    },
    async create({ data }: any) {
      records.push({
        ...data,
        profiles: records[0].profiles,
        revoked_at: data.revoked_at ?? null,
        rotated_at: data.rotated_at ?? null,
      });
      return data;
    },
  };

  return {
    records,
    refresh_tokens,
    async $transaction<T>(fn: (tx: any) => Promise<T>) {
      const previous = txLock;
      let release!: () => void;
      txLock = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await fn({ refresh_tokens });
      } finally {
        release();
      }
    },
  };
}

function createRecord(overrides: Partial<TokenRecord> = {}): TokenRecord {
  return {
    id: "token-1",
    user_id: "user-1",
    session_id: "session-1",
    token_hash: hash("refresh-1"),
    expires_at: nowPlus(60 * 60 * 1000),
    absolute_expires_at: nowPlus(12 * 60 * 60 * 1000),
    last_activity_at: new Date(),
    revoked_at: null,
    rotated_at: null,
    device_info: null,
    ip_address: null,
    profiles: {
      id: "user-1",
      email: "owner@example.com",
      role: "OWNER",
      owner_id: "user-1",
      is_active: true,
    },
    ...overrides,
  };
}

function createService(db: ReturnType<typeof createFakeDb>, tokens: string[] = ["refresh-2", "refresh-3"]) {
  const revokedSessions: string[] = [];
  const userRevocations: Array<{ userId: string; revokedAfterMs: number }> = [];
  const touchedSessions: string[] = [];

  const service = new SessionLifecycleService({
    prismaClient: db as any,
    hashTokenFn: hash,
    generateRefreshTokenFn: () => tokens.shift() || `refresh-${Date.now()}`,
    getSessionActivityFn: async () => null,
    touchSessionActivityFn: async (sessionId) => {
      if (sessionId) touchedSessions.push(sessionId);
      return true;
    },
    markSessionRevokedFn: async (sessionId) => {
      if (sessionId) revokedSessions.push(sessionId);
      return true;
    },
    markUserSessionsRevokedAfterFn: async (userId, revokedAfterMs) => {
      if (userId) userRevocations.push({ userId, revokedAfterMs });
      return true;
    },
  });

  return { service, revokedSessions, userRevocations, touchedSessions };
}

async function testRevokedTokensFailInstantly() {
  assert.deepEqual(
    evaluateSessionRevocation({ sub: "user-1", sid: "session-1", iat: 100 }, 1, null),
    { ok: false, reason: "session_revoked" },
  );
}

async function testConcurrentRefreshCannotCreateTwoValidSessions() {
  const db = createFakeDb([createRecord()]);
  const { service, userRevocations } = createService(db);

  const [first, second] = await Promise.all([
    service.rotateRefreshToken("refresh-1"),
    service.rotateRefreshToken("refresh-1"),
  ]);

  const successes = [first, second].filter((result) => result.ok);
  const replays = [first, second].filter((result) => !result.ok && result.reason === "reused");
  const activeTokens = db.records.filter((record) => record.revoked_at === null && record.expires_at > new Date());

  assert.equal(successes.length, 1, "only one refresh call succeeds");
  assert.equal(replays.length, 1, "the losing concurrent refresh is treated as reuse");
  assert.equal(activeTokens.length, 0, "replay response revokes all active refresh tokens");
  assert.equal(userRevocations.length, 1, "replay writes user-wide revocation marker");
}

async function testReplayDestroysAllSessions() {
  const db = createFakeDb([
    createRecord({ revoked_at: new Date(), expires_at: new Date(0) }),
    createRecord({
      id: "token-2",
      session_id: "session-2",
      token_hash: hash("refresh-2"),
    }),
  ]);
  const { service, userRevocations } = createService(db);

  const result = await service.rotateRefreshToken("refresh-1");

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "reused");
  assert.equal(db.records.every((record) => record.revoked_at !== null), true);
  assert.equal(userRevocations.length, 1);
}

async function testInactivityTimeoutDoesNotNeedFrontend() {
  const db = createFakeDb([
    createRecord({
      last_activity_at: new Date(Date.now() - INACTIVITY_TIMEOUT_MS - 1_000),
    }),
  ]);
  const { service, revokedSessions } = createService(db);

  const result = await service.rotateRefreshToken("refresh-1");

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "inactive");
  assert.deepEqual(revokedSessions, ["session-1"]);
}

async function main() {
  await testRevokedTokensFailInstantly();
  await testConcurrentRefreshCannotCreateTwoValidSessions();
  await testReplayDestroysAllSessions();
  await testInactivityTimeoutDoesNotNeedFrontend();
  console.log("session lifecycle verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

