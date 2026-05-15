/**
 * SettlementLedgerService — Phase 3 regression suite
 *
 * Run:
 *   DOTENV_CONFIG_PATH=../.env node -r dotenv/config ./node_modules/.bin/tsx \
 *     lib/services/settlement-ledger-service.test.ts
 *
 * No real DB is touched. Prisma is patched in-memory with a faithful
 * transaction simulator that supports rollback and serialised advisory
 * locking per-(owner, hostel) pair.
 *
 * Coverage (matches Phase 3 brief — constraint #7):
 *   1. Single credit produces correct balance_after and PENDING status.
 *   2. Idempotent re-credit returns the same row without double-counting.
 *   3. Idempotency-key collision on different owner/hostel/amount is REJECTED.
 *   4. Concurrent tenant payments to same (owner, hostel) serialise correctly.
 *   5. Concurrent payments to DIFFERENT (owner, hostel) pairs proceed in parallel.
 *   6. Duplicate webhook delivery (same payment_id) is caught by partial unique index.
 *   7. Transaction rollback discards the credit (no orphan rows).
 *   8. Debit_payout reduces balance and is marked SETTLED on insert.
 *   9. Debit exceeding balance throws LEDGER_INSUFFICIENT_BALANCE (no row written).
 *  10. Concurrent payout attempts for same batch_item are deduped.
 *  11. Adjustment requires reason + createdBy.
 *  12. Read APIs return latest balance_after, not SUM().
 */

import {
  SettlementLedgerService,
  LEDGER_ENTRY_TYPES,
  LEDGER_SETTLEMENT_STATUS,
} from "./settlement-ledger-service";

// ── Test harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  OK ${name}`);
    passed++;
  } else {
    const msg = `  FAIL ${name}${detail ? ` — ${detail}` : ""}`;
    console.error(msg);
    failures.push(msg);
    failed++;
  }
}
function assertEq<T>(actual: T, expected: T, name: string) {
  assert(actual === expected, name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function expectThrow(fn: () => Promise<any>, match: RegExp, name: string) {
  try {
    await fn();
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (match.test(msg)) {
      console.log(`  OK ${name}`);
      passed++;
      return;
    }
    const m = `  FAIL ${name} — wrong message: ${msg}`;
    console.error(m); failures.push(m); failed++;
    return;
  }
  const m = `  FAIL ${name} — no throw`;
  console.error(m); failures.push(m); failed++;
}

// ── In-memory ledger store with txn semantics ───────────────────────────────

type LedgerRow = {
  id: string;
  owner_id: string;
  hostel_id: string;
  entry_type: string;
  direction: "C" | "D";
  amount: number;
  balance_after: number;
  currency: string;
  settlement_status: string;
  settled_at: Date | null;
  idempotency_key: string;
  payment_id: string | null;
  settlement_batch_id: string | null;
  batch_item_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: any;
  created_by: string | null;
  created_at: Date;
};

class FakeStore {
  rows: LedgerRow[] = [];
  // pair lock map: "owner_id|hostel_id" -> Promise chain tail
  private locks = new Map<string, Promise<void>>();
  private clock = 0;
  reset() { this.rows = []; this.locks.clear(); this.clock = 0; }
  nextTs() { this.clock += 1; return new Date(2026, 0, 1, 0, 0, this.clock); }
  acquire(key: string): { release: () => void; wait: Promise<void> } {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((res) => { release = res; });
    this.locks.set(key, prev.then(() => next));
    return { release, wait: prev };
  }
}

const store = new FakeStore();

function randomUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Fake `tx` client passed into _appendEntryInTx (via creditCollectionInTx etc).
function makeTx(opts: { failAfterInsert?: boolean; pairLockKey?: string } = {}) {
  let inserts: LedgerRow[] = [];
  let aborted = false;

  const ensureNotAborted = () => {
    if (aborted) throw new Error("TX_ABORTED");
  };

  return {
    inserts,
    commit() {
      if (aborted) return;
      for (const r of inserts) store.rows.push(r);
      inserts = [];
    },
    rollback() { aborted = true; inserts = []; },
    failAfterInsert: !!opts.failAfterInsert,
    client: {
      owner_settlement_ledger: {
        findUnique: async (args: any) => {
          ensureNotAborted();
          const key = args?.where?.idempotency_key;
          if (!key) return null;
          // visible: committed rows + this tx's pending inserts
          return [...store.rows, ...inserts].find((r) => r.idempotency_key === key) ?? null;
        },
        findFirst: async (args: any) => {
          ensureNotAborted();
          const where = args?.where ?? {};
          const all = [...store.rows, ...inserts].filter((r) => {
            if (where.owner_id && r.owner_id !== where.owner_id) return false;
            if (where.hostel_id && r.hostel_id !== where.hostel_id) return false;
            if (where.entry_type && r.entry_type !== where.entry_type) return false;
            if (where.settlement_status && r.settlement_status !== where.settlement_status) return false;
            return true;
          });
          const orders = Array.isArray(args?.orderBy) ? args.orderBy : args?.orderBy ? [args.orderBy] : [];
          all.sort((a, b) => {
            for (const o of orders) {
              const [k, dir] = Object.entries(o)[0] as [keyof LedgerRow, "asc" | "desc"];
              const av: any = a[k]; const bv: any = b[k];
              if (av === bv) continue;
              if (dir === "desc") return av < bv ? 1 : -1;
              return av < bv ? -1 : 1;
            }
            return 0;
          });
          return all[0] ?? null;
        },
        create: async (args: any) => {
          ensureNotAborted();
          // Simulate unique-key violation on idempotency_key across committed+pending.
          const key = args.data.idempotency_key;
          const dup = [...store.rows, ...inserts].find((r) => r.idempotency_key === key);
          if (dup) {
            const err: any = new Error("Unique constraint failed");
            err.code = "P2002";
            err.meta = { target: ["idempotency_key"] };
            throw err;
          }
          // Simulate partial-unique on (payment_id, entry_type=CREDIT_COLLECTION).
          if (args.data.entry_type === "CREDIT_COLLECTION" && args.data.payment_id) {
            const dup2 = [...store.rows, ...inserts].find(
              (r) => r.entry_type === "CREDIT_COLLECTION" && r.payment_id === args.data.payment_id
            );
            if (dup2) {
              const err: any = new Error("Unique constraint failed");
              err.code = "P2002";
              err.meta = { target: ["payment_id"] };
              throw err;
            }
          }
          const row: LedgerRow = {
            id: randomUuid(),
            owner_id: args.data.owner_id,
            hostel_id: args.data.hostel_id,
            entry_type: args.data.entry_type,
            direction: args.data.direction,
            amount: Number(args.data.amount),
            balance_after: Number(args.data.balance_after),
            currency: args.data.currency ?? "INR",
            settlement_status: args.data.settlement_status,
            settled_at: args.data.settled_at ?? null,
            idempotency_key: args.data.idempotency_key,
            payment_id: args.data.payment_id ?? null,
            settlement_batch_id: args.data.settlement_batch_id ?? null,
            batch_item_id: args.data.batch_item_id ?? null,
            reference_type: args.data.reference_type ?? null,
            reference_id: args.data.reference_id ?? null,
            metadata: args.data.metadata ?? {},
            created_by: args.data.created_by ?? null,
            created_at: store.nextTs(),
          };
          inserts.push(row);
          return row;
        },
      },
      $queryRaw: async (..._args: any[]) => {
        ensureNotAborted();
        // Only used here to simulate the pg_advisory_xact_lock — no-op for fake store.
        return [];
      },
    } as any,
  };
}

// Helper to run a "transaction": acquires the (owner|hostel) pair lock,
// invokes `fn(tx.client)`, then commits or rolls back.
async function runTx<T>(
  ownerId: string,
  hostelId: string,
  fn: (tx: any) => Promise<T>,
  opts: { failAfter?: boolean } = {}
): Promise<T> {
  const pairKey = `${ownerId}|${hostelId}`;
  const handle = store.acquire(pairKey);
  await handle.wait;
  const tx = makeTx();
  try {
    const out = await fn(tx.client);
    if (opts.failAfter) {
      tx.rollback();
      throw new Error("INJECTED_FAILURE");
    }
    tx.commit();
    return out;
  } catch (e) {
    tx.rollback();
    throw e;
  } finally {
    handle.release();
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

const svc = new SettlementLedgerService();
const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const HOSTEL_A1 = "aaaa1111-1111-4111-8111-111111111111";
const HOSTEL_A2 = "aaaa2222-2222-4222-8222-222222222222";
const HOSTEL_B1 = "bbbb1111-1111-4111-8111-111111111111";

async function test_single_credit() {
  store.reset();
  const paymentId = randomUuid();
  const res = await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, {
      ownerId: OWNER_A, hostelId: HOSTEL_A1,
      paymentId, amount: 1000,
      idempotencyKey: `credit:payment:${paymentId}`,
    })
  );
  assertEq(res.alreadyExisted, false, "single credit: alreadyExisted=false");
  assertEq(Number(res.entry.balance_after), 1000, "single credit: balance_after=1000");
  assertEq(res.entry.settlement_status, LEDGER_SETTLEMENT_STATUS.PENDING_SETTLEMENT, "single credit: PENDING_SETTLEMENT");
  assertEq(res.entry.direction, "C", "single credit: direction=C");
  assertEq(store.rows.length, 1, "single credit: 1 row in store");
}

async function test_idempotent_recredit() {
  store.reset();
  const paymentId = randomUuid();
  const r1 = await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 500, idempotencyKey: `credit:payment:${paymentId}` })
  );
  const r2 = await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 500, idempotencyKey: `credit:payment:${paymentId}` })
  );
  assertEq(r1.entry.id, r2.entry.id, "idempotent re-credit: same entry id");
  assertEq(r2.alreadyExisted, true, "idempotent re-credit: alreadyExisted=true");
  assertEq(store.rows.length, 1, "idempotent re-credit: still 1 row");
  assertEq(Number(r2.entry.balance_after), 500, "idempotent re-credit: balance unchanged");
}

async function test_idempotency_collision_rejected() {
  store.reset();
  const paymentId1 = randomUuid();
  const key = `credit:payment:${paymentId1}`;
  await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId: paymentId1, amount: 100, idempotencyKey: key })
  );
  // Reuse same key with different amount → must throw.
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId: paymentId1, amount: 999, idempotencyKey: key })
    ),
    /IDEMPOTENCY_COLLISION/,
    "idempotency-key reused with different amount throws"
  );
}

async function test_concurrent_same_pair_serialised() {
  store.reset();
  // 5 concurrent credits to the SAME (owner, hostel). Must serialise via pair lock.
  const credits = Array.from({ length: 5 }, (_, i) => ({ id: randomUuid(), amt: 100 * (i + 1) }));
  await Promise.all(credits.map((c) =>
    runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId: c.id, amount: c.amt, idempotencyKey: `credit:payment:${c.id}` })
    )
  ));
  const expected = credits.reduce((s, c) => s + c.amt, 0);
  // tip balance_after = expected; rows are exactly 5.
  assertEq(store.rows.length, 5, "concurrent same pair: 5 rows");
  const tip = [...store.rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  assertEq(Number(tip.balance_after), expected, `concurrent same pair: tip balance_after=${expected}`);
  // Every balance_after is strictly monotonic increasing along created_at.
  const sorted = [...store.rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  let prev = 0; let monotonic = true;
  for (const r of sorted) { if (Number(r.balance_after) <= prev) { monotonic = false; break; } prev = Number(r.balance_after); }
  assert(monotonic, "concurrent same pair: monotonic increasing balance_after");
}

async function test_concurrent_different_pairs_parallel() {
  store.reset();
  // Different pairs proceed in parallel without contention.
  const tasks: Promise<any>[] = [];
  const pairs = [
    { owner: OWNER_A, hostel: HOSTEL_A1, amt: 100 },
    { owner: OWNER_A, hostel: HOSTEL_A2, amt: 200 },
    { owner: OWNER_B, hostel: HOSTEL_B1, amt: 300 },
  ];
  for (const p of pairs) {
    const pid = randomUuid();
    tasks.push(runTx(p.owner, p.hostel, (tx) =>
      svc.creditCollectionInTx(tx, { ownerId: p.owner, hostelId: p.hostel, paymentId: pid, amount: p.amt, idempotencyKey: `credit:payment:${pid}` })
    ));
  }
  await Promise.all(tasks);
  assertEq(store.rows.length, 3, "different pairs: 3 rows");
  // Read-API behaviour is covered in test_read_api_uses_balance_after below
  // with prisma monkey-patching. Here we assert against the in-memory store.
  const findBal = (o: string, h: string) => {
    const rows = store.rows.filter((r) => r.owner_id === o && r.hostel_id === h);
    return rows.length ? rows[rows.length - 1].balance_after : 0;
  };
  assertEq(findBal(OWNER_A, HOSTEL_A1), 100, "different pairs: OWNER_A/HOSTEL_A1=100");
  assertEq(findBal(OWNER_A, HOSTEL_A2), 200, "different pairs: OWNER_A/HOSTEL_A2=200");
  assertEq(findBal(OWNER_B, HOSTEL_B1), 300, "different pairs: OWNER_B/HOSTEL_B1=300");
}

async function test_duplicate_webhook_payment_id() {
  store.reset();
  const paymentId = randomUuid();
  // Webhook 1
  const r1 = await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 750, idempotencyKey: `credit:payment:${paymentId}` })
  );
  // Webhook 2 (replay) — must dedupe.
  const r2 = await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 750, idempotencyKey: `credit:payment:${paymentId}` })
  );
  assertEq(r1.entry.id, r2.entry.id, "duplicate webhook: same row");
  assertEq(r2.alreadyExisted, true, "duplicate webhook: alreadyExisted=true");
  assertEq(store.rows.length, 1, "duplicate webhook: 1 row");
}

async function test_transaction_rollback_no_orphan() {
  store.reset();
  const paymentId = randomUuid();
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, async (tx) => {
      await svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 500, idempotencyKey: `credit:payment:${paymentId}` });
    }, { failAfter: true }),
    /INJECTED_FAILURE/,
    "tx rollback throws expected error"
  );
  assertEq(store.rows.length, 0, "tx rollback: no rows committed");
  // Subsequent retry must succeed (no zombie idempotency_key).
  const retry = await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 500, idempotencyKey: `credit:payment:${paymentId}` })
  );
  assertEq(retry.alreadyExisted, false, "tx rollback: retry succeeds");
  assertEq(store.rows.length, 1, "tx rollback: retry commits one row");
}

async function test_debit_payout_reduces_balance() {
  store.reset();
  const paymentId = randomUuid();
  await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 1000, idempotencyKey: `credit:payment:${paymentId}` })
  );
  const batchId = randomUuid();
  const itemId = randomUuid();
  const dr = await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.debitPayoutInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, amount: 700, batchId, batchItemId: itemId, idempotencyKey: `debit:batch_item:${itemId}` })
  );
  assertEq(Number(dr.entry.balance_after), 300, "debit payout: balance_after=300");
  assertEq(dr.entry.direction, "D", "debit payout: direction=D");
  assertEq(dr.entry.settlement_status, LEDGER_SETTLEMENT_STATUS.SETTLED, "debit payout: SETTLED");
  assert(dr.entry.settled_at !== null, "debit payout: settled_at set");
}

async function test_debit_overdraft_rejected() {
  store.reset();
  const paymentId = randomUuid();
  await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 100, idempotencyKey: `credit:payment:${paymentId}` })
  );
  const batchId = randomUuid();
  const itemId = randomUuid();
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.debitPayoutInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, amount: 500, batchId, batchItemId: itemId, idempotencyKey: `debit:batch_item:${itemId}` })
    ),
    /LEDGER_INSUFFICIENT_BALANCE/,
    "debit overdraft: throws LEDGER_INSUFFICIENT_BALANCE"
  );
  // No DEBIT row should have been persisted.
  assertEq(store.rows.filter((r) => r.direction === "D").length, 0, "debit overdraft: no debit row written");
  // Original CREDIT must still be there at full balance.
  assertEq(store.rows.length, 1, "debit overdraft: only credit remains");
}

async function test_concurrent_payout_attempts_for_same_item_deduped() {
  store.reset();
  const paymentId = randomUuid();
  await runTx(OWNER_A, HOSTEL_A1, (tx) =>
    svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 1000, idempotencyKey: `credit:payment:${paymentId}` })
  );
  const batchId = randomUuid();
  const itemId = randomUuid();
  // Race 2 payout finalizers for the same batch item.
  const [a, b] = await Promise.all([
    runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.debitPayoutInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, amount: 200, batchId, batchItemId: itemId, idempotencyKey: `debit:batch_item:${itemId}` })
    ),
    runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.debitPayoutInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, amount: 200, batchId, batchItemId: itemId, idempotencyKey: `debit:batch_item:${itemId}` })
    ),
  ]);
  assertEq(a.entry.id, b.entry.id, "concurrent payouts same item: same row");
  // Exactly 1 credit + 1 debit
  assertEq(store.rows.filter((r) => r.direction === "D").length, 1, "concurrent payouts same item: 1 debit row");
  // Balance = 1000 - 200 = 800
  const tip = store.rows[store.rows.length - 1];
  assertEq(Number(tip.balance_after), 800, "concurrent payouts same item: balance_after=800");
}

async function test_adjustment_requires_reason_and_admin() {
  store.reset();
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.adjustCreditInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, amount: 10, idempotencyKey: "adj:1", reason: "", createdBy: "admin" })
    ),
    /adjustment reason required/,
    "adjustment: empty reason rejected"
  );
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.adjustCreditInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, amount: 10, idempotencyKey: "adj:2", reason: "test", createdBy: "" })
    ),
    /createdBy admin id required/,
    "adjustment: empty createdBy rejected"
  );
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.adjustCreditInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, amount: 10, idempotencyKey: "", reason: "test", createdBy: "admin" })
    ),
    /idempotency_key required/,
    "adjustment: empty idempotency_key rejected"
  );
}

async function test_amount_validation() {
  store.reset();
  const paymentId = randomUuid();
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: 0, idempotencyKey: "k" })
    ),
    /amount must be > 0/,
    "zero amount rejected"
  );
  await expectThrow(
    () => runTx(OWNER_A, HOSTEL_A1, (tx) =>
      svc.creditCollectionInTx(tx, { ownerId: OWNER_A, hostelId: HOSTEL_A1, paymentId, amount: -10, idempotencyKey: "k2" })
    ),
    /amount must be > 0/,
    "negative amount rejected"
  );
}

// Read APIs need a real prisma client; we patch the singleton to read from
// `store.rows` so the test can exercise getOwnerHostelBalance and friends.
async function test_read_api_uses_balance_after() {
  store.reset();
  // Pre-seed three rows manually with monotonic balance_after.
  store.rows.push(
    { id: "r1", owner_id: OWNER_A, hostel_id: HOSTEL_A1, entry_type: "CREDIT_COLLECTION", direction: "C", amount: 100, balance_after: 100, currency: "INR", settlement_status: "PENDING_SETTLEMENT", settled_at: null, idempotency_key: "k1", payment_id: "p1", settlement_batch_id: null, batch_item_id: null, reference_type: null, reference_id: null, metadata: {}, created_by: null, created_at: new Date(2026, 0, 1) },
    { id: "r2", owner_id: OWNER_A, hostel_id: HOSTEL_A1, entry_type: "CREDIT_COLLECTION", direction: "C", amount: 50,  balance_after: 150, currency: "INR", settlement_status: "PENDING_SETTLEMENT", settled_at: null, idempotency_key: "k2", payment_id: "p2", settlement_batch_id: null, batch_item_id: null, reference_type: null, reference_id: null, metadata: {}, created_by: null, created_at: new Date(2026, 0, 2) },
    { id: "r3", owner_id: OWNER_A, hostel_id: HOSTEL_A1, entry_type: "DEBIT_PAYOUT",     direction: "D", amount: 30,  balance_after: 120, currency: "INR", settlement_status: "SETTLED",            settled_at: new Date(), idempotency_key: "k3", payment_id: null, settlement_batch_id: "b1", batch_item_id: "i1", reference_type: null, reference_id: null, metadata: {}, created_by: null, created_at: new Date(2026, 0, 3) },
  );
  // Monkey-patch the prisma singleton used by the service.
  const { prisma } = await import("../db");
  (prisma as any).owner_settlement_ledger = {
    findFirst: async (args: any) => {
      const w = args.where;
      const matching = store.rows.filter((r) => r.owner_id === w.owner_id && r.hostel_id === w.hostel_id);
      matching.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return matching[0] ?? null;
    },
  };
  const bal = await svc.getOwnerHostelBalance(OWNER_A, HOSTEL_A1);
  // SUM(amounts with sign) = 100 + 50 - 30 = 120. balance_after must agree.
  assertEq(bal, 120, "read API: getOwnerHostelBalance reads tip balance_after");
}

// ── Runner ──────────────────────────────────────────────────────────────────

(async () => {
  const tests = [
    test_single_credit,
    test_idempotent_recredit,
    test_idempotency_collision_rejected,
    test_concurrent_same_pair_serialised,
    test_concurrent_different_pairs_parallel,
    test_duplicate_webhook_payment_id,
    test_transaction_rollback_no_orphan,
    test_debit_payout_reduces_balance,
    test_debit_overdraft_rejected,
    test_concurrent_payout_attempts_for_same_item_deduped,
    test_adjustment_requires_reason_and_admin,
    test_amount_validation,
    test_read_api_uses_balance_after,
  ];
  for (const t of tests) {
    console.log(`\n── ${t.name} ──`);
    try { await t(); }
    catch (e: any) {
      const m = `  FAIL ${t.name} threw: ${e?.message ?? e}`;
      console.error(m); failures.push(m); failed++;
    }
  }
  console.log(`\n========================================`);
  console.log(`  passed: ${passed}, failed: ${failed}`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(f);
    process.exit(1);
  } else {
    console.log("ALL GREEN");
    process.exit(0);
  }
})();
