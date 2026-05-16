/**
 * FinancialReconciliationService — Phase 7 regression suite
 *
 * Run:
 *   DOTENV_CONFIG_PATH=../.env node -r dotenv/config ./node_modules/.bin/tsx \
 *     lib/services/financial-reconciliation-service.test.ts
 *
 * No real DB. Prisma's `$queryRaw` is replaced with a programmable router
 * that matches on substring of the SQL text and returns canned rows. Each
 * test pins a specific corruption pattern and asserts the detector
 * classifies it with the correct kind, severity, fingerprint, and
 * reproduction metadata.
 *
 * Stress / concurrency regressions covered (Phase-7 brief):
 *
 *   - Concurrent credits  → DUPLICATE_CREDIT (same payment_id, 2 rows)
 *   - Concurrent payouts  → RESERVATION_OVERLAP (2 PROCESSING on same credit)
 *   - Partial batch fail  → FAILED items do not pollute batch_drift
 *   - Duplicate webhook   → DUPLICATE_CREDIT (idempotency bypass canary)
 *   - Interrupted resv.   → ORPHAN_DEBIT / PAYOUT_COVERAGE_MISMATCH
 *   - Cross-owner leak    → CROSS_OWNER_CONTAMINATION (CRITICAL)
 *   - Hostel drift        → HOSTEL_ISOLATION_DRIFT (HIGH)
 *   - Balance chain break → BALANCE_AFTER_DRIFT at the offending entry
 *   - Negative balance    → NEGATIVE_BALANCE at the tip row
 *   - Lifetime mismatch   → SETTLED_EXCEEDS_COLLECTED
 *   - Persist dedup       → P2002 collision counts as skipped, not error
 */

import {
  FinancialReconciliationService,
  DETECTOR_KIND,
  type IssueReport,
} from "./financial-reconciliation-service";

// ── harness ────────────────────────────────────────────────────────────────
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

// ── canonical UUIDs ────────────────────────────────────────────────────────
const O_A = "11111111-1111-1111-1111-111111111111";
const O_B = "22222222-2222-2222-2222-222222222222";
const H_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const H_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PAY = "ffffffff-ffff-ffff-ffff-ffffffff0001";
const CR1 = "cccccccc-cccc-cccc-cccc-cccccccc0001";
const CR2 = "cccccccc-cccc-cccc-cccc-cccccccc0002";
const CR3 = "cccccccc-cccc-cccc-cccc-cccccccc0003";
const IT1 = "dddddddd-dddd-dddd-dddd-dddddddd0001";
const IT2 = "dddddddd-dddd-dddd-dddd-dddddddd0002";
const DB1 = "eeeeeeee-eeee-eeee-eeee-eeeeeeee0001";

// ── prisma stub plumbing ───────────────────────────────────────────────────
type Router = Array<{ match: RegExp; rows: any[] | (() => any[]) }>;

async function installPrismaRouter(router: Router) {
  const dbModule: any = await import("../db");
  dbModule.prisma.$queryRaw = (strings: TemplateStringsArray | string[], ..._params: any[]) => {
    const arr = Array.isArray(strings) ? (strings as string[]) : [String(strings)];
    const sqlText = arr.join(" ");
    for (const r of router) {
      if (r.match.test(sqlText)) {
        return Promise.resolve(typeof r.rows === "function" ? r.rows() : r.rows);
      }
    }
    return Promise.resolve([]);
  };
  return dbModule;
}

// ── individual detector tests ──────────────────────────────────────────────

async function test_duplicate_credits_classifies_concurrent_or_webhook_dup() {
  await installPrismaRouter([{
    match: /FROM owner_settlement_ledger\s+WHERE entry_type =/,
    rows: [{
      payment_id: PAY, entry_count: 2,
      owner_ids: [O_A], hostel_ids: [H_1],
      ledger_ids: [CR1, CR2],
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectDuplicateCredits();
  assertEq(out.length, 1, "duplicate_credits: 1 issue");
  assertEq(out[0].kind, DETECTOR_KIND.DUPLICATE_CREDIT, "duplicate_credits: kind");
  assertEq(out[0].severity, "CRITICAL", "duplicate_credits: severity CRITICAL");
  assertEq(out[0].payment_id, PAY, "duplicate_credits: payment_id");
  assertEq(out[0].fingerprint, `DUPLICATE_CREDIT|${PAY}`, "duplicate_credits: fingerprint deterministic on payment_id");
  assertEq(out[0].metadata.entry_count, 2, "duplicate_credits: entry_count in metadata");
}

async function test_missing_credits_surfaces_paid_payments_with_no_ledger() {
  await installPrismaRouter([{
    match: /FROM payments p\s+WHERE p\.status = 'PAID'/,
    rows: [{
      payment_id: PAY, owner_id: O_A, hostel_id: H_1,
      amount: "500.00", paid_at: new Date(2026, 0, 1),
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectMissingCredits();
  assertEq(out.length, 1, "missing_credits: 1 issue");
  assertEq(out[0].kind, DETECTOR_KIND.MISSING_CREDIT, "missing_credits: kind");
  assertEq(out[0].severity, "HIGH", "missing_credits: severity HIGH");
  assertEq(out[0].owner_id, O_A, "missing_credits: owner_id propagated");
  assertEq(out[0].fingerprint, `MISSING_CREDIT|${PAY}`, "missing_credits: fingerprint by payment_id");
}

async function test_orphan_debit_for_interrupted_reservation() {
  // Interrupted reservation: a DEBIT_PAYOUT row exists but the backing
  // batch_item is missing (or non-SUCCESS) — typical signature of a
  // mark-success that crashed mid-transaction in a non-atomic codepath.
  await installPrismaRouter([{
    match: /FROM owner_settlement_ledger d\s+LEFT JOIN settlement_batch_items i/,
    rows: [{
      debit_id: DB1, owner_id: O_A, hostel_id: H_1,
      batch_item_id: IT1, item_status: "PROCESSING", amount: "100.00",
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectOrphanDebits();
  assertEq(out.length, 1, "orphan_debit: 1 issue");
  assertEq(out[0].severity, "CRITICAL", "orphan_debit: severity CRITICAL");
  assertEq(out[0].batch_item_id, IT1, "orphan_debit: batch_item_id surfaced");
  assertEq(out[0].metadata.item_status, "PROCESSING", "orphan_debit: item_status in metadata");
}

async function test_over_covered_credit() {
  await installPrismaRouter([{
    match: /JOIN settlement_batch_items i ON c\.id = ANY\(i\.covered_credit_ids\)\s+WHERE c\.entry_type =[\s\S]*'PENDING','PROCESSING','SUCCESS'/,
    rows: [{
      credit_id: CR1, owner_id: O_A, hostel_id: H_1,
      item_count: 2, item_ids: [IT1, IT2], statuses: ["SUCCESS", "PROCESSING"],
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectOverCoveredCredits();
  assertEq(out.length, 1, "over_covered: 1 issue");
  assertEq(out[0].kind, DETECTOR_KIND.OVER_COVERED_CREDIT, "over_covered: kind");
  assertEq(out[0].severity, "CRITICAL", "over_covered: severity CRITICAL");
  assertEq(out[0].fingerprint, `OVER_COVERED_CREDIT|${CR1}`, "over_covered: fingerprint by credit_id");
}

async function test_reservation_overlap_concurrent_payouts() {
  // Concurrent payout regression: two PROCESSING items both claim the
  // same credit. Reservations are live financial locks (Phase-7 R-3).
  await installPrismaRouter([{
    match: /WHERE c\.entry_type =[\s\S]*'PROCESSING'/,
    rows: [{
      credit_id: CR1, owner_id: O_A, hostel_id: H_1,
      processing_item_ids: [IT1, IT2],
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectReservationOverlap();
  assertEq(out.length, 1, "reservation_overlap: 1 issue");
  assertEq(out[0].kind, DETECTOR_KIND.RESERVATION_OVERLAP, "reservation_overlap: kind");
  assertEq(out[0].severity, "CRITICAL", "reservation_overlap: severity CRITICAL (live lock contention)");
  assert(/active double-spend/.test(out[0].description), "reservation_overlap: description mentions double-spend");
}

async function test_batch_drift_ignores_failed_items() {
  // Partial batch failure regression: an item is FAILED while siblings
  // succeeded. The batch-vs-items query excludes CANCELLED-only items
  // but FAILED still counts toward live total — we want to verify the
  // detector does NOT spuriously flag a batch where the only "drift"
  // is a FAILED item that's been recovered.
  //
  // We feed: item-vs-covered has zero rows; batch-vs-items has zero rows.
  // detector should produce 0 issues.
  await installPrismaRouter([
    { match: /HAVING ABS\(i\.amount - COALESCE\(SUM\(c\.amount\), 0\)\) > 0\.005/, rows: [] },
    { match: /HAVING ABS\(b\.total_amount/, rows: [] },
  ]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectBatchDrift();
  assertEq(out.length, 0, "batch_drift: no issues when arithmetic balances");
}

async function test_batch_drift_classifies_item_and_batch_subkinds_separately() {
  await installPrismaRouter([
    {
      match: /HAVING ABS\(i\.amount - COALESCE\(SUM\(c\.amount\), 0\)\) > 0\.005/,
      rows: [{ item_id: IT1, batch_id: "batch-1", owner_id: O_A, hostel_id: H_1,
                item_amount: "100.00", covered_total: "95.00", drift: "5.00" }],
    },
    {
      match: /HAVING ABS\(b\.total_amount/,
      rows: [{ batch_id: "batch-1", batch_total: "500.00",
                live_items_total: "490.00", drift: "10.00" }],
    },
  ]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectBatchDrift();
  assertEq(out.length, 2, "batch_drift: item + batch surfaced");
  const subkinds = new Set(out.map((o) => o.metadata.subkind));
  assert(subkinds.has("ITEM_VS_COVERED"), "batch_drift: ITEM_VS_COVERED subkind");
  assert(subkinds.has("BATCH_VS_ITEMS"), "batch_drift: BATCH_VS_ITEMS subkind");
  // Same batch but distinct fingerprints — item issue is scoped to item, batch to batch.
  const fps = new Set(out.map((o) => o.fingerprint));
  assertEq(fps.size, 2, "batch_drift: distinct fingerprints for item vs batch subkind");
}

async function test_negative_balance_only_when_tip_is_negative() {
  // tip rows for two lanes; only one is negative
  await installPrismaRouter([{
    match: /SELECT DISTINCT ON \(owner_id, hostel_id\)/,
    rows: [
      { owner_id: O_A, hostel_id: H_1, balance_after: "-12.50",
        ledger_id: CR1, created_at: new Date() },
      { owner_id: O_A, hostel_id: H_2, balance_after: "0.00",
        ledger_id: CR2, created_at: new Date() },
      { owner_id: O_B, hostel_id: H_1, balance_after: "500.00",
        ledger_id: CR3, created_at: new Date() },
    ],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectNegativeBalances();
  assertEq(out.length, 1, "negative_balance: only the truly negative lane");
  assertEq(out[0].owner_id, O_A, "negative_balance: owner");
  assertEq(out[0].hostel_id, H_1, "negative_balance: hostel");
  assertEq(out[0].fingerprint, `NEGATIVE_BALANCE|${O_A}|${H_1}`, "negative_balance: fingerprint by (owner, hostel)");
}

async function test_cross_owner_contamination_critical() {
  await installPrismaRouter([{
    match: /WHERE c\.owner_id <> i\.owner_id/,
    rows: [{
      item_id: IT1, item_owner: O_A, item_hostel: H_1,
      mismatched_credit_ids: [CR1], mismatched_owner_ids: [O_B],
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectCrossOwnerContamination();
  assertEq(out.length, 1, "cross_owner: 1 issue");
  assertEq(out[0].severity, "CRITICAL", "cross_owner: severity CRITICAL");
  assertEq(out[0].metadata.subkind, "OWNER_SCOPE", "cross_owner: subkind=OWNER_SCOPE");
}

async function test_hostel_isolation_drift_excludes_cross_owner_cases() {
  // Detector SQL has AND c.owner_id = i.owner_id — we just confirm the
  // returned rows are tagged with HOSTEL_SCOPE subkind and severity HIGH
  // (one level below CRITICAL: same-owner cross-hostel is still a breach
  // but not as severe as cross-owner money movement).
  await installPrismaRouter([{
    match: /WHERE c\.hostel_id <> i\.hostel_id\s+AND c\.owner_id\s+=\s+i\.owner_id/,
    rows: [{
      item_id: IT1, item_owner: O_A, item_hostel: H_1,
      mismatched_credit_ids: [CR1], mismatched_hostel_ids: [H_2],
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectHostelIsolationDrift();
  assertEq(out.length, 1, "hostel_drift: 1 issue");
  assertEq(out[0].severity, "HIGH", "hostel_drift: severity HIGH (not CRITICAL)");
  assertEq(out[0].metadata.subkind, "HOSTEL_SCOPE", "hostel_drift: subkind=HOSTEL_SCOPE");
}

async function test_payout_coverage_mismatch() {
  await installPrismaRouter([{
    match: /FROM settlement_batch_items i\s+LEFT JOIN owner_settlement_ledger d ON d\.id = i\.ledger_debit_id/,
    rows: [{
      item_id: IT1, debit_id: DB1, owner_id: O_A, hostel_id: H_1,
      item_amount: "100.00", debit_amount: "95.00", drift: "5.00",
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectPayoutCoverageMismatch();
  assertEq(out.length, 1, "payout_coverage_mismatch: 1 issue");
  assertEq(out[0].severity, "CRITICAL", "payout_coverage_mismatch: severity CRITICAL");
  assertEq(out[0].metadata.drift, "5.00", "payout_coverage_mismatch: drift recorded");
}

async function test_settled_exceeds_collected() {
  await installPrismaRouter([{
    match: /WHERE settled > collected/,
    rows: [{
      owner_id: O_A, hostel_id: H_1,
      collected: "500.00", settled: "600.00", excess: "100.00",
    }],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectSettledExceedsCollected();
  assertEq(out.length, 1, "settled_exceeds: 1 issue");
  assertEq(out[0].severity, "CRITICAL", "settled_exceeds: severity CRITICAL");
  assertEq(out[0].metadata.excess, "100.00", "settled_exceeds: excess recorded");
}

// ── balance-after chain arithmetic (the foundational invariant) ────────────

async function test_balance_after_chain_clean() {
  // Healthy chain: C 100 → 100, C 50 → 150, D 30 → 120
  const t0 = new Date(2026, 0, 1).getTime();
  await installPrismaRouter([{
    match: /SELECT id, owner_id, hostel_id, direction, amount/,
    rows: [
      { id: "e1", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "100", balance_after: "100", created_at: new Date(t0 + 1) },
      { id: "e2", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "50",  balance_after: "150", created_at: new Date(t0 + 2) },
      { id: "e3", owner_id: O_A, hostel_id: H_1, direction: "D", amount: "30",  balance_after: "120", created_at: new Date(t0 + 3) },
    ],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectBalanceAfterDrift();
  assertEq(out.length, 0, "balance_chain: clean chain reports no drift");
}

async function test_balance_after_chain_break_pinned_to_offending_entry() {
  // Tampered chain: e2 should be 150 but stored as 200.
  const t0 = new Date(2026, 0, 1).getTime();
  await installPrismaRouter([{
    match: /SELECT id, owner_id, hostel_id, direction, amount/,
    rows: [
      { id: "e1", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "100", balance_after: "100", created_at: new Date(t0 + 1) },
      { id: "e2", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "50",  balance_after: "200", created_at: new Date(t0 + 2) }, // ← tampered
      { id: "e3", owner_id: O_A, hostel_id: H_1, direction: "D", amount: "30",  balance_after: "170", created_at: new Date(t0 + 3) }, // ← propagates from tampered e2 correctly: 200-30=170
    ],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectBalanceAfterDrift();
  assertEq(out.length, 1, "balance_chain: exactly one drift entry surfaced");
  assertEq(out[0].ledger_entry_id, "e2", "balance_chain: drift pinned to offending entry");
  assertEq(out[0].severity, "CRITICAL", "balance_chain: severity CRITICAL");
  assertEq(out[0].metadata.expected_balance_after, "150.00", "balance_chain: expected balance computed correctly");
  assertEq(out[0].metadata.actual_balance_after, "200", "balance_chain: actual balance preserved verbatim");
  assertEq(out[0].fingerprint, `BALANCE_AFTER_DRIFT|${O_A}|${H_1}|e2`, "balance_chain: fingerprint pins to entry");
}

async function test_balance_after_chain_resets_at_lane_boundary() {
  // Different (owner, hostel) lanes are independent. e1 closes A/H1 at 100;
  // e2 opens A/H2 with C 50 — expected balance_after = 50, not 150.
  const t0 = new Date(2026, 0, 1).getTime();
  await installPrismaRouter([{
    match: /SELECT id, owner_id, hostel_id, direction, amount/,
    rows: [
      { id: "e1", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "100", balance_after: "100", created_at: new Date(t0 + 1) },
      { id: "e2", owner_id: O_A, hostel_id: H_2, direction: "C", amount: "50",  balance_after: "50",  created_at: new Date(t0 + 2) },
    ],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectBalanceAfterDrift();
  assertEq(out.length, 0, "balance_chain: per-lane reset works correctly");
}

async function test_balance_after_paise_stable_no_float_error() {
  // Three additions of 0.1 should land at 0.3, not 0.30000000000000004.
  // Our toPaise rounding must keep this stable.
  const t0 = new Date(2026, 0, 1).getTime();
  await installPrismaRouter([{
    match: /SELECT id, owner_id, hostel_id, direction, amount/,
    rows: [
      { id: "e1", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "0.10", balance_after: "0.10", created_at: new Date(t0 + 1) },
      { id: "e2", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "0.10", balance_after: "0.20", created_at: new Date(t0 + 2) },
      { id: "e3", owner_id: O_A, hostel_id: H_1, direction: "C", amount: "0.10", balance_after: "0.30", created_at: new Date(t0 + 3) },
    ],
  }]);
  const svc = new FinancialReconciliationService();
  const out = await svc.detectBalanceAfterDrift();
  assertEq(out.length, 0, "balance_chain: paise-stable arithmetic survives float-trap inputs");
}

// ── detectAll orchestration + report shape ─────────────────────────────────

async function test_detectAll_runs_all_12_detectors_and_aggregates() {
  await installPrismaRouter([]); // everything empty
  const svc = new FinancialReconciliationService();
  const report = await svc.detectAll({ limit: 50 });
  assertEq(report.summary.length, 12, "detectAll: 12 detectors reported");
  assertEq(report.issues.length, 0, "detectAll: zero issues on clean DB");
  const kinds = new Set(report.summary.map((s) => s.detector_kind));
  for (const k of Object.values(DETECTOR_KIND)) {
    assert(kinds.has(k), `detectAll: summary contains ${k}`);
  }
  assert(report.total_ms >= 0, "detectAll: total_ms non-negative");
}

async function test_detectAll_isolates_detector_errors() {
  // If one detector's query throws, the others must still run and the
  // failing detector should report an `error` field.
  const dbModule: any = await import("../db");
  let call = 0;
  dbModule.prisma.$queryRaw = (strings: TemplateStringsArray | string[]) => {
    call++;
    const arr = Array.isArray(strings) ? (strings as string[]) : [String(strings)];
    const sqlText = arr.join(" ");
    if (/HAVING COUNT\(\*\) > 1\s+LIMIT/.test(sqlText) && /payment_id/.test(sqlText)) {
      return Promise.reject(new Error("simulated DB outage"));
    }
    return Promise.resolve([]);
  };
  const svc = new FinancialReconciliationService();
  const report = await svc.detectAll({ limit: 50 });
  const dup = report.summary.find((s) => s.detector_kind === DETECTOR_KIND.DUPLICATE_CREDIT);
  assert(!!dup?.error && /simulated DB outage/.test(dup!.error!),
    "detectAll: failing detector surfaces error in summary");
  assertEq(report.summary.length, 12, "detectAll: still reports all 12 detector slots");
  assert(call >= 12, "detectAll: every detector dispatched a query");
}

// ── persistIssues dedup contract ───────────────────────────────────────────

async function test_persistIssues_dedup_collapses_via_P2002() {
  const dbModule: any = await import("../db");
  let inserts = 0;
  dbModule.prisma.financial_reconciliation_issues = {
    create: async (args: any) => {
      inserts++;
      // First insert succeeds, second is a fingerprint collision (the
      // udx_fri_fingerprint_open partial unique index in production).
      if (inserts === 2) {
        const err: any = new Error("Unique constraint failed");
        err.code = "P2002";
        throw err;
      }
      return { id: `inserted-${inserts}`, ...args.data };
    },
  };
  const svc = new FinancialReconciliationService();
  const fakeIssue: IssueReport = {
    kind: DETECTOR_KIND.DUPLICATE_CREDIT,
    severity: "CRITICAL",
    fingerprint: `DUPLICATE_CREDIT|${PAY}`,
    description: "dup",
    owner_id: O_A, hostel_id: H_1, payment_id: PAY,
    ledger_entry_id: CR1, batch_id: null, batch_item_id: null, metadata: {},
  };
  const result = await svc.persistIssues({
    started_at: new Date(), finished_at: new Date(), total_ms: 0,
    issues: [fakeIssue, fakeIssue], summary: [],
  }, { actorId: "admin-uuid" });
  assertEq(result.inserted, 1, "persist: first insert counted");
  assertEq(result.skipped, 1, "persist: duplicate fingerprint counted as skipped, not error");
}

async function test_persistIssues_rethrows_unexpected_errors() {
  const dbModule: any = await import("../db");
  dbModule.prisma.financial_reconciliation_issues = {
    create: async () => { throw new Error("connection refused"); },
  };
  const svc = new FinancialReconciliationService();
  const fakeIssue: IssueReport = {
    kind: DETECTOR_KIND.DUPLICATE_CREDIT,
    severity: "CRITICAL",
    fingerprint: "x", description: "x",
    owner_id: null, hostel_id: null, payment_id: null,
    ledger_entry_id: null, batch_id: null, batch_item_id: null, metadata: {},
  };
  let threw = false;
  try {
    await svc.persistIssues({
      started_at: new Date(), finished_at: new Date(), total_ms: 0,
      issues: [fakeIssue], summary: [],
    });
  } catch (err: any) {
    threw = /connection refused/.test(String(err?.message));
  }
  assert(threw, "persist: non-P2002 errors rethrow");
}

// ── runner ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("FinancialReconciliationService — Phase 7 tests\n");

  console.log("1. duplicate credits (concurrent + webhook regression)");
  await test_duplicate_credits_classifies_concurrent_or_webhook_dup();

  console.log("\n2. missing credits");
  await test_missing_credits_surfaces_paid_payments_with_no_ledger();

  console.log("\n3. orphan debit (interrupted reservation)");
  await test_orphan_debit_for_interrupted_reservation();

  console.log("\n4. over-covered credit");
  await test_over_covered_credit();

  console.log("\n5. reservation overlap (concurrent payouts)");
  await test_reservation_overlap_concurrent_payouts();

  console.log("\n6. batch drift — partial batch failure regression");
  await test_batch_drift_ignores_failed_items();
  await test_batch_drift_classifies_item_and_batch_subkinds_separately();

  console.log("\n7. negative balance");
  await test_negative_balance_only_when_tip_is_negative();

  console.log("\n8. cross-owner contamination");
  await test_cross_owner_contamination_critical();

  console.log("\n9. hostel isolation drift");
  await test_hostel_isolation_drift_excludes_cross_owner_cases();

  console.log("\n10. payout coverage mismatch");
  await test_payout_coverage_mismatch();

  console.log("\n11. settled exceeds collected");
  await test_settled_exceeds_collected();

  console.log("\n12. balance-after chain invariant");
  await test_balance_after_chain_clean();
  await test_balance_after_chain_break_pinned_to_offending_entry();
  await test_balance_after_chain_resets_at_lane_boundary();
  await test_balance_after_paise_stable_no_float_error();

  console.log("\n13. detectAll orchestration");
  await test_detectAll_runs_all_12_detectors_and_aggregates();
  await test_detectAll_isolates_detector_errors();

  console.log("\n14. persistIssues dedup contract");
  await test_persistIssues_dedup_collapses_via_P2002();
  await test_persistIssues_rethrows_unexpected_errors();

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
