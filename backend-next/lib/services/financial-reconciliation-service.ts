/**
 * FinancialReconciliationService — Phase 7
 *
 * Detects and classifies invariant violations in the append-only
 * `owner_settlement_ledger`, the `settlement_batches` table, and the
 * `settlement_batch_items` table. Produces structured `IssueReport`s
 * with a deterministic fingerprint so the same logical issue collapses
 * to one row in `financial_reconciliation_issues`.
 *
 * Architectural contract (Phase-7 brief):
 *
 *  R-1  STRICT READ-ONLY by default. `detectAll()` never mutates any
 *       financial table. The only optional write path is
 *       `persistIssues(report, { actorId })`, which inserts rows into
 *       `financial_reconciliation_issues` (the audit table) using the
 *       existing partial unique index on fingerprint to dedupe.
 *
 *  R-2  NO REPAIR BY RECALCULATION in operational paths. Detection does
 *       not retro-write `balance_after`, does not "recompute" balances,
 *       does not unstick PROCESSING items. Repair is a human admin
 *       decision via the adjustment endpoints in the ledger service.
 *
 *  R-3  PROCESSING RESERVATIONS ARE LIVE LOCKS. Two items in PROCESSING
 *       covering the same credit is a hard error — surfaced as
 *       `reservation_overlap` and severity CRITICAL.
 *
 *  R-4  DETERMINISTIC FINGERPRINTS. Fingerprints embed the issue class
 *       and the natural key (e.g. credit_id for over-coverage, owner+
 *       hostel for balance chain). Re-running detection produces the
 *       same fingerprint, so persisted issues stay deduped under the
 *       existing `udx_fri_fingerprint_open` partial unique index.
 *
 *  R-5  TOTALLY ISOLATED FROM OWNER APIs. This service is never called
 *       from `/api/owner/**` routes. It belongs to /api/admin/finance/**.
 *
 *  R-6  ENUM PRESERVATION. The DB CHECK constraint on
 *       `financial_reconciliation_issues.issue_type` is the 10-value
 *       enum from migration 059. We map our 12+ detector classes onto
 *       those 10 values and disambiguate with `metadata.subkind`.
 */

import { prisma } from "../db";
import { LEDGER_ENTRY_TYPES } from "./settlement-ledger-service";

// ────────────────────────────────────────────────────────────────────────────
//  Public types
// ────────────────────────────────────────────────────────────────────────────

/**
 * The 12 detector classes we surface. These are a strict superset of the
 * SQL `issue_type` CHECK constraint and are translated by `mapToDbIssueType`
 * onto the persisted enum.
 */
export const DETECTOR_KIND = {
  DUPLICATE_CREDIT:          "DUPLICATE_CREDIT",
  MISSING_CREDIT:            "MISSING_CREDIT",
  ORPHAN_DEBIT:              "ORPHAN_DEBIT",
  OVER_COVERED_CREDIT:       "OVER_COVERED_CREDIT",
  RESERVATION_OVERLAP:       "RESERVATION_OVERLAP",
  BATCH_DRIFT:               "BATCH_DRIFT",
  NEGATIVE_BALANCE:          "NEGATIVE_BALANCE",
  CROSS_OWNER_CONTAMINATION: "CROSS_OWNER_CONTAMINATION",
  HOSTEL_ISOLATION_DRIFT:    "HOSTEL_ISOLATION_DRIFT",
  PAYOUT_COVERAGE_MISMATCH:  "PAYOUT_COVERAGE_MISMATCH",
  BALANCE_AFTER_DRIFT:       "BALANCE_AFTER_DRIFT",
  SETTLED_EXCEEDS_COLLECTED: "SETTLED_EXCEEDS_COLLECTED",
} as const;

export type DetectorKind = typeof DETECTOR_KIND[keyof typeof DETECTOR_KIND];

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface IssueReport {
  kind: DetectorKind;
  severity: Severity;
  /** Deterministic — same logical issue always produces the same string. */
  fingerprint: string;
  description: string;
  // Affected scope (any subset may be populated)
  owner_id: string | null;
  hostel_id: string | null;
  payment_id: string | null;
  ledger_entry_id: string | null;
  batch_id: string | null;
  batch_item_id: string | null;
  /** Reproduction metadata — every diagnostic the engineer needs to confirm. */
  metadata: Record<string, any>;
}

export interface DetectionSummary {
  detector_kind: DetectorKind;
  count: number;
  ms: number;
  error?: string;
}

export interface ReconciliationReport {
  started_at: Date;
  finished_at: Date;
  total_ms: number;
  issues: IssueReport[];
  summary: DetectionSummary[];
}

// Map our 12 detector classes onto the 10 DB enum values. Disambiguation
// via metadata.subkind preserves diagnostic specificity without requiring
// a DB schema migration.
function mapToDbIssueType(kind: DetectorKind): string {
  switch (kind) {
    case DETECTOR_KIND.DUPLICATE_CREDIT:          return "DUPLICATE_SETTLEMENT";
    case DETECTOR_KIND.MISSING_CREDIT:            return "PAYMENT_WITHOUT_LEDGER";
    case DETECTOR_KIND.ORPHAN_DEBIT:              return "LEDGER_WITHOUT_PAYMENT";
    case DETECTOR_KIND.OVER_COVERED_CREDIT:       return "DUPLICATE_SETTLEMENT";
    case DETECTOR_KIND.RESERVATION_OVERLAP:       return "DUPLICATE_SETTLEMENT";
    case DETECTOR_KIND.BATCH_DRIFT:               return "BATCH_AMOUNT_DRIFT";
    case DETECTOR_KIND.NEGATIVE_BALANCE:          return "NEGATIVE_BALANCE";
    case DETECTOR_KIND.CROSS_OWNER_CONTAMINATION: return "HOSTEL_ISOLATION_VIOLATION";
    case DETECTOR_KIND.HOSTEL_ISOLATION_DRIFT:    return "HOSTEL_ISOLATION_VIOLATION";
    case DETECTOR_KIND.PAYOUT_COVERAGE_MISMATCH:  return "BATCH_AMOUNT_DRIFT";
    case DETECTOR_KIND.BALANCE_AFTER_DRIFT:       return "BALANCE_AFTER_DRIFT";
    case DETECTOR_KIND.SETTLED_EXCEEDS_COLLECTED: return "SETTLED_EXCEEDS_COLLECTED";
  }
}

function fp(...parts: (string | number | null | undefined)[]): string {
  // Deterministic, opaque, but human-greppable. The DB partial unique index
  // collapses repeat fingerprints in OPEN/INVESTIGATING state.
  return parts.map((p) => (p == null ? "_" : String(p))).join("|");
}

// ────────────────────────────────────────────────────────────────────────────
//  Service
// ────────────────────────────────────────────────────────────────────────────

export class FinancialReconciliationService {
  /**
   * Run every detector in parallel. Each detector is independently
   * bounded by `limit` to keep response time predictable on large
   * datasets — admins requiring more than `limit` rows from any single
   * detector should narrow the scope (per-owner) or accept truncation.
   */
  async detectAll(options: { limit?: number } = {}): Promise<ReconciliationReport> {
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 5000);
    const started_at = new Date();
    const t0 = Date.now();

    const detectors: Array<{ kind: DetectorKind; run: () => Promise<IssueReport[]> }> = [
      { kind: DETECTOR_KIND.DUPLICATE_CREDIT,          run: () => this.detectDuplicateCredits(limit) },
      { kind: DETECTOR_KIND.MISSING_CREDIT,            run: () => this.detectMissingCredits(limit) },
      { kind: DETECTOR_KIND.ORPHAN_DEBIT,              run: () => this.detectOrphanDebits(limit) },
      { kind: DETECTOR_KIND.OVER_COVERED_CREDIT,       run: () => this.detectOverCoveredCredits(limit) },
      { kind: DETECTOR_KIND.RESERVATION_OVERLAP,       run: () => this.detectReservationOverlap(limit) },
      { kind: DETECTOR_KIND.BATCH_DRIFT,               run: () => this.detectBatchDrift(limit) },
      { kind: DETECTOR_KIND.NEGATIVE_BALANCE,          run: () => this.detectNegativeBalances(limit) },
      { kind: DETECTOR_KIND.CROSS_OWNER_CONTAMINATION, run: () => this.detectCrossOwnerContamination(limit) },
      { kind: DETECTOR_KIND.HOSTEL_ISOLATION_DRIFT,    run: () => this.detectHostelIsolationDrift(limit) },
      { kind: DETECTOR_KIND.PAYOUT_COVERAGE_MISMATCH,  run: () => this.detectPayoutCoverageMismatch(limit) },
      { kind: DETECTOR_KIND.BALANCE_AFTER_DRIFT,       run: () => this.detectBalanceAfterDrift(limit) },
      { kind: DETECTOR_KIND.SETTLED_EXCEEDS_COLLECTED, run: () => this.detectSettledExceedsCollected(limit) },
    ];

    const results = await Promise.all(detectors.map(async (d) => {
      const t = Date.now();
      try {
        const rows = await d.run();
        return { kind: d.kind, rows, ms: Date.now() - t, error: undefined as string | undefined };
      } catch (err: any) {
        return { kind: d.kind, rows: [] as IssueReport[], ms: Date.now() - t, error: String(err?.message ?? err) };
      }
    }));

    const issues = results.flatMap((r) => r.rows);
    const summary: DetectionSummary[] = results.map((r) => ({
      detector_kind: r.kind, count: r.rows.length, ms: r.ms, error: r.error,
    }));

    const finished_at = new Date();
    return { started_at, finished_at, total_ms: Date.now() - t0, issues, summary };
  }

  /**
   * Persist a detection report into `financial_reconciliation_issues`.
   * Read-only callers should NEVER invoke this — only the admin
   * reconciliation API surface does. Insertion is deduped per fingerprint
   * via the partial unique index on (fingerprint) WHERE status IN
   * ('OPEN','INVESTIGATING'). Returns counts of inserted vs skipped.
   */
  async persistIssues(report: ReconciliationReport, opts: { actorId?: string } = {}) {
    let inserted = 0;
    let skipped = 0;

    for (const it of report.issues) {
      try {
        await prisma.financial_reconciliation_issues.create({
          data: {
            issue_type:      mapToDbIssueType(it.kind),
            severity:        it.severity,
            status:          "OPEN",
            owner_id:        it.owner_id,
            hostel_id:       it.hostel_id,
            payment_id:      it.payment_id,
            ledger_entry_id: it.ledger_entry_id,
            batch_id:        it.batch_id,
            batch_item_id:   it.batch_item_id,
            fingerprint:     it.fingerprint,
            description:     it.description,
            metadata:        { ...it.metadata, detector_kind: it.kind, persisted_by: opts.actorId ?? null },
          },
        });
        inserted++;
      } catch (err: any) {
        // Partial-unique-index violation = same OPEN/INVESTIGATING issue
        // already on file. That's the dedupe path; skip silently.
        if (String(err?.code) === "P2002" || /udx_fri_fingerprint_open/.test(String(err?.message))) {
          skipped++;
          continue;
        }
        throw err;
      }
    }
    return { inserted, skipped };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  DETECTORS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * 1. DUPLICATE_CREDIT — two CREDIT_COLLECTION rows referencing the same
   *    payment_id. The partial unique index `udx_osl_one_credit_per_payment`
   *    should prevent this, so finding any rows here is a CRITICAL canary
   *    that the index was missed or bypassed.
   */
  async detectDuplicateCredits(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      payment_id: string; entry_count: number; owner_ids: string[]; hostel_ids: string[]; ledger_ids: string[];
    }> = await prisma.$queryRaw`
      SELECT
        payment_id,
        COUNT(*)::int                       AS entry_count,
        array_agg(DISTINCT owner_id::text)  AS owner_ids,
        array_agg(DISTINCT hostel_id::text) AS hostel_ids,
        array_agg(id::text)                 AS ledger_ids
      FROM owner_settlement_ledger
      WHERE entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        AND payment_id IS NOT NULL
      GROUP BY payment_id
      HAVING COUNT(*) > 1
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.DUPLICATE_CREDIT,
      severity: "CRITICAL" as const,
      fingerprint: fp("DUPLICATE_CREDIT", r.payment_id),
      description: `Payment ${r.payment_id} has ${r.entry_count} CREDIT_COLLECTION rows (expected 1).`,
      owner_id: r.owner_ids[0] ?? null,
      hostel_id: r.hostel_ids[0] ?? null,
      payment_id: r.payment_id,
      ledger_entry_id: r.ledger_ids[0] ?? null,
      batch_id: null,
      batch_item_id: null,
      metadata: {
        subkind: "CREDIT_SIDE",
        entry_count: r.entry_count,
        owner_ids: r.owner_ids,
        hostel_ids: r.hostel_ids,
        ledger_ids: r.ledger_ids,
      },
    }));
  }

  /**
   * 2. MISSING_CREDIT — a successful tenant payment (RENT_COLLECTION) that
   *    has no matching CREDIT_COLLECTION ledger row. Indicates the payment
   *    finalization path did not invoke `creditCollectionInTx`. Severity
   *    HIGH (operational gap; owner is invisibly underpaid in the ledger).
   *
   *    Scoped to `RENT_COLLECTION` so platform billing (HMS revenue) is
   *    correctly excluded from the ledger expectation.
   */
  async detectMissingCredits(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      payment_id: string; owner_id: string | null; hostel_id: string | null;
      amount: string; paid_at: Date | null;
    }> = await prisma.$queryRaw`
      SELECT
        p.id              AS payment_id,
        p.owner_id        AS owner_id,
        p.hostel_id       AS hostel_id,
        p.amount_paid::text AS amount,
        p.paid_at         AS paid_at
      FROM payments p
      WHERE p.status = 'PAID'
        AND p.financial_domain = 'RENT_COLLECTION'
        AND p.amount_paid > 0
        AND p.owner_id IS NOT NULL
        AND p.hostel_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM owner_settlement_ledger l
          WHERE l.payment_id = p.id
            AND l.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        )
      ORDER BY p.paid_at DESC NULLS LAST
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.MISSING_CREDIT,
      severity: "HIGH" as const,
      fingerprint: fp("MISSING_CREDIT", r.payment_id),
      description: `Payment ${r.payment_id} is PAID but no CREDIT_COLLECTION ledger row exists.`,
      owner_id: r.owner_id,
      hostel_id: r.hostel_id,
      payment_id: r.payment_id,
      ledger_entry_id: null,
      batch_id: null,
      batch_item_id: null,
      metadata: { amount: r.amount, paid_at: r.paid_at },
    }));
  }

  /**
   * 3. ORPHAN_DEBIT — DEBIT_PAYOUT ledger row whose backing batch_item is
   *    missing or not in SUCCESS state. Mark-success is the only code path
   *    that writes a DEBIT_PAYOUT, and it links the item inside the same
   *    transaction, so this should be empty.
   */
  async detectOrphanDebits(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      debit_id: string; owner_id: string; hostel_id: string;
      batch_item_id: string | null; item_status: string | null; amount: string;
    }> = await prisma.$queryRaw`
      SELECT
        d.id              AS debit_id,
        d.owner_id        AS owner_id,
        d.hostel_id       AS hostel_id,
        d.batch_item_id   AS batch_item_id,
        i.payout_status   AS item_status,
        d.amount::text    AS amount
      FROM owner_settlement_ledger d
      LEFT JOIN settlement_batch_items i ON i.id = d.batch_item_id
      WHERE d.entry_type = ${LEDGER_ENTRY_TYPES.DEBIT_PAYOUT}
        AND (i.id IS NULL OR i.payout_status <> 'SUCCESS')
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.ORPHAN_DEBIT,
      severity: "CRITICAL" as const,
      fingerprint: fp("ORPHAN_DEBIT", r.debit_id),
      description: `DEBIT_PAYOUT ${r.debit_id} backed by item ${r.batch_item_id ?? "(none)"} in status ${r.item_status ?? "MISSING"}.`,
      owner_id: r.owner_id,
      hostel_id: r.hostel_id,
      payment_id: null,
      ledger_entry_id: r.debit_id,
      batch_id: null,
      batch_item_id: r.batch_item_id,
      metadata: { item_status: r.item_status, amount: r.amount },
    }));
  }

  /**
   * 4. OVER_COVERED_CREDIT — a CREDIT covered by ≥2 active items (any combo
   *    of PENDING/PROCESSING/SUCCESS). Stricter than the brief: includes
   *    PENDING since a PENDING item is also a financial lock against
   *    re-coverage. The eligibility query should make this impossible.
   */
  async detectOverCoveredCredits(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      credit_id: string; owner_id: string; hostel_id: string; item_count: number;
      item_ids: string[]; statuses: string[];
    }> = await prisma.$queryRaw`
      SELECT
        c.id                                AS credit_id,
        c.owner_id                          AS owner_id,
        c.hostel_id                         AS hostel_id,
        COUNT(*)::int                       AS item_count,
        array_agg(i.id::text)               AS item_ids,
        array_agg(i.payout_status)          AS statuses
      FROM owner_settlement_ledger c
      JOIN settlement_batch_items i ON c.id = ANY(i.covered_credit_ids)
      WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
      GROUP BY c.id, c.owner_id, c.hostel_id
      HAVING COUNT(*) > 1
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.OVER_COVERED_CREDIT,
      severity: "CRITICAL" as const,
      fingerprint: fp("OVER_COVERED_CREDIT", r.credit_id),
      description: `Credit ${r.credit_id} covered by ${r.item_count} active items (${r.statuses.join(",")}).`,
      owner_id: r.owner_id,
      hostel_id: r.hostel_id,
      payment_id: null,
      ledger_entry_id: r.credit_id,
      batch_id: null,
      batch_item_id: r.item_ids[0] ?? null,
      metadata: { item_count: r.item_count, item_ids: r.item_ids, statuses: r.statuses },
    }));
  }

  /**
   * 5. RESERVATION_OVERLAP — the stricter PROCESSING-vs-PROCESSING subcase
   *    of over-coverage. Per the Phase-7 brief, PROCESSING reservations
   *    are treated as live financial locks; two PROCESSING reservations
   *    covering the same credit is an active double-spend in flight.
   *    Surfaced separately so the admin UI can prioritise it above
   *    historical over-coverage.
   */
  async detectReservationOverlap(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      credit_id: string; owner_id: string; hostel_id: string;
      processing_item_ids: string[];
    }> = await prisma.$queryRaw`
      SELECT
        c.id                                AS credit_id,
        c.owner_id                          AS owner_id,
        c.hostel_id                         AS hostel_id,
        array_agg(i.id::text)               AS processing_item_ids
      FROM owner_settlement_ledger c
      JOIN settlement_batch_items i ON c.id = ANY(i.covered_credit_ids)
      WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        AND i.payout_status = 'PROCESSING'
      GROUP BY c.id, c.owner_id, c.hostel_id
      HAVING COUNT(*) > 1
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.RESERVATION_OVERLAP,
      severity: "CRITICAL" as const,
      fingerprint: fp("RESERVATION_OVERLAP", r.credit_id),
      description: `Credit ${r.credit_id} is currently reserved by ${r.processing_item_ids.length} PROCESSING items (active double-spend).`,
      owner_id: r.owner_id,
      hostel_id: r.hostel_id,
      payment_id: null,
      ledger_entry_id: r.credit_id,
      batch_id: null,
      batch_item_id: r.processing_item_ids[0] ?? null,
      metadata: { processing_item_ids: r.processing_item_ids },
    }));
  }

  /**
   * 6. BATCH_DRIFT — items whose recorded `amount` does not equal the SUM
   *    of their `covered_credit_ids` amounts, AND batches whose
   *    `total_amount` snapshot is out of sync with the SUM of live item
   *    amounts. The CREDIT table is immutable, so item-vs-covered drift is
   *    a tamper canary; batch-vs-items drift indicates a missed snapshot
   *    refresh.
   */
  async detectBatchDrift(limit = 500): Promise<IssueReport[]> {
    type ItemDriftRow = {
      item_id: string; batch_id: string; owner_id: string; hostel_id: string;
      item_amount: string; covered_total: string; drift: string;
    };
    type BatchDriftRow = {
      batch_id: string; batch_total: string; live_items_total: string; drift: string;
    };
    const [itemDrift, batchDrift]: [ItemDriftRow[], BatchDriftRow[]] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          i.id                                                AS item_id,
          i.batch_id                                          AS batch_id,
          i.owner_id                                          AS owner_id,
          i.hostel_id                                         AS hostel_id,
          i.amount::text                                      AS item_amount,
          COALESCE(SUM(c.amount), 0)::text                    AS covered_total,
          (i.amount - COALESCE(SUM(c.amount), 0))::text       AS drift
        FROM settlement_batch_items i
        LEFT JOIN owner_settlement_ledger c
          ON c.id = ANY(i.covered_credit_ids)
         AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        WHERE i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
        GROUP BY i.id, i.batch_id, i.owner_id, i.hostel_id, i.amount
        HAVING ABS(i.amount - COALESCE(SUM(c.amount), 0)) > 0.005
        LIMIT ${limit}
      `,
      prisma.$queryRaw`
        SELECT
          b.id                                                                              AS batch_id,
          b.total_amount::text                                                              AS batch_total,
          COALESCE(SUM(CASE WHEN i.payout_status <> 'CANCELLED' THEN i.amount ELSE 0 END), 0)::text
                                                                                            AS live_items_total,
          (b.total_amount - COALESCE(SUM(CASE WHEN i.payout_status <> 'CANCELLED' THEN i.amount ELSE 0 END), 0))::text
                                                                                            AS drift
        FROM settlement_batches b
        LEFT JOIN settlement_batch_items i ON i.batch_id = b.id
        WHERE b.status NOT IN ('CANCELLED','FAILED')
        GROUP BY b.id, b.total_amount
        HAVING ABS(b.total_amount - COALESCE(SUM(CASE WHEN i.payout_status <> 'CANCELLED' THEN i.amount ELSE 0 END), 0)) > 0.005
        LIMIT ${limit}
      `,
    ]);

    const out: IssueReport[] = [];
    for (const r of itemDrift) {
      out.push({
        kind: DETECTOR_KIND.BATCH_DRIFT,
        severity: "HIGH",
        fingerprint: fp("BATCH_DRIFT", "ITEM", r.item_id),
        description: `Item ${r.item_id} amount=${r.item_amount} but covered credits sum to ${r.covered_total} (drift ${r.drift}).`,
        owner_id: r.owner_id,
        hostel_id: r.hostel_id,
        payment_id: null,
        ledger_entry_id: null,
        batch_id: r.batch_id,
        batch_item_id: r.item_id,
        metadata: { subkind: "ITEM_VS_COVERED", item_amount: r.item_amount, covered_total: r.covered_total, drift: r.drift },
      });
    }
    for (const r of batchDrift) {
      out.push({
        kind: DETECTOR_KIND.BATCH_DRIFT,
        severity: "MEDIUM",
        fingerprint: fp("BATCH_DRIFT", "BATCH", r.batch_id),
        description: `Batch ${r.batch_id} total_amount=${r.batch_total} but live items sum to ${r.live_items_total} (drift ${r.drift}).`,
        owner_id: null,
        hostel_id: null,
        payment_id: null,
        ledger_entry_id: null,
        batch_id: r.batch_id,
        batch_item_id: null,
        metadata: { subkind: "BATCH_VS_ITEMS", batch_total: r.batch_total, live_items_total: r.live_items_total, drift: r.drift },
      });
    }
    return out;
  }

  /**
   * 7. NEGATIVE_BALANCE — the tip `balance_after` for any (owner, hostel)
   *    is < 0. The ledger service rejects negative balances on write, so
   *    this should be empty; finding any row implies a bypass or a
   *    historical tamper.
   */
  async detectNegativeBalances(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      owner_id: string; hostel_id: string; balance_after: string; ledger_id: string; created_at: Date;
    }> = await prisma.$queryRaw`
      SELECT DISTINCT ON (owner_id, hostel_id)
        owner_id,
        hostel_id,
        balance_after::text AS balance_after,
        id                  AS ledger_id,
        created_at
      FROM owner_settlement_ledger
      ORDER BY owner_id, hostel_id, created_at DESC, id DESC
      LIMIT ${limit * 4}
    `;
    const negatives = rows.filter((r) => Number(r.balance_after) < -0.005).slice(0, limit);
    return negatives.map((r) => ({
      kind: DETECTOR_KIND.NEGATIVE_BALANCE,
      severity: "CRITICAL" as const,
      fingerprint: fp("NEGATIVE_BALANCE", r.owner_id, r.hostel_id),
      description: `Owner ${r.owner_id} / hostel ${r.hostel_id} has negative tip balance ${r.balance_after}.`,
      owner_id: r.owner_id,
      hostel_id: r.hostel_id,
      payment_id: null,
      ledger_entry_id: r.ledger_id,
      batch_id: null,
      batch_item_id: null,
      metadata: { balance_after: r.balance_after, tip_entry_at: r.created_at },
    }));
  }

  /**
   * 8. CROSS_OWNER_CONTAMINATION — a batch_item whose owner_id differs
   *    from at least one of its covered credits' owner_id. Indicates that
   *    one owner's payable is being attributed to another owner's payout
   *    (a serious financial isolation breach).
   */
  async detectCrossOwnerContamination(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      item_id: string; item_owner: string; item_hostel: string;
      mismatched_credit_ids: string[]; mismatched_owner_ids: string[];
    }> = await prisma.$queryRaw`
      SELECT
        i.id                                          AS item_id,
        i.owner_id                                    AS item_owner,
        i.hostel_id                                   AS item_hostel,
        array_agg(c.id::text)                         AS mismatched_credit_ids,
        array_agg(DISTINCT c.owner_id::text)          AS mismatched_owner_ids
      FROM settlement_batch_items i
      JOIN owner_settlement_ledger c
        ON c.id = ANY(i.covered_credit_ids)
       AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
      WHERE c.owner_id <> i.owner_id
      GROUP BY i.id, i.owner_id, i.hostel_id
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.CROSS_OWNER_CONTAMINATION,
      severity: "CRITICAL" as const,
      fingerprint: fp("CROSS_OWNER_CONTAMINATION", r.item_id),
      description: `Item ${r.item_id} (owner ${r.item_owner}) covers credits owned by ${r.mismatched_owner_ids.join(",")}.`,
      owner_id: r.item_owner,
      hostel_id: r.item_hostel,
      payment_id: null,
      ledger_entry_id: r.mismatched_credit_ids[0] ?? null,
      batch_id: null,
      batch_item_id: r.item_id,
      metadata: {
        subkind: "OWNER_SCOPE",
        item_owner: r.item_owner,
        mismatched_credit_ids: r.mismatched_credit_ids,
        mismatched_owner_ids: r.mismatched_owner_ids,
      },
    }));
  }

  /**
   * 9. HOSTEL_ISOLATION_DRIFT — a batch_item whose hostel_id differs from
   *    one of its covered credits' hostel_id. Distinct from owner
   *    contamination because two hostels under the SAME owner is still an
   *    operational breach (each hostel's books must be independently
   *    reconcilable for tax/audit/handover purposes).
   */
  async detectHostelIsolationDrift(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      item_id: string; item_owner: string; item_hostel: string;
      mismatched_credit_ids: string[]; mismatched_hostel_ids: string[];
    }> = await prisma.$queryRaw`
      SELECT
        i.id                                          AS item_id,
        i.owner_id                                    AS item_owner,
        i.hostel_id                                   AS item_hostel,
        array_agg(c.id::text)                         AS mismatched_credit_ids,
        array_agg(DISTINCT c.hostel_id::text)         AS mismatched_hostel_ids
      FROM settlement_batch_items i
      JOIN owner_settlement_ledger c
        ON c.id = ANY(i.covered_credit_ids)
       AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
      WHERE c.hostel_id <> i.hostel_id
        AND c.owner_id  =  i.owner_id   -- exclude cross-owner cases (those are reported separately)
      GROUP BY i.id, i.owner_id, i.hostel_id
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.HOSTEL_ISOLATION_DRIFT,
      severity: "HIGH" as const,
      fingerprint: fp("HOSTEL_ISOLATION_DRIFT", r.item_id),
      description: `Item ${r.item_id} (hostel ${r.item_hostel}) covers credits from hostels ${r.mismatched_hostel_ids.join(",")}.`,
      owner_id: r.item_owner,
      hostel_id: r.item_hostel,
      payment_id: null,
      ledger_entry_id: r.mismatched_credit_ids[0] ?? null,
      batch_id: null,
      batch_item_id: r.item_id,
      metadata: {
        subkind: "HOSTEL_SCOPE",
        item_hostel: r.item_hostel,
        mismatched_credit_ids: r.mismatched_credit_ids,
        mismatched_hostel_ids: r.mismatched_hostel_ids,
      },
    }));
  }

  /**
   * 10. PAYOUT_COVERAGE_MISMATCH — for SUCCESS items, the DEBIT_PAYOUT
   *     amount must equal the item.amount. mark-success writes them in
   *     one tx and uses the item amount for the debit, so any drift here
   *     is a tamper / out-of-band write canary.
   */
  async detectPayoutCoverageMismatch(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      item_id: string; debit_id: string | null; owner_id: string; hostel_id: string;
      item_amount: string; debit_amount: string | null; drift: string | null;
    }> = await prisma.$queryRaw`
      SELECT
        i.id                                      AS item_id,
        i.ledger_debit_id                         AS debit_id,
        i.owner_id                                AS owner_id,
        i.hostel_id                               AS hostel_id,
        i.amount::text                            AS item_amount,
        d.amount::text                            AS debit_amount,
        (i.amount - d.amount)::text               AS drift
      FROM settlement_batch_items i
      LEFT JOIN owner_settlement_ledger d ON d.id = i.ledger_debit_id
      WHERE i.payout_status = 'SUCCESS'
        AND (
          d.id IS NULL
          OR ABS(i.amount - d.amount) > 0.005
        )
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.PAYOUT_COVERAGE_MISMATCH,
      severity: "CRITICAL" as const,
      fingerprint: fp("PAYOUT_COVERAGE_MISMATCH", r.item_id),
      description: r.debit_id
        ? `SUCCESS item ${r.item_id} amount=${r.item_amount} but debit ${r.debit_id} amount=${r.debit_amount} (drift ${r.drift}).`
        : `SUCCESS item ${r.item_id} has no linked DEBIT_PAYOUT ledger row.`,
      owner_id: r.owner_id,
      hostel_id: r.hostel_id,
      payment_id: null,
      ledger_entry_id: r.debit_id,
      batch_id: null,
      batch_item_id: r.item_id,
      metadata: {
        subkind: "PAYOUT_COVERAGE",
        item_amount: r.item_amount,
        debit_amount: r.debit_amount,
        drift: r.drift,
      },
    }));
  }

  /**
   * 11. BALANCE_AFTER_DRIFT — arithmetic continuity of the append-only
   *     ledger chain per (owner_id, hostel_id). For every adjacent pair
   *     ordered by (created_at, id):
   *
   *       prev.balance_after + signed_delta(current)  ==  current.balance_after
   *
   *     where signed_delta = +amount for CREDIT direction, -amount for
   *     DEBIT direction. This is the foundational invariant of the entire
   *     settlement engine; any drift here means historical data has been
   *     mutated or `_appendEntryInTx` raced past its advisory lock.
   *
   *     We page through the ledger ordered by (owner, hostel, created_at,
   *     id) and check each consecutive pair in JS for paise-stable
   *     arithmetic (no float compare against `balance_after`).
   */
  async detectBalanceAfterDrift(limit = 500): Promise<IssueReport[]> {
    type Row = {
      id: string;
      owner_id: string;
      hostel_id: string;
      direction: "C" | "D";
      amount: string;
      balance_after: string;
      created_at: Date;
    };
    const rows: Row[] = await prisma.$queryRaw`
      SELECT id, owner_id, hostel_id, direction, amount::text AS amount,
             balance_after::text AS balance_after, created_at
      FROM owner_settlement_ledger
      ORDER BY owner_id, hostel_id, created_at, id
    `;

    const toPaise = (s: string) => Math.round(Number(s) * 100);
    const issues: IssueReport[] = [];
    let prev: Row | null = null;
    let prevPaise = 0;

    for (const r of rows) {
      const sameLane = prev
        && prev.owner_id === r.owner_id
        && prev.hostel_id === r.hostel_id;

      const deltaPaise = (r.direction === "C" ? 1 : -1) * toPaise(r.amount);
      const expectedPaise = sameLane ? prevPaise + deltaPaise : deltaPaise;
      const actualPaise = toPaise(r.balance_after);

      if (actualPaise !== expectedPaise) {
        issues.push({
          kind: DETECTOR_KIND.BALANCE_AFTER_DRIFT,
          severity: "CRITICAL",
          // Fingerprint by (owner, hostel, broken-entry id) so each break
          // de-dupes; if the entire lane is broken, every offending entry
          // gets its own issue (intentional — they need individual review).
          fingerprint: fp("BALANCE_AFTER_DRIFT", r.owner_id, r.hostel_id, r.id),
          description: `Ledger chain broken at ${r.id}: expected balance_after=${(expectedPaise / 100).toFixed(2)} but row has ${(actualPaise / 100).toFixed(2)}.`,
          owner_id: r.owner_id,
          hostel_id: r.hostel_id,
          payment_id: null,
          ledger_entry_id: r.id,
          batch_id: null,
          batch_item_id: null,
          metadata: {
            prev_id: sameLane ? prev!.id : null,
            prev_balance_after: sameLane ? prev!.balance_after : null,
            direction: r.direction,
            delta_amount: r.amount,
            expected_balance_after: (expectedPaise / 100).toFixed(2),
            actual_balance_after: r.balance_after,
            drift_paise: actualPaise - expectedPaise,
          },
        });
        if (issues.length >= limit) break;
      }
      prev = r;
      prevPaise = actualPaise;
    }
    return issues;
  }

  /**
   * 12. SETTLED_EXCEEDS_COLLECTED — per (owner, hostel), the lifetime sum
   *     of DEBIT_PAYOUT amounts exceeds the lifetime sum of CREDIT_*
   *     amounts. Equivalent to a non-temporary negative balance, but
   *     surfaces the violation against lifetime aggregates rather than
   *     the tip row. Useful as a second independent check that would
   *     catch tampering even if `balance_after` is also tampered.
   */
  async detectSettledExceedsCollected(limit = 500): Promise<IssueReport[]> {
    const rows: Array<{
      owner_id: string; hostel_id: string; collected: string; settled: string; excess: string;
    }> = await prisma.$queryRaw`
      WITH agg AS (
        SELECT
          owner_id,
          hostel_id,
          SUM(CASE WHEN direction = 'C' THEN amount ELSE 0 END) AS collected,
          SUM(CASE WHEN direction = 'D' THEN amount ELSE 0 END) AS settled
        FROM owner_settlement_ledger
        GROUP BY owner_id, hostel_id
      )
      SELECT
        owner_id, hostel_id,
        collected::text                   AS collected,
        settled::text                     AS settled,
        (settled - collected)::text       AS excess
      FROM agg
      WHERE settled > collected + 0.005
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      kind: DETECTOR_KIND.SETTLED_EXCEEDS_COLLECTED,
      severity: "CRITICAL" as const,
      fingerprint: fp("SETTLED_EXCEEDS_COLLECTED", r.owner_id, r.hostel_id),
      description: `Owner ${r.owner_id} / hostel ${r.hostel_id}: settled ${r.settled} exceeds collected ${r.collected} by ${r.excess}.`,
      owner_id: r.owner_id,
      hostel_id: r.hostel_id,
      payment_id: null,
      ledger_entry_id: null,
      batch_id: null,
      batch_item_id: null,
      metadata: { collected: r.collected, settled: r.settled, excess: r.excess },
    }));
  }
}

export const financialReconciliationService = new FinancialReconciliationService();
