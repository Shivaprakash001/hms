/**
 * OwnerFinancialViewService — Phase 6 regression suite
 *
 * Run:
 *   DOTENV_CONFIG_PATH=../.env node -r dotenv/config ./node_modules/.bin/tsx \
 *     lib/services/owner-financial-view-service.test.ts
 *
 * No real DB. Prisma's $queryRaw and $queryRawUnsafe are stubbed so we can
 * pin exact behavioural contracts from the Phase-6 brief:
 *
 *   1. mapOwnerSettlementStatus enforces the brief's mapping table exactly.
 *   2. getOwnerSummary computes the four buckets from CREDIT/DEBIT aggregates.
 *   3. listOwnerCollections derives status with the correct precedence:
 *        active item → mapped status
 *        no active + had FAILED ever → SETTLEMENT_DELAYED
 *        no item at all → PENDING_SETTLEMENT
 *   4. listOwnerCollections embeds the ownerId into the query (owner-scoping).
 *   5. listOwnerTransfers exposes payout_reference (UTR/NEFT) per Q1.
 *   6. listOwnerTransfers never returns internal fields (batch ids, admin ids).
 *   7. getPendingByHostel passes ownerId; result shape preserved.
 *   8. UUID assertion rejects non-UUID inputs.
 */

import {
  OwnerFinancialViewService,
  mapOwnerSettlementStatus,
  OWNER_SETTLEMENT_STATUS,
} from "./owner-financial-view-service";

// ── tiny test harness ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { console.log(`  OK ${name}`); passed++; }
  else {
    const m = `  FAIL ${name}${detail ? ` — ${detail}` : ""}`;
    console.error(m); failures.push(m); failed++;
  }
}
function assertEq<T>(actual: T, expected: T, name: string) {
  assert(actual === expected, name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function expectThrow(fn: () => Promise<any>, match: RegExp, name: string) {
  try { await fn(); } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (match.test(msg)) { console.log(`  OK ${name}`); passed++; return; }
    const m = `  FAIL ${name} — wrong message: ${msg}`;
    console.error(m); failures.push(m); failed++;
    return;
  }
  const m = `  FAIL ${name} — no throw`;
  console.error(m); failures.push(m); failed++;
}

// ── canonical UUIDs (length-32+ to satisfy _assertUuid) ─────────────────────
const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const HOSTEL_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const HOSTEL_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// ── prisma stub plumbing ────────────────────────────────────────────────────
type RawCall = { kind: "tagged" | "unsafe"; sqlText: string; params: any[] };

async function installPrismaStub(handler: {
  onTagged?: (sqlText: string, params: any[]) => any;
  onUnsafe?: (sqlText: string, params: any[]) => any;
}) {
  const dbModule: any = await import("../db");
  const calls: RawCall[] = [];

  // $queryRaw is invoked with a tagged template literal: ($queryRaw`SELECT ... ${x}`)
  // The Prisma client receives a Sql object; we approximate by joining the
  // template strings with $N placeholders and capturing the param array.
  dbModule.prisma.$queryRaw = (strings: TemplateStringsArray | string[], ...params: any[]) => {
    const arr = Array.isArray(strings) ? strings as string[] : [String(strings)];
    let sqlText = "";
    for (let i = 0; i < arr.length; i++) {
      sqlText += arr[i];
      if (i < params.length) sqlText += `$${i + 1}`;
    }
    calls.push({ kind: "tagged", sqlText, params });
    return Promise.resolve(handler.onTagged ? handler.onTagged(sqlText, params) : []);
  };

  dbModule.prisma.$queryRawUnsafe = (sqlText: string, ...params: any[]) => {
    calls.push({ kind: "unsafe", sqlText, params });
    return Promise.resolve(handler.onUnsafe ? handler.onUnsafe(sqlText, params) : []);
  };

  return { calls };
}

// ── tests ───────────────────────────────────────────────────────────────────

function test_mapOwnerSettlementStatus_exact_brief_mapping() {
  // Phase-6 Q2 mapping table.
  assertEq(mapOwnerSettlementStatus("PENDING"), OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
    "map PENDING → PENDING_SETTLEMENT");
  assertEq(mapOwnerSettlementStatus("PROCESSING"), OWNER_SETTLEMENT_STATUS.TRANSFER_IN_PROGRESS,
    "map PROCESSING → TRANSFER_IN_PROGRESS");
  assertEq(mapOwnerSettlementStatus("SUCCESS"), OWNER_SETTLEMENT_STATUS.SETTLED,
    "map SUCCESS → SETTLED");
  assertEq(mapOwnerSettlementStatus("FAILED"), OWNER_SETTLEMENT_STATUS.SETTLEMENT_DELAYED,
    "map FAILED → SETTLEMENT_DELAYED");

  // Defensive defaults — unknown / null / undefined / treasury internals.
  assertEq(mapOwnerSettlementStatus(null), OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
    "map null → PENDING_SETTLEMENT");
  assertEq(mapOwnerSettlementStatus(undefined), OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
    "map undefined → PENDING_SETTLEMENT");
  assertEq(mapOwnerSettlementStatus("CANCELLED"), OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
    "map CANCELLED → PENDING_SETTLEMENT (operationally invisible to owner)");
  assertEq(mapOwnerSettlementStatus("DRAFT"), OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
    "map DRAFT (admin terminology) → PENDING_SETTLEMENT");
}

async function test_getOwnerSummary_buckets() {
  const svc = new OwnerFinancialViewService();
  let seenOwnerInEveryQuery = true;

  await installPrismaStub({
    onTagged: (sql, params) => {
      if (!params.includes(OWNER_A)) seenOwnerInEveryQuery = false;
      if (sql.includes("entry_type = $") && sql.includes("CREDIT_COLLECTION") === false) {
        // params: [ownerId, "CREDIT_COLLECTION"] or [ownerId, "DEBIT_PAYOUT"] (+ windowStart)
        if (params[1] === "CREDIT_COLLECTION") {
          return [{ total: "1200.00", count: 4 }];
        }
        if (params[1] === "DEBIT_PAYOUT") {
          // distinguish lifetime vs windowed by param count
          if (params.length === 2) return [{ total: "900.00", count: 2 }];
          return [{ total: "300.00", count: 1 }]; // recent window
        }
      }
      if (sql.includes("COUNT(DISTINCT hostel_id)")) return [{ count: 2 }];
      return [];
    },
  });

  const s = await svc.getOwnerSummary(OWNER_A, 30);

  assertEq(s.total_collected.amount, "1200.00", "summary.total_collected.amount");
  assertEq(s.total_collected.collection_count, 4, "summary.total_collected.count");
  assertEq(s.settled_payouts.amount, "900.00", "summary.settled_payouts.amount");
  assertEq(s.settled_payouts.transfer_count, 2, "summary.settled_payouts.count");
  // pending = collected - settled = 300.00 (derived, not stored)
  assertEq(s.pending_settlement.amount, "300.00", "summary.pending_settlement derived from ledger arithmetic");
  assertEq(s.recent_transfers.amount, "300.00", "summary.recent_transfers.amount");
  assertEq(s.recent_transfers.transfer_count, 1, "summary.recent_transfers.count");
  assertEq(s.recent_transfers.window_days, 30, "summary.window_days echoed");
  assertEq(s.hostel_count, 2, "summary.hostel_count");
  assert(seenOwnerInEveryQuery, "every summary subquery is owner-scoped");
}

async function test_listOwnerCollections_status_precedence_and_scoping() {
  const svc = new OwnerFinancialViewService();

  // Four rows exercising the full status-derivation matrix.
  const fakeRows = [
    { id: "c1", amount: "100.00", created_at: new Date(2026, 0, 1), hostel_id: HOSTEL_1, payment_id: "p1",
      active_item_status: "PENDING",    had_failed_item: false },
    { id: "c2", amount: "200.00", created_at: new Date(2026, 0, 2), hostel_id: HOSTEL_1, payment_id: "p2",
      active_item_status: "PROCESSING", had_failed_item: false },
    { id: "c3", amount: "300.00", created_at: new Date(2026, 0, 3), hostel_id: HOSTEL_1, payment_id: "p3",
      active_item_status: "SUCCESS",    had_failed_item: false },
    { id: "c4", amount: "400.00", created_at: new Date(2026, 0, 4), hostel_id: HOSTEL_2, payment_id: "p4",
      active_item_status: null,         had_failed_item: true },   // last attempt failed
    { id: "c5", amount: "500.00", created_at: new Date(2026, 0, 5), hostel_id: HOSTEL_2, payment_id: "p5",
      active_item_status: null,         had_failed_item: false },  // never attempted
  ];

  let firstParam: any = null;
  const { calls } = await installPrismaStub({
    onUnsafe: (_sql, params) => {
      firstParam = params[0];
      return fakeRows;
    },
  });

  const rows = await svc.listOwnerCollections({ ownerId: OWNER_A });

  assertEq(rows.length, 5, "collections: row count preserved");
  assertEq(rows[0].settlement_status, OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
    "collections: active PENDING → PENDING_SETTLEMENT");
  assertEq(rows[1].settlement_status, OWNER_SETTLEMENT_STATUS.TRANSFER_IN_PROGRESS,
    "collections: active PROCESSING → TRANSFER_IN_PROGRESS");
  assertEq(rows[2].settlement_status, OWNER_SETTLEMENT_STATUS.SETTLED,
    "collections: active SUCCESS → SETTLED");
  assertEq(rows[3].settlement_status, OWNER_SETTLEMENT_STATUS.SETTLEMENT_DELAYED,
    "collections: no active + had FAILED → SETTLEMENT_DELAYED");
  assertEq(rows[4].settlement_status, OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
    "collections: no item at all → PENDING_SETTLEMENT");

  assertEq(firstParam, OWNER_A, "collections: ownerId bound as first SQL param");
  assert(calls.length === 1, "collections: exactly one DB call (no N+1)");

  // Internal fields must never leak.
  const wireKeys = new Set(Object.keys(rows[0]));
  assert(!wireKeys.has("settlement_batch_id"), "collections: no settlement_batch_id on wire");
  assert(!wireKeys.has("batch_item_id"), "collections: no batch_item_id on wire");
  assert(!wireKeys.has("created_by"), "collections: no created_by on wire");
  assert(!wireKeys.has("active_item_status"), "collections: raw payout_status hidden");
  assert(!wireKeys.has("had_failed_item"), "collections: raw failure flag hidden");
}

async function test_listOwnerCollections_hostel_filter_injected() {
  const svc = new OwnerFinancialViewService();
  let capturedSql = "";
  let capturedParams: any[] = [];
  await installPrismaStub({
    onUnsafe: (sql, params) => {
      capturedSql = sql; capturedParams = params;
      return [];
    },
  });
  await svc.listOwnerCollections({ ownerId: OWNER_A, hostelId: HOSTEL_1 });
  assert(/c\.hostel_id = \$3::uuid/.test(capturedSql), "collections: hostelId injected as $3");
  assertEq(capturedParams[0], OWNER_A, "collections: ownerId is $1");
  assertEq(capturedParams[2], HOSTEL_1, "collections: hostelId is $3 value");
}

async function test_listOwnerTransfers_exposes_payout_reference() {
  const svc = new OwnerFinancialViewService();
  const fakeRows = [
    { id: "d1", amount: "500.00", transferred_at: new Date(2026, 1, 1), hostel_id: HOSTEL_1,
      payout_method: "NEFT", payout_reference: "NEFT-UTR-ABCD1234" },
    { id: "d2", amount: "750.00", transferred_at: new Date(2026, 1, 2), hostel_id: HOSTEL_2,
      payout_method: "UPI",  payout_reference: "UPI-9876543210" },
  ];
  await installPrismaStub({ onUnsafe: () => fakeRows });

  const rows = await svc.listOwnerTransfers({ ownerId: OWNER_A });
  assertEq(rows.length, 2, "transfers: row count preserved");
  assertEq(rows[0].payout_reference, "NEFT-UTR-ABCD1234", "transfers: UTR visible (Q1)");
  assertEq(rows[0].payout_method, "NEFT", "transfers: method visible");
  assertEq(rows[0].settlement_status, OWNER_SETTLEMENT_STATUS.SETTLED,
    "transfers: DEBIT rows always reported as SETTLED");

  const wireKeys = new Set(Object.keys(rows[0]));
  assert(!wireKeys.has("settlement_batch_id"), "transfers: no settlement_batch_id on wire");
  assert(!wireKeys.has("batch_item_id"), "transfers: no batch_item_id on wire");
  assert(!wireKeys.has("batch_number"), "transfers: no batch_number on wire");
  assert(!wireKeys.has("processed_by"), "transfers: no admin actor id on wire");
}

async function test_getPendingByHostel_passes_owner_and_returns_shape() {
  const svc = new OwnerFinancialViewService();
  const fakeRows = [
    { hostel_id: HOSTEL_1, lifetime_collected: "1000.00", lifetime_settled: "600.00",
      pending: "400.00", uncovered_credit_count: 3, in_progress_credit_count: 1 },
    { hostel_id: HOSTEL_2, lifetime_collected: "500.00",  lifetime_settled: "500.00",
      pending: "0.00",   uncovered_credit_count: 0, in_progress_credit_count: 0 },
  ];
  let seenOwner: any = null;
  await installPrismaStub({
    onTagged: (_sql, params) => { seenOwner = params[0]; return fakeRows; },
  });

  const rows = await svc.getPendingByHostel(OWNER_A);
  assertEq(rows.length, 2, "by-hostel: row count");
  assertEq(rows[0].hostel_id, HOSTEL_1, "by-hostel: hostel_id preserved");
  assertEq(rows[0].pending, "400.00", "by-hostel: pending preserved");
  assertEq(seenOwner, OWNER_A, "by-hostel: ownerId bound to query");
}

async function test_uuid_assertion_blocks_garbage_input() {
  const svc = new OwnerFinancialViewService();
  await installPrismaStub({}); // any DB call here would be a bug
  await expectThrow(() => svc.listOwnerCollections({ ownerId: "not-a-uuid" }),
    /BAD_REQUEST/, "collections: rejects non-UUID ownerId");
  await expectThrow(() => svc.listOwnerTransfers({ ownerId: "" }),
    /BAD_REQUEST/, "transfers: rejects empty ownerId");
  await expectThrow(() => svc.getPendingByHostel("short"),
    /BAD_REQUEST/, "by-hostel: rejects short ownerId");
  await expectThrow(() => svc.getOwnerSummary("nope"),
    /BAD_REQUEST/, "summary: rejects non-UUID ownerId");
}

// ── runner ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("OwnerFinancialViewService — Phase 6 tests\n");

  console.log("1. mapOwnerSettlementStatus brief mapping");
  test_mapOwnerSettlementStatus_exact_brief_mapping();

  console.log("\n2. getOwnerSummary buckets and owner scoping");
  await test_getOwnerSummary_buckets();

  console.log("\n3. listOwnerCollections status precedence");
  await test_listOwnerCollections_status_precedence_and_scoping();

  console.log("\n4. listOwnerCollections hostel filter injection");
  await test_listOwnerCollections_hostel_filter_injected();

  console.log("\n5. listOwnerTransfers exposes payout_reference (Q1)");
  await test_listOwnerTransfers_exposes_payout_reference();

  console.log("\n6. getPendingByHostel shape and owner scoping");
  await test_getPendingByHostel_passes_owner_and_returns_shape();

  console.log("\n7. UUID assertions block garbage input");
  await test_uuid_assertion_blocks_garbage_input();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\nFailures:");
    failures.forEach((f) => console.error(f));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
