/**
 * OwnerFinancialViewService — read-only, owner-scoped financial visibility.
 *
 * Architectural contract:
 *
 *  R-1  STRICT READ ONLY. No method on this service writes anything.
 *       All state mutations live in `payment-service`, `settlement-ledger-service`,
 *       and `settlement-batch-service`.
 *
 *  R-2  STRICT OWNER SCOPING. Every method takes an `ownerId` and embeds it
 *       in every query. There is no admin-bypass parameter, no "list all",
 *       and no path that returns another owner's data. Treasury/admin
 *       surfaces use the batch service instead.
 *
 *  R-3  OWNER-FRIENDLY VOCABULARY. Internal payout_status / batch state /
 *       admin workflow terminology is mapped to a small fixed set of
 *       owner-facing labels via `mapOwnerSettlementStatus`. We never
 *       return:
 *         - settlement_batch_id / batch_number
 *         - admin_id (created_by, approved_by, processed_by, etc.)
 *         - internal payout_status enum values (PENDING/PROCESSING/SUCCESS/FAILED)
 *         - covered_credit_ids attribution arrays
 *         - reconciliation/drift signals
 *
 *  R-4  APPEND-ONLY PRESERVED. Reading is a non-mutation. We project state
 *       from the canonical ledger and the batch_items operational table;
 *       neither is ever updated by this service.
 *
 *  R-5  NO DISPUTE / MUTATION ENDPOINTS. We do not expose retry-payout,
 *       update-bank-details, raise-dispute, or any write path. Those are
 *       admin-tooling concerns for now.
 */

import { prisma } from "../db";
import { LEDGER_ENTRY_TYPES } from "./settlement-ledger-service";

// ── Owner-facing settlement status labels ────────────────────────────────

/**
 * Stable identifiers we return on the wire. The UI renders user-friendly
 * strings based on these. Do not localise these values; the UI layer is
 * responsible for translation.
 */
export const OWNER_SETTLEMENT_STATUS = {
  PENDING_SETTLEMENT: "PENDING_SETTLEMENT",     // collected, not yet attributed to a transfer
  TRANSFER_IN_PROGRESS: "TRANSFER_IN_PROGRESS", // attributed and being processed by treasury
  SETTLED: "SETTLED",                            // money has reached the owner
  SETTLEMENT_DELAYED: "SETTLEMENT_DELAYED",     // last attempt failed; treasury will retry
} as const;

export type OwnerSettlementStatus =
  (typeof OWNER_SETTLEMENT_STATUS)[keyof typeof OWNER_SETTLEMENT_STATUS];

/**
 * Translate the internal item.payout_status into the owner-facing label.
 * Defaults to PENDING_SETTLEMENT when the credit has no covering item.
 */
function mapOwnerSettlementStatus(payoutStatus: string | null | undefined): OwnerSettlementStatus {
  switch (payoutStatus) {
    case "SUCCESS":     return OWNER_SETTLEMENT_STATUS.SETTLED;
    case "PROCESSING":  return OWNER_SETTLEMENT_STATUS.TRANSFER_IN_PROGRESS;
    case "PENDING":     return OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT;
    case "FAILED":      return OWNER_SETTLEMENT_STATUS.SETTLEMENT_DELAYED;
    default:            return OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT;
  }
}

// ── Service ──────────────────────────────────────────────────────────────

export class OwnerFinancialViewService {
  /**
   * Top-level summary numbers for the owner finance dashboard. Returns
   * the four buckets explicitly required by the Phase-6 brief:
   *
   *   total_collected     - lifetime sum of CREDIT amounts (everything
   *                         tenants ever paid that was attributed to
   *                         the owner)
   *   pending_settlement  - lifetime collected MINUS lifetime settled.
   *                         Equivalent to the current ledger balance.
   *   settled_payouts     - lifetime sum of DEBIT_PAYOUT amounts
   *   recent_transfers    - count and sum of DEBIT_PAYOUT entries in the
   *                         last `windowDays` days
   *
   * All amounts are returned as decimal strings to preserve precision
   * across the JSON wire boundary. The UI parses with Number() at render.
   */
  async getOwnerSummary(ownerId: string, windowDays: number = 30) {
    this._assertUuid(ownerId, "ownerId");
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [credits, debits, recentDebits, hostelCount] = await Promise.all([
      prisma.$queryRaw<Array<{ total: string; count: number }>>`
        SELECT COALESCE(SUM(amount), 0)::text AS total, COUNT(*)::int AS count
        FROM owner_settlement_ledger
        WHERE owner_id = ${ownerId}::uuid
          AND entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
      `,
      prisma.$queryRaw<Array<{ total: string; count: number }>>`
        SELECT COALESCE(SUM(amount), 0)::text AS total, COUNT(*)::int AS count
        FROM owner_settlement_ledger
        WHERE owner_id = ${ownerId}::uuid
          AND entry_type = ${LEDGER_ENTRY_TYPES.DEBIT_PAYOUT}
      `,
      prisma.$queryRaw<Array<{ total: string; count: number }>>`
        SELECT COALESCE(SUM(amount), 0)::text AS total, COUNT(*)::int AS count
        FROM owner_settlement_ledger
        WHERE owner_id = ${ownerId}::uuid
          AND entry_type = ${LEDGER_ENTRY_TYPES.DEBIT_PAYOUT}
          AND created_at >= ${windowStart}
      `,
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT hostel_id)::int AS count
        FROM owner_settlement_ledger
        WHERE owner_id = ${ownerId}::uuid
      `,
    ]);

    const totalCollectedPaise = Math.round(Number(credits[0]?.total ?? 0) * 100);
    const totalSettledPaise = Math.round(Number(debits[0]?.total ?? 0) * 100);
    const pendingPaise = totalCollectedPaise - totalSettledPaise;

    return {
      total_collected: {
        amount: (totalCollectedPaise / 100).toFixed(2),
        collection_count: credits[0]?.count ?? 0,
      },
      pending_settlement: {
        // Authoritative: derived from append-only ledger arithmetic, not
        // from any operational flag.
        amount: (pendingPaise / 100).toFixed(2),
      },
      settled_payouts: {
        amount: (totalSettledPaise / 100).toFixed(2),
        transfer_count: debits[0]?.count ?? 0,
      },
      recent_transfers: {
        amount: recentDebits[0]?.total ?? "0",
        transfer_count: recentDebits[0]?.count ?? 0,
        window_days: windowDays,
      },
      hostel_count: hostelCount[0]?.count ?? 0,
    };
  }

  /**
   * List the owner's recent collections (CREDIT entries) annotated with
   * their owner-facing settlement status. Used by the "Collections" tab
   * of the owner finance page.
   *
   * Status derivation (per Q1/Q2 mapping in the Phase-6 brief):
   *   - If the credit is currently covered by an item with payout_status in
   *     PENDING / PROCESSING / SUCCESS, return the mapped status.
   *   - Else if any historical FAILED item once covered the credit, return
   *     SETTLEMENT_DELAYED (the last attempt failed and treasury will retry).
   *   - Else PENDING_SETTLEMENT.
   *
   * Pagination uses cursor (id of last row in previous page).
   */
  async listOwnerCollections(params: {
    ownerId: string;
    hostelId?: string;
    limit?: number;
    cursorCreatedAt?: string | null;
    cursorId?: string | null;
  }) {
    this._assertUuid(params.ownerId, "ownerId");
    if (params.hostelId) this._assertUuid(params.hostelId, "hostelId");
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    // Cursor predicate: rows with (created_at, id) strictly less than the cursor.
    const cursorClauseSql = params.cursorCreatedAt && params.cursorId
      ? `AND (c.created_at, c.id) < ('${new Date(params.cursorCreatedAt).toISOString()}'::timestamptz, '${params.cursorId}'::uuid)`
      : "";

    // We use a single query with two LATERAL joins to compute the
    // settlement status without N+1.
    type CollectionRow = {
      id: string;
      amount: string;
      created_at: Date;
      hostel_id: string;
      payment_id: string | null;
      active_item_status: string | null;
      had_failed_item: boolean;
    };
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT
        c.id,
        c.amount::text     AS amount,
        c.created_at,
        c.hostel_id,
        c.payment_id,
        active_item.payout_status                  AS active_item_status,
        COALESCE(failed_item.had_failed, false)    AS had_failed_item
      FROM owner_settlement_ledger c
      LEFT JOIN LATERAL (
        SELECT i.payout_status
        FROM settlement_batch_items i
        WHERE c.id = ANY(i.covered_credit_ids)
          AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
        ORDER BY i.created_at DESC
        LIMIT 1
      ) active_item ON TRUE
      LEFT JOIN LATERAL (
        SELECT TRUE AS had_failed
        FROM settlement_batch_items i
        WHERE c.id = ANY(i.covered_credit_ids)
          AND i.payout_status = 'FAILED'
        LIMIT 1
      ) failed_item ON TRUE
      WHERE c.owner_id = $1::uuid
        AND c.entry_type = $2
        ${params.hostelId ? "AND c.hostel_id = $3::uuid" : ""}
        ${cursorClauseSql}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ${limit}
    `, params.ownerId, LEDGER_ENTRY_TYPES.CREDIT_COLLECTION, ...(params.hostelId ? [params.hostelId] : []))) as CollectionRow[];

    return rows.map((r: CollectionRow) => {
      const status: OwnerSettlementStatus = r.active_item_status
        ? mapOwnerSettlementStatus(r.active_item_status)
        : (r.had_failed_item
            ? OWNER_SETTLEMENT_STATUS.SETTLEMENT_DELAYED
            : OWNER_SETTLEMENT_STATUS.PENDING_SETTLEMENT);
      return {
        id: r.id,
        amount: r.amount,
        collected_at: r.created_at,
        hostel_id: r.hostel_id,
        payment_id: r.payment_id,
        settlement_status: status,
      };
    });
  }

  /**
   * List the owner's settled payouts (DEBIT_PAYOUT entries). This is the
   * "Transfers" history shown on the owner finance page. Each row exposes
   * the bank reference (UTR/NEFT/etc.) per the Phase-6 brief — that
   * reference is the owner's authoritative settlement proof.
   *
   * Internal fields (settlement_batch_id, batch_item.id, admin actor ids,
   * batch_number, etc.) are NOT included on the wire.
   */
  async listOwnerTransfers(params: {
    ownerId: string;
    hostelId?: string;
    limit?: number;
    cursorCreatedAt?: string | null;
    cursorId?: string | null;
  }) {
    this._assertUuid(params.ownerId, "ownerId");
    if (params.hostelId) this._assertUuid(params.hostelId, "hostelId");
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    const cursorClauseSql = params.cursorCreatedAt && params.cursorId
      ? `AND (d.created_at, d.id) < ('${new Date(params.cursorCreatedAt).toISOString()}'::timestamptz, '${params.cursorId}'::uuid)`
      : "";

    type TransferRow = {
      id: string;
      amount: string;
      transferred_at: Date;
      hostel_id: string;
      payout_method: string | null;
      payout_reference: string | null;
    };
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT
        d.id,
        d.amount::text                          AS amount,
        d.created_at                            AS transferred_at,
        d.hostel_id,
        i.payout_method                         AS payout_method,
        i.payout_reference                      AS payout_reference
      FROM owner_settlement_ledger d
      LEFT JOIN settlement_batch_items i ON i.id = d.batch_item_id
      WHERE d.owner_id = $1::uuid
        AND d.entry_type = $2
        ${params.hostelId ? "AND d.hostel_id = $3::uuid" : ""}
        ${cursorClauseSql}
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT ${limit}
    `, params.ownerId, LEDGER_ENTRY_TYPES.DEBIT_PAYOUT, ...(params.hostelId ? [params.hostelId] : []))) as TransferRow[];

    return rows.map((r: TransferRow) => ({
      id: r.id,
      amount: r.amount,
      transferred_at: r.transferred_at,
      hostel_id: r.hostel_id,
      payout_method: r.payout_method ?? null,
      payout_reference: r.payout_reference ?? null,
      settlement_status: OWNER_SETTLEMENT_STATUS.SETTLED as OwnerSettlementStatus,
    }));
  }

  /**
   * Per-hostel breakdown of current pending settlement, used for owners
   * with multiple hostels. Returns one row per hostel that has any
   * activity (positive or zero balance), ordered by largest pending
   * first.
   */
  async getPendingByHostel(ownerId: string) {
    this._assertUuid(ownerId, "ownerId");
    const rows = await prisma.$queryRaw<Array<{
      hostel_id: string;
      lifetime_collected: string;
      lifetime_settled: string;
      pending: string;
      uncovered_credit_count: number;
      in_progress_credit_count: number;
    }>>`
      WITH credits AS (
        SELECT hostel_id, SUM(amount)::text AS total, COUNT(*)::int AS cnt
        FROM owner_settlement_ledger
        WHERE owner_id = ${ownerId}::uuid AND entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        GROUP BY hostel_id
      ),
      debits AS (
        SELECT hostel_id, SUM(amount)::text AS total
        FROM owner_settlement_ledger
        WHERE owner_id = ${ownerId}::uuid AND entry_type = ${LEDGER_ENTRY_TYPES.DEBIT_PAYOUT}
        GROUP BY hostel_id
      ),
      uncovered AS (
        SELECT c.hostel_id, COUNT(*)::int AS cnt
        FROM owner_settlement_ledger c
        WHERE c.owner_id = ${ownerId}::uuid
          AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
          AND NOT EXISTS (
            SELECT 1 FROM settlement_batch_items i
            WHERE c.id = ANY(i.covered_credit_ids)
              AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
          )
        GROUP BY c.hostel_id
      ),
      in_progress AS (
        SELECT c.hostel_id, COUNT(*)::int AS cnt
        FROM owner_settlement_ledger c
        JOIN settlement_batch_items i ON c.id = ANY(i.covered_credit_ids)
        WHERE c.owner_id = ${ownerId}::uuid
          AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
          AND i.payout_status IN ('PENDING','PROCESSING')
        GROUP BY c.hostel_id
      )
      SELECT
        c.hostel_id,
        c.total                                                 AS lifetime_collected,
        COALESCE(d.total, '0')                                  AS lifetime_settled,
        (c.total::numeric - COALESCE(d.total::numeric, 0))::text AS pending,
        COALESCE(u.cnt, 0)                                      AS uncovered_credit_count,
        COALESCE(p.cnt, 0)                                      AS in_progress_credit_count
      FROM credits c
      LEFT JOIN debits d        ON d.hostel_id = c.hostel_id
      LEFT JOIN uncovered u     ON u.hostel_id = c.hostel_id
      LEFT JOIN in_progress p   ON p.hostel_id = c.hostel_id
      ORDER BY (c.total::numeric - COALESCE(d.total::numeric, 0)) DESC
    `;
    return rows;
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private _assertUuid(value: string, label: string) {
    if (typeof value !== "string" || value.length < 32) {
      throw new Error(`BAD_REQUEST: ${label} must be a UUID string`);
    }
  }
}

export const ownerFinancialViewService = new OwnerFinancialViewService();
