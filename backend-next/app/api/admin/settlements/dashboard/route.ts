export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { prisma } from "@/lib/db";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { settlementLedgerService, LEDGER_ENTRY_TYPES } from "@/lib/services/settlement-ledger-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/admin/settlements/dashboard?days=7
 *
 * Treasury overview dashboard. Computes the FIVE distinct money buckets
 * required by the financial-operations brief, plus operational signals.
 * Strict admin-only.
 *
 * The five buckets:
 *   1. HMS_PLATFORM_REVENUE
 *      Successful PLATFORM_BILLING payments in the window. This is what
 *      HMS earned from owners' subscriptions/add-ons. NEVER mixed with
 *      owner liability.
 *
 *   2. OWNER_PAYABLE_LIABILITY
 *      Sum of `balance_after` across the latest ledger row for every
 *      (owner, hostel) pair. This is the canonical "what HMS owes to
 *      owners right now" — derived from the ledger, not from payments.
 *
 *   3. UNSETTLED_LIABILITY
 *      Sum of CREDIT amounts for credits NOT covered by any active
 *      batch_item (PENDING/PROCESSING/SUCCESS). Subset of (2). The
 *      delta (2 - 3) represents money currently RESERVED inside an
 *      active batch (PENDING/PROCESSING items).
 *
 *   4. SETTLED_PAYOUTS_WINDOW
 *      Sum of DEBIT_PAYOUT amounts in the time window. This is money
 *      actually disbursed.
 *
 *   5. FAILED_PAYOUT_EXPOSURE
 *      Sum of FAILED batch item amounts whose covered credits remain
 *      uncovered (i.e. not yet retried in another active item). Signals
 *      treasury work-to-do.
 *
 * Each bucket is reported in rupees (Decimal serialised as string).
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days") || 7), 1), 365);
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [
      hmsPlatformRevenue,
      ownerPayableTotal,
      unsettledLiability,
      settledPayoutsInWindow,
      failedExposure,
      hmsAggregate,
      reconciliationCounts,
      batchStatusCounts,
      itemStatusCounts,
      oldestUnsettled,
    ] = await Promise.all([
      // (1) HMS platform revenue — payments table, PLATFORM_BILLING domain.
      prisma.payments.aggregate({
        where: {
          status: "SUCCESS",
          payment_domain: "PLATFORM_BILLING",
          created_at: { gte: windowStart },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),

      // (2) Owner payable liability — current ledger tip across all pairs.
      //     We compute SUM(balance_after) over the latest row of each
      //     (owner_id, hostel_id) group via DISTINCT ON.
      prisma.$queryRaw<Array<{ total: string; pair_count: number }>>`
        WITH tips AS (
          SELECT DISTINCT ON (owner_id, hostel_id)
            owner_id, hostel_id, balance_after
          FROM owner_settlement_ledger
          ORDER BY owner_id, hostel_id, created_at DESC, id DESC
        )
        SELECT
          COALESCE(SUM(balance_after), 0)::text AS total,
          COUNT(*)::int                          AS pair_count
        FROM tips
      `,

      // (3) Unsettled liability — CREDITs not in any active item.
      prisma.$queryRaw<Array<{ total: string; count: number }>>`
        SELECT
          COALESCE(SUM(c.amount), 0)::text AS total,
          COUNT(*)::int                    AS count
        FROM owner_settlement_ledger c
        WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
          AND NOT EXISTS (
            SELECT 1 FROM settlement_batch_items i
            WHERE c.id = ANY(i.covered_credit_ids)
              AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
          )
      `,

      // (4) Settled payouts in window — DEBIT_PAYOUT entries.
      prisma.$queryRaw<Array<{ total: string; count: number }>>`
        SELECT
          COALESCE(SUM(amount), 0)::text AS total,
          COUNT(*)::int                  AS count
        FROM owner_settlement_ledger
        WHERE entry_type = ${LEDGER_ENTRY_TYPES.DEBIT_PAYOUT}
          AND created_at >= ${windowStart}
      `,

      // (5) Failed payout exposure — sum of FAILED items whose credits
      //     remain uncovered by any active item.
      prisma.$queryRaw<Array<{ total: string; item_count: number; orphan_credit_count: number }>>`
        WITH failed_items AS (
          SELECT id, amount, covered_credit_ids
          FROM settlement_batch_items
          WHERE payout_status = 'FAILED'
        ),
        exposed AS (
          SELECT fi.*
          FROM failed_items fi
          WHERE NOT EXISTS (
            SELECT 1 FROM settlement_batch_items i2
            WHERE i2.payout_status IN ('PENDING','PROCESSING','SUCCESS')
              AND i2.covered_credit_ids && fi.covered_credit_ids
          )
        )
        SELECT
          COALESCE(SUM(amount), 0)::text                                           AS total,
          COUNT(*)::int                                                             AS item_count,
          COALESCE(SUM(array_length(covered_credit_ids, 1)), 0)::int                AS orphan_credit_count
        FROM exposed
      `,

      // Convenience: HMS-internal aggregate liability via service.
      settlementLedgerService.getHMSAggregateLiability(),

      // Reconciliation counts (fast — same queries as recon view, count only).
      Promise.all([
        prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM owner_settlement_ledger c
          WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
            AND NOT EXISTS (
              SELECT 1 FROM settlement_batch_items i
              WHERE c.id = ANY(i.covered_credit_ids)
                AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
            )
        `,
        settlementBatchService.findOverCoveredCredits(50).then((r) => r.length),
        settlementBatchService.findOrphanDebits(50).then((r) => r.length),
        settlementBatchService.findCoverageDrift(50).then((r) => r.length),
      ]),

      // Batch status histogram.
      prisma.settlement_batches.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),

      // Item status histogram.
      prisma.settlement_batch_items.groupBy({
        by: ["payout_status"],
        _count: { _all: true },
      }),

      // Oldest unsettled credit — surfaces aging signal.
      prisma.$queryRaw<Array<{ created_at: Date | null; age_days: number | null }>>`
        SELECT
          MIN(c.created_at) AS created_at,
          EXTRACT(DAY FROM NOW() - MIN(c.created_at))::int AS age_days
        FROM owner_settlement_ledger c
        WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
          AND NOT EXISTS (
            SELECT 1 FROM settlement_batch_items i
            WHERE c.id = ANY(i.covered_credit_ids)
              AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
          )
      `,
    ]);

    const [uncoveredCount, overCoveredCount, orphanDebitsCount, coverageDriftCount] = reconciliationCounts;

    return apiResponse({
      window_days: days,
      window_start: windowStart.toISOString(),
      buckets: {
        // Bucket 1: HMS platform revenue (clean — never mixed with owner money).
        hms_platform_revenue: {
          total: (hmsPlatformRevenue._sum.amount ?? 0).toString(),
          payment_count: hmsPlatformRevenue._count._all,
          window_days: days,
        },
        // Bucket 2: Owner payable liability (current ledger tip across all owners).
        owner_payable_liability: {
          total: ownerPayableTotal[0]?.total ?? "0",
          owner_hostel_pairs: ownerPayableTotal[0]?.pair_count ?? 0,
        },
        // Bucket 3: Unsettled liability (credits not in any active batch item).
        unsettled_liability: {
          total: unsettledLiability[0]?.total ?? "0",
          credit_count: unsettledLiability[0]?.count ?? 0,
        },
        // Bucket 4: Settled payouts in window.
        settled_payouts_in_window: {
          total: settledPayoutsInWindow[0]?.total ?? "0",
          debit_count: settledPayoutsInWindow[0]?.count ?? 0,
          window_days: days,
        },
        // Bucket 5: Failed payout exposure (FAILED items not retried).
        failed_payout_exposure: {
          total: failedExposure[0]?.total ?? "0",
          failed_item_count: failedExposure[0]?.item_count ?? 0,
          orphan_credit_count: failedExposure[0]?.orphan_credit_count ?? 0,
        },
      },
      hms_aggregate_liability: hmsAggregate,
      reconciliation: {
        uncovered_credits: uncoveredCount[0]?.count ?? 0,
        over_covered_credits: overCoveredCount,
        orphan_debits: orphanDebitsCount,
        coverage_drift: coverageDriftCount,
        // Operational health: anything > 0 in the bottom three is an alert.
        healthy: overCoveredCount === 0 && orphanDebitsCount === 0 && coverageDriftCount === 0,
      },
      operational: {
        batches_by_status: batchStatusCounts,
        items_by_payout_status: itemStatusCounts,
        oldest_unsettled_credit: {
          created_at: oldestUnsettled[0]?.created_at?.toISOString() ?? null,
          age_days: oldestUnsettled[0]?.age_days ?? null,
        },
      },
    });
  } catch (err: any) {
    return mapServiceError(err);
  }
}
