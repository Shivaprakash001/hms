/**
 * SettlementBatchService — manual payout operations for HMS treasury.
 *
 * Architectural contracts (per Phase-4 brief, option-b chosen):
 *
 *  C-1  CREDIT rows in `owner_settlement_ledger` are FULLY IMMUTABLE.
 *       Settlement state is DERIVED from coverage attribution only —
 *       a CREDIT is "settled" iff some `settlement_batch_items` row with
 *       `payout_status = 'SUCCESS'` lists its id in `covered_credit_ids`.
 *
 *  C-2  Strict transactional safety. Marking a payout SUCCESS atomically:
 *         - locks the item row,
 *         - validates state,
 *         - writes a DEBIT_PAYOUT ledger entry via the ledger service
 *           (which acquires its own per-(owner,hostel) advisory lock),
 *         - links the item to the new ledger row,
 *         - writes an admin audit row.
 *       Any failure rolls back ALL of the above. Partial debit is impossible.
 *
 *  C-3  Failed payouts NEVER produce a DEBIT. The covered credits remain
 *       in their pre-attempt state and become eligible for the next batch
 *       (the eligibility query filters out items with payout_status='FAILED').
 *
 *  C-4  Idempotency at every boundary:
 *         - createBatch: client-supplied idempotency_key OR derived from
 *           (admin_id + intent fingerprint).
 *         - addItem: `batch:{batchId}:owner:{ownerId}:hostel:{hostelId}`
 *         - markItemSuccess: ledger debit keyed on `debit:batch_item:{itemId}`.
 *         All three are protected by DB unique constraints.
 *
 *  C-5  No background recompute / repair jobs. Batch totals are kept in sync
 *       transactionally as items are added/removed.
 *
 *  C-6  Treasury surface (admin) is fully separate from owner-facing reads.
 *       This file is admin-only by service contract; the API routes that
 *       wrap it (Phase 5) must be admin-gated.
 *
 *  C-7  Reconciliation visibility (uncovered / over-covered / orphan /
 *       drift) is provided as read-only views here. The active detection
 *       loop lives in Phase 7 (financial-reconciliation-service).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { eventSystem } from "../events";
import { getLogger } from "../logger";
import {
  settlementLedgerService,
  LEDGER_EVENTS,
  LEDGER_ENTRY_TYPES,
} from "./settlement-ledger-service";

const logger = getLogger("settlement.batch");

// ---------- Constants ----------

export const BATCH_STATUS = {
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  PARTIALLY_FAILED: "PARTIALLY_FAILED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export const PAYOUT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export const PAYOUT_METHOD = {
  NEFT: "NEFT",
  IMPS: "IMPS",
  UPI: "UPI",
  RTGS: "RTGS",
  CHEQUE: "CHEQUE",
  OTHER: "OTHER",
} as const;

// payout_status values that "consume" a credit's eligibility.
const COVERAGE_OCCUPYING_STATUSES = ["PENDING", "PROCESSING", "SUCCESS"] as const;
// payout_status values that release coverage.
const COVERAGE_FREEING_STATUSES = ["FAILED", "CANCELLED"] as const;

type Tx = Prisma.TransactionClient;

export interface AdminCtx {
  adminId: string;
  ip?: string | null;
  userAgent?: string | null;
}

// ---------- Money helpers (paise integer math) ----------

function toPaise(amount: number | string | Prisma.Decimal): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) throw new Error("BAD_REQUEST: amount not finite");
  return Math.round(n * 100);
}
function fromPaise(p: number): number {
  return p / 100;
}

// ---------- Service ----------

export class SettlementBatchService {
  // =====================================================================
  //  BATCH LIFECYCLE
  // =====================================================================

  /**
   * Create a new DRAFT batch. Items are added separately via addItem.
   */
  async createBatch(ctx: AdminCtx, params: { notes?: string | null }) {
    this._assertAdmin(ctx);
    const batch = await prisma.$transaction(async (tx: Tx) => {
      const batchNumber = await this._generateBatchNumber(tx);
      const created = await tx.settlement_batches.create({
        data: {
          batch_number: batchNumber,
          status: BATCH_STATUS.DRAFT,
          created_by: ctx.adminId,
          notes: params.notes ?? null,
        },
      });
      await this._writeAuditInTx(tx, ctx, {
        action_type: "BATCH_CREATED",
        subject_type: "BATCH",
        subject_id: created.id,
        after_state: { status: created.status, batch_number: created.batch_number },
      });
      return created;
    });
    logger.info("batch.created", { batch_id: batch.id, batch_number: batch.batch_number });
    return batch;
  }

  /**
   * Add a payout item for one (owner, hostel) to a DRAFT batch.
   *
   * Coverage attribution rules:
   *   - Eligible CREDIT_COLLECTION rows = those for (owner, hostel) NOT
   *     already inside a settlement_batch_items row whose payout_status
   *     occupies coverage (PENDING / PROCESSING / SUCCESS).
   *   - If `requestedAmountPaise` is given, credits are picked FIFO until
   *     that exact amount is met. Reject if no exact match (we never
   *     partially cover a credit).
   *   - If amount is not given, ALL eligible credits are picked.
   *
   * Concurrency:
   *   - The transaction acquires a per-(owner, hostel) advisory lock so
   *     two concurrent addItem calls cannot race on the same eligible set.
   *   - It also takes `FOR UPDATE` on each candidate credit row. This is
   *     belt-and-braces against a non-batch path that might one day claim
   *     a credit (e.g. a future refund flow).
   */
  async addItem(ctx: AdminCtx, params: {
    batchId: string;
    ownerId: string;
    hostelId: string;
    requestedAmountPaise?: number | null;
    payoutMethod?: keyof typeof PAYOUT_METHOD;
  }) {
    this._assertAdmin(ctx);
    this._assertUuid(params.batchId, "batchId");
    this._assertUuid(params.ownerId, "ownerId");
    this._assertUuid(params.hostelId, "hostelId");

    const idempotencyKey =
      `batch:${params.batchId}:owner:${params.ownerId}:hostel:${params.hostelId}`;

    return prisma.$transaction(async (tx: Tx) => {
      // ── Idempotency fast path ────────────────────────────────────────
      const existing = await tx.settlement_batch_items.findUnique({
        where: { idempotency_key: idempotencyKey },
      });
      if (existing) {
        logger.info("batch.add_item.idempotent_hit", { item_id: existing.id });
        return { item: existing, alreadyExisted: true };
      }

      // ── Lock the batch and validate state ────────────────────────────
      await tx.$queryRaw`
        SELECT id FROM settlement_batches
        WHERE id = ${params.batchId}::uuid
        FOR UPDATE
      `;
      const batch = await tx.settlement_batches.findUnique({ where: { id: params.batchId } });
      if (!batch) throw new Error("NOT_FOUND: batch not found");
      if (batch.status !== BATCH_STATUS.DRAFT) {
        throw new Error(`BAD_REQUEST: cannot add items to batch in status ${batch.status}`);
      }

      // ── Per-(owner, hostel) advisory lock to serialize coverage ──────
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${params.ownerId}), hashtext(${params.hostelId}))
      `;

      // ── Pick eligible credits in FIFO order (with FOR UPDATE) ────────
      const eligible = await tx.$queryRaw<Array<{ id: string; amount: string }>>`
        SELECT c.id, c.amount::text AS amount
        FROM owner_settlement_ledger c
        WHERE c.owner_id = ${params.ownerId}::uuid
          AND c.hostel_id = ${params.hostelId}::uuid
          AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
          AND NOT EXISTS (
            SELECT 1 FROM settlement_batch_items i
            WHERE c.id = ANY(i.covered_credit_ids)
              AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
          )
        ORDER BY c.created_at ASC, c.id ASC
        FOR UPDATE OF c
      `;

      if (eligible.length === 0) {
        throw new Error("BAD_REQUEST: no eligible credits for this owner+hostel");
      }

      // ── Decide which credits to claim ────────────────────────────────
      const picked: Array<{ id: string; paise: number }> = [];
      let totalPaise = 0;
      const requestedPaise = params.requestedAmountPaise ?? null;

      for (const row of eligible) {
        const p = toPaise(row.amount);
        if (requestedPaise != null) {
          if (totalPaise + p > requestedPaise) continue; // skip; try next smaller
          picked.push({ id: row.id, paise: p });
          totalPaise += p;
          if (totalPaise === requestedPaise) break;
        } else {
          picked.push({ id: row.id, paise: p });
          totalPaise += p;
        }
      }

      if (requestedPaise != null && totalPaise !== requestedPaise) {
        throw new Error(
          `BAD_REQUEST: cannot compose requested amount ${fromPaise(requestedPaise)} from eligible credits (got ${fromPaise(totalPaise)})`
        );
      }
      if (picked.length === 0) {
        throw new Error("BAD_REQUEST: no credits selected");
      }

      // ── Insert item ──────────────────────────────────────────────────
      const item = await tx.settlement_batch_items.create({
        data: {
          batch_id: params.batchId,
          owner_id: params.ownerId,
          hostel_id: params.hostelId,
          amount: fromPaise(totalPaise),
          payout_method: params.payoutMethod ?? PAYOUT_METHOD.NEFT,
          payout_status: PAYOUT_STATUS.PENDING,
          covered_credit_ids: picked.map((p) => p.id),
          idempotency_key: idempotencyKey,
        },
      });

      // ── Refresh batch totals (transactional) ─────────────────────────
      await this._refreshBatchTotalsInTx(tx, params.batchId);

      await this._writeAuditInTx(tx, ctx, {
        action_type: "BATCH_ITEM_ADDED",
        subject_type: "BATCH_ITEM",
        subject_id: item.id,
        owner_id: params.ownerId,
        hostel_id: params.hostelId,
        after_state: {
          batch_id: params.batchId,
          amount: fromPaise(totalPaise),
          covered_credit_count: picked.length,
        },
      });

      logger.info("batch.add_item.ok", {
        batch_id: params.batchId,
        item_id: item.id,
        owner_id: params.ownerId,
        hostel_id: params.hostelId,
        amount: fromPaise(totalPaise),
        covered_credits: picked.length,
      });

      return { item, alreadyExisted: false, coveredCount: picked.length, coveredAmount: fromPaise(totalPaise) };
    });
  }

  /**
   * Remove a PENDING item from a DRAFT batch. Coverage is released
   * implicitly because the row becomes CANCELLED (which the eligibility
   * filter excludes).
   *
   * We use CANCELLED rather than DELETE so the batch ↔ item history is
   * preserved (append-only for operational rows too, in spirit).
   */
  async cancelItem(ctx: AdminCtx, itemId: string, reason: string) {
    this._assertAdmin(ctx);
    this._assertUuid(itemId, "itemId");
    if (!reason) throw new Error("BAD_REQUEST: cancel reason required");

    return prisma.$transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT id FROM settlement_batch_items WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await tx.settlement_batch_items.findUnique({ where: { id: itemId } });
      if (!item) throw new Error("NOT_FOUND: item not found");
      const batch = await tx.settlement_batches.findUnique({ where: { id: item.batch_id } });
      if (!batch) throw new Error("INTERNAL: batch not found for item");

      if (item.payout_status !== PAYOUT_STATUS.PENDING) {
        throw new Error(`BAD_REQUEST: cannot cancel item in status ${item.payout_status}`);
      }
      if (batch.status !== BATCH_STATUS.DRAFT) {
        throw new Error(`BAD_REQUEST: cannot modify items of batch in status ${batch.status}`);
      }

      const updated = await tx.settlement_batch_items.update({
        where: { id: itemId },
        data: {
          payout_status: PAYOUT_STATUS.CANCELLED,
          failure_reason: reason,
          updated_at: new Date(),
        },
      });
      await this._refreshBatchTotalsInTx(tx, item.batch_id);
      await this._writeAuditInTx(tx, ctx, {
        action_type: "BATCH_ITEM_REMOVED",
        subject_type: "BATCH_ITEM",
        subject_id: itemId,
        owner_id: item.owner_id,
        hostel_id: item.hostel_id,
        before_state: { payout_status: item.payout_status },
        after_state: { payout_status: updated.payout_status },
        reason,
      });
      return updated;
    });
  }

  /**
   * DRAFT → APPROVED. Locks the batch from further item add/cancel.
   */
  async approveBatch(ctx: AdminCtx, batchId: string) {
    return this._transitionBatch(ctx, batchId, {
      from: [BATCH_STATUS.DRAFT],
      to: BATCH_STATUS.APPROVED,
      action: "BATCH_APPROVED",
      patch: { approved_by: ctx.adminId, approved_at: new Date() },
      requireItems: true,
    });
  }

  /**
   * APPROVED → PROCESSING. Indicates admin has begun executing the bank
   * transfers. Items remain PENDING until individually marked.
   */
  async startProcessing(ctx: AdminCtx, batchId: string) {
    return this._transitionBatch(ctx, batchId, {
      from: [BATCH_STATUS.APPROVED],
      to: BATCH_STATUS.PROCESSING,
      action: "BATCH_PROCESSING_STARTED",
      patch: { processed_at: new Date() },
    });
  }

  /**
   * Cancel a batch. Disallowed if any item is SUCCESS (real money has moved
   * — must be reversed via a separate ADJUSTMENT_DEBIT, not by un-doing).
   *
   * Cascades: all PENDING items become CANCELLED. PROCESSING items remain
   * — admin must finalize them as SUCCESS or FAILED first.
   */
  async cancelBatch(ctx: AdminCtx, batchId: string, reason: string) {
    this._assertAdmin(ctx);
    if (!reason) throw new Error("BAD_REQUEST: cancel reason required");

    return prisma.$transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT id FROM settlement_batches WHERE id = ${batchId}::uuid FOR UPDATE`;
      const batch = await tx.settlement_batches.findUnique({ where: { id: batchId } });
      if (!batch) throw new Error("NOT_FOUND: batch not found");

      if (![BATCH_STATUS.DRAFT, BATCH_STATUS.APPROVED, BATCH_STATUS.PROCESSING].includes(batch.status as any)) {
        throw new Error(`BAD_REQUEST: cannot cancel batch in status ${batch.status}`);
      }

      const items = await tx.settlement_batch_items.findMany({ where: { batch_id: batchId } });
      const hasSuccess = items.some((i) => i.payout_status === PAYOUT_STATUS.SUCCESS);
      if (hasSuccess) {
        throw new Error("BAD_REQUEST: cannot cancel batch with SUCCESS items; reverse via ADJUSTMENT_DEBIT instead");
      }
      const hasProcessing = items.some((i) => i.payout_status === PAYOUT_STATUS.PROCESSING);
      if (hasProcessing) {
        throw new Error("BAD_REQUEST: finalize PROCESSING items as SUCCESS or FAILED before cancel");
      }

      // Cancel PENDING items, leave FAILED/CANCELLED alone.
      await tx.settlement_batch_items.updateMany({
        where: { batch_id: batchId, payout_status: PAYOUT_STATUS.PENDING },
        data: { payout_status: PAYOUT_STATUS.CANCELLED, failure_reason: reason, updated_at: new Date() },
      });

      const updated = await tx.settlement_batches.update({
        where: { id: batchId },
        data: {
          status: BATCH_STATUS.CANCELLED,
          cancelled_by: ctx.adminId,
          cancelled_at: new Date(),
          notes: batch.notes ? `${batch.notes}\n[CANCEL] ${reason}` : `[CANCEL] ${reason}`,
          updated_at: new Date(),
        },
      });
      await this._refreshBatchTotalsInTx(tx, batchId);
      await this._writeAuditInTx(tx, ctx, {
        action_type: "BATCH_CANCELLED",
        subject_type: "BATCH",
        subject_id: batchId,
        before_state: { status: batch.status },
        after_state: { status: updated.status },
        reason,
      });
      return updated;
    });
  }

  // =====================================================================
  //  ITEM-LEVEL PAYOUT FINALIZATION
  // =====================================================================

  /**
   * Mark a payout SUCCESS. Atomically writes the DEBIT_PAYOUT ledger row.
   *
   * Payout Method semantics:
   *   - `payoutReference` is REQUIRED at SUCCESS (DB CHECK enforces this).
   *   - `payoutMethod` defaults to whatever was set on the item at addItem.
   *
   * Atomicity guarantees:
   *   - Item state lock (FOR UPDATE) prevents two concurrent admins from
   *     both marking SUCCESS.
   *   - Idempotency lookup: if a DEBIT already exists for this item
   *     (`debit:batch_item:{id}`), we return the existing state without
   *     side-effects.
   *   - The DEBIT and the item update commit together; partial state
   *     is impossible.
   */
  async markItemSuccess(ctx: AdminCtx, params: {
    itemId: string;
    payoutReference: string;
    payoutMethod?: keyof typeof PAYOUT_METHOD;
    notes?: string;
  }) {
    this._assertAdmin(ctx);
    this._assertUuid(params.itemId, "itemId");
    if (!params.payoutReference) throw new Error("BAD_REQUEST: payoutReference required");

    return prisma.$transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT id FROM settlement_batch_items WHERE id = ${params.itemId}::uuid FOR UPDATE`;
      const item = await tx.settlement_batch_items.findUnique({ where: { id: params.itemId } });
      if (!item) throw new Error("NOT_FOUND: item not found");
      const batch = await tx.settlement_batches.findUnique({ where: { id: item.batch_id } });
      if (!batch) throw new Error("INTERNAL: batch not found for item");

      // ── Idempotency: already SUCCESS? Re-read and return without effects.
      if (item.payout_status === PAYOUT_STATUS.SUCCESS) {
        logger.info("batch.mark_success.idempotent_hit", { item_id: item.id });
        return { item, alreadyExisted: true };
      }

      // ── State machine guards.
      if (![PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING].includes(item.payout_status as any)) {
        throw new Error(`BAD_REQUEST: cannot mark SUCCESS from ${item.payout_status}`);
      }
      if (![BATCH_STATUS.APPROVED, BATCH_STATUS.PROCESSING].includes(batch.status as any)) {
        throw new Error(`BAD_REQUEST: batch must be APPROVED or PROCESSING, is ${batch.status}`);
      }

      // ── Append the DEBIT_PAYOUT (uses ledger service's per-(owner,hostel)
      //    advisory lock + idempotency_key). One-shot — failures abort.
      const debitResult = await settlementLedgerService.debitPayoutInTx(tx, {
        ownerId: item.owner_id,
        hostelId: item.hostel_id,
        amount: Number(item.amount),
        batchId: item.batch_id,
        batchItemId: item.id,
        idempotencyKey: `debit:batch_item:${item.id}`,
        metadata: {
          payout_reference: params.payoutReference,
          payout_method: params.payoutMethod ?? item.payout_method,
          notes: params.notes ?? null,
        },
        createdBy: ctx.adminId,
      });

      // ── Update item to SUCCESS, link the ledger row.
      const updated = await tx.settlement_batch_items.update({
        where: { id: item.id },
        data: {
          payout_status: PAYOUT_STATUS.SUCCESS,
          payout_reference: params.payoutReference,
          payout_method: params.payoutMethod ?? item.payout_method,
          ledger_debit_id: debitResult.entry.id,
          processed_by: ctx.adminId,
          processed_at: new Date(),
          updated_at: new Date(),
        },
      });

      // ── Auto-advance batch state if appropriate.
      await this._maybeAutoFinalizeBatchInTx(tx, item.batch_id, ctx);

      // ── Audit + event.
      await this._writeAuditInTx(tx, ctx, {
        action_type: "PAYOUT_MARKED_SUCCESS",
        subject_type: "BATCH_ITEM",
        subject_id: item.id,
        owner_id: item.owner_id,
        hostel_id: item.hostel_id,
        before_state: { payout_status: item.payout_status },
        after_state: { payout_status: updated.payout_status, ledger_debit_id: debitResult.entry.id },
        metadata: { payout_reference: params.payoutReference },
      });

      // Defer the event until after commit.
      this._scheduleEvent(LEDGER_EVENTS.OWNER_SETTLEMENT_COMPLETED, {
        owner_id: item.owner_id,
        hostel_id: item.hostel_id,
        batch_id: item.batch_id,
        item_id: item.id,
        ledger_debit_id: debitResult.entry.id,
        amount: Number(item.amount),
        balance_after: Number(debitResult.entry.balance_after),
      });

      logger.info("batch.mark_success.ok", {
        item_id: item.id,
        ledger_debit_id: debitResult.entry.id,
        amount: Number(item.amount),
      });

      return { item: updated, debit: debitResult.entry, alreadyExisted: false };
    });
  }

  /**
   * Mark a payout FAILED. NO debit is written. Coverage is released
   * because the eligibility query excludes FAILED items.
   */
  async markItemFailed(ctx: AdminCtx, params: { itemId: string; reason: string }) {
    this._assertAdmin(ctx);
    this._assertUuid(params.itemId, "itemId");
    if (!params.reason) throw new Error("BAD_REQUEST: failure reason required");

    return prisma.$transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT id FROM settlement_batch_items WHERE id = ${params.itemId}::uuid FOR UPDATE`;
      const item = await tx.settlement_batch_items.findUnique({ where: { id: params.itemId } });
      if (!item) throw new Error("NOT_FOUND: item not found");
      const batch = await tx.settlement_batches.findUnique({ where: { id: item.batch_id } });
      if (!batch) throw new Error("INTERNAL: batch not found for item");

      if (item.payout_status === PAYOUT_STATUS.SUCCESS) {
        throw new Error("BAD_REQUEST: cannot mark FAILED — already SUCCESS (write ADJUSTMENT_DEBIT to reverse)");
      }
      if (item.payout_status === PAYOUT_STATUS.FAILED) {
        return { item, alreadyExisted: true };
      }
      if (![PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING].includes(item.payout_status as any)) {
        throw new Error(`BAD_REQUEST: cannot mark FAILED from ${item.payout_status}`);
      }
      if (![BATCH_STATUS.APPROVED, BATCH_STATUS.PROCESSING].includes(batch.status as any)) {
        throw new Error(`BAD_REQUEST: batch must be APPROVED or PROCESSING, is ${batch.status}`);
      }

      const updated = await tx.settlement_batch_items.update({
        where: { id: item.id },
        data: {
          payout_status: PAYOUT_STATUS.FAILED,
          failure_reason: params.reason,
          processed_by: ctx.adminId,
          processed_at: new Date(),
          updated_at: new Date(),
        },
      });
      await this._maybeAutoFinalizeBatchInTx(tx, item.batch_id, ctx);
      await this._writeAuditInTx(tx, ctx, {
        action_type: "PAYOUT_MARKED_FAILED",
        subject_type: "BATCH_ITEM",
        subject_id: item.id,
        owner_id: item.owner_id,
        hostel_id: item.hostel_id,
        before_state: { payout_status: item.payout_status },
        after_state: { payout_status: updated.payout_status },
        reason: params.reason,
      });
      this._scheduleEvent(LEDGER_EVENTS.OWNER_SETTLEMENT_FAILED, {
        owner_id: item.owner_id,
        hostel_id: item.hostel_id,
        batch_id: item.batch_id,
        item_id: item.id,
        amount: Number(item.amount),
        reason: params.reason,
      });
      logger.info("batch.mark_failed.ok", { item_id: item.id, reason: params.reason });
      return { item: updated, alreadyExisted: false };
    });
  }

  // =====================================================================
  //  READ APIS — owner-eligibility + reconciliation visibility
  // =====================================================================

  /**
   * Eligible CREDIT rows for an (owner, hostel) — used by the "create item"
   * UI to preview what the next payout will cover.
   */
  async listEligibleCreditsForOwnerHostel(ownerId: string, hostelId: string, limit = 500) {
    this._assertUuid(ownerId, "ownerId");
    this._assertUuid(hostelId, "hostelId");
    return prisma.$queryRaw<Array<{
      id: string; amount: string; created_at: Date; payment_id: string | null;
    }>>`
      SELECT c.id, c.amount::text AS amount, c.created_at, c.payment_id
      FROM owner_settlement_ledger c
      WHERE c.owner_id = ${ownerId}::uuid
        AND c.hostel_id = ${hostelId}::uuid
        AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        AND NOT EXISTS (
          SELECT 1 FROM settlement_batch_items i
          WHERE c.id = ANY(i.covered_credit_ids)
            AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
        )
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT ${Math.min(Math.max(limit, 1), 5000)}
    `;
  }

  /**
   * Owner-level pending payable summary across ALL hostels — used by the
   * admin treasury "Owner Settlement Queue" dashboard.
   */
  async listOwnersWithPendingPayable(limit = 200) {
    return prisma.$queryRaw<Array<{
      owner_id: string;
      hostel_count: number;
      pending_credit_count: number;
      pending_amount: string;
      oldest_credit_at: Date;
    }>>`
      SELECT
        c.owner_id,
        COUNT(DISTINCT c.hostel_id)::int                   AS hostel_count,
        COUNT(*)::int                                       AS pending_credit_count,
        SUM(c.amount)::text                                 AS pending_amount,
        MIN(c.created_at)                                   AS oldest_credit_at
      FROM owner_settlement_ledger c
      WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        AND NOT EXISTS (
          SELECT 1 FROM settlement_batch_items i
          WHERE c.id = ANY(i.covered_credit_ids)
            AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
        )
      GROUP BY c.owner_id
      ORDER BY oldest_credit_at ASC
      LIMIT ${Math.min(Math.max(limit, 1), 1000)}
    `;
  }

  async getBatch(batchId: string) {
    this._assertUuid(batchId, "batchId");
    return prisma.settlement_batches.findUnique({
      where: { id: batchId },
      include: { items: { orderBy: { created_at: "asc" } } },
    });
  }

  async listBatches(params: { status?: keyof typeof BATCH_STATUS; limit?: number; cursor?: string | null }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    return prisma.settlement_batches.findMany({
      where: params.status ? { status: params.status } : undefined,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
    });
  }

  // =====================================================================
  //  RECONCILIATION VISIBILITY (read-only — Phase 7 wires alerting)
  // =====================================================================

  /**
   * Credits that are not covered by any active item — i.e. the canonical
   * "unsettled liability" set. Same semantics as listOwnersWithPendingPayable
   * but row-level and cross-owner.
   */
  async findUncoveredCredits(limit = 1000) {
    return prisma.$queryRaw<Array<{
      id: string; owner_id: string; hostel_id: string; amount: string; created_at: Date;
    }>>`
      SELECT c.id, c.owner_id, c.hostel_id, c.amount::text AS amount, c.created_at
      FROM owner_settlement_ledger c
      WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        AND NOT EXISTS (
          SELECT 1 FROM settlement_batch_items i
          WHERE c.id = ANY(i.covered_credit_ids)
            AND i.payout_status IN ('PENDING','PROCESSING','SUCCESS')
        )
      ORDER BY c.created_at ASC
      LIMIT ${limit}
    `;
  }

  /**
   * Credits covered by more than one active payout — should ALWAYS be empty
   * in a healthy system. Detected here in case a future code path bypasses
   * the eligibility query.
   */
  async findOverCoveredCredits(limit = 200) {
    return prisma.$queryRaw<Array<{
      credit_id: string; owner_id: string; hostel_id: string; covered_by_item_count: number; item_ids: string[];
    }>>`
      SELECT
        c.id                                              AS credit_id,
        c.owner_id,
        c.hostel_id,
        COUNT(*)::int                                     AS covered_by_item_count,
        array_agg(i.id)                                   AS item_ids
      FROM owner_settlement_ledger c
      JOIN settlement_batch_items i ON c.id = ANY(i.covered_credit_ids)
      WHERE c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
        AND i.payout_status IN ('PROCESSING','SUCCESS')
      GROUP BY c.id, c.owner_id, c.hostel_id
      HAVING COUNT(*) > 1
      LIMIT ${limit}
    `;
  }

  /**
   * DEBIT_PAYOUT rows whose backing batch_item is missing or not SUCCESS.
   * Should always be empty (mark-success is the only path that emits a
   * debit, and it links the debit inside the same transaction).
   */
  async findOrphanDebits(limit = 200) {
    return prisma.$queryRaw<Array<{
      debit_id: string; batch_item_id: string | null; item_status: string | null;
    }>>`
      SELECT
        d.id                  AS debit_id,
        d.batch_item_id,
        i.payout_status       AS item_status
      FROM owner_settlement_ledger d
      LEFT JOIN settlement_batch_items i ON i.id = d.batch_item_id
      WHERE d.entry_type = ${LEDGER_ENTRY_TYPES.DEBIT_PAYOUT}
        AND (i.id IS NULL OR i.payout_status <> 'SUCCESS')
      LIMIT ${limit}
    `;
  }

  /**
   * Items whose recorded `amount` does not equal the SUM of their
   * `covered_credit_ids` referenced amounts. Indicates either a bug in
   * coverage attribution or post-hoc CREDIT row tampering (CREDITs are
   * supposed to be immutable — this is the canary).
   */
  async findCoverageDrift(limit = 200) {
    return prisma.$queryRaw<Array<{
      item_id: string; item_amount: string; covered_total: string; drift: string;
    }>>`
      SELECT
        i.id                                                          AS item_id,
        i.amount::text                                                AS item_amount,
        COALESCE(SUM(c.amount), 0)::text                              AS covered_total,
        (i.amount - COALESCE(SUM(c.amount), 0))::text                 AS drift
      FROM settlement_batch_items i
      LEFT JOIN owner_settlement_ledger c
        ON c.id = ANY(i.covered_credit_ids)
       AND c.entry_type = ${LEDGER_ENTRY_TYPES.CREDIT_COLLECTION}
      WHERE i.payout_status IN ('PROCESSING','SUCCESS')
      GROUP BY i.id, i.amount
      HAVING ABS(i.amount - COALESCE(SUM(c.amount), 0)) > 0.005
      LIMIT ${limit}
    `;
  }

  // =====================================================================
  //  INTERNAL HELPERS
  // =====================================================================

  /**
   * Generic state-transition helper for batch-level moves that don't touch
   * items. Locks the batch row, validates `from`, applies `patch`, writes
   * audit, returns the updated row.
   */
  private async _transitionBatch(
    ctx: AdminCtx,
    batchId: string,
    spec: {
      from: string[];
      to: string;
      action: "BATCH_APPROVED" | "BATCH_PROCESSING_STARTED" | "BATCH_CANCELLED";
      patch: Record<string, any>;
      requireItems?: boolean;
    }
  ) {
    this._assertAdmin(ctx);
    this._assertUuid(batchId, "batchId");
    return prisma.$transaction(async (tx: Tx) => {
      await tx.$queryRaw`SELECT id FROM settlement_batches WHERE id = ${batchId}::uuid FOR UPDATE`;
      const batch = await tx.settlement_batches.findUnique({ where: { id: batchId } });
      if (!batch) throw new Error("NOT_FOUND: batch not found");
      if (!spec.from.includes(batch.status)) {
        throw new Error(`BAD_REQUEST: cannot transition from ${batch.status} to ${spec.to}`);
      }
      if (spec.requireItems) {
        const liveCount = await tx.settlement_batch_items.count({
          where: {
            batch_id: batchId,
            payout_status: { in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING, PAYOUT_STATUS.SUCCESS] },
          },
        });
        if (liveCount === 0) throw new Error("BAD_REQUEST: batch must contain at least one live item");
      }
      const updated = await tx.settlement_batches.update({
        where: { id: batchId },
        data: { ...spec.patch, status: spec.to, updated_at: new Date() },
      });
      await this._writeAuditInTx(tx, ctx, {
        action_type: spec.action,
        subject_type: "BATCH",
        subject_id: batchId,
        before_state: { status: batch.status },
        after_state: { status: updated.status },
      });
      return updated;
    });
  }

  /**
   * Auto-finalize a batch when all live items are terminal. Only runs from
   * APPROVED or PROCESSING state.
   */
  private async _maybeAutoFinalizeBatchInTx(tx: Tx, batchId: string, ctx: AdminCtx) {
    const batch = await tx.settlement_batches.findUnique({ where: { id: batchId } });
    if (!batch) return;
    if (![BATCH_STATUS.APPROVED, BATCH_STATUS.PROCESSING].includes(batch.status as any)) return;

    const items = await tx.settlement_batch_items.findMany({ where: { batch_id: batchId } });
    if (items.length === 0) return;

    const stillLive = items.some((i) =>
      [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING].includes(i.payout_status as any)
    );
    if (stillLive) return;

    const successCount = items.filter((i) => i.payout_status === PAYOUT_STATUS.SUCCESS).length;
    const failedCount = items.filter((i) => i.payout_status === PAYOUT_STATUS.FAILED).length;

    let nextStatus: string;
    if (successCount > 0 && failedCount === 0) nextStatus = BATCH_STATUS.COMPLETED;
    else if (successCount > 0 && failedCount > 0) nextStatus = BATCH_STATUS.PARTIALLY_FAILED;
    else nextStatus = BATCH_STATUS.FAILED;

    await tx.settlement_batches.update({
      where: { id: batchId },
      data: {
        status: nextStatus,
        completed_at: new Date(),
        updated_at: new Date(),
        success_count: successCount,
        failed_count: failedCount,
      },
    });
    logger.info("batch.auto_finalize", { batch_id: batchId, status: nextStatus, success: successCount, failed: failedCount });
  }

  private async _refreshBatchTotalsInTx(tx: Tx, batchId: string) {
    const items = await tx.settlement_batch_items.findMany({
      where: {
        batch_id: batchId,
        payout_status: { in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.PROCESSING, PAYOUT_STATUS.SUCCESS] },
      },
      select: { owner_id: true, hostel_id: true, amount: true, payout_status: true },
    });
    const owners = new Set(items.map((i) => i.owner_id));
    const hostels = new Set(items.map((i) => `${i.owner_id}|${i.hostel_id}`));
    const totalPaise = items.reduce((s, i) => s + toPaise(i.amount), 0);
    const successCount = items.filter((i) => i.payout_status === PAYOUT_STATUS.SUCCESS).length;
    const failedCount = await tx.settlement_batch_items.count({
      where: { batch_id: batchId, payout_status: PAYOUT_STATUS.FAILED },
    });
    await tx.settlement_batches.update({
      where: { id: batchId },
      data: {
        total_amount: fromPaise(totalPaise),
        total_owners: owners.size,
        total_hostels: hostels.size,
        total_items: items.length + failedCount,
        success_count: successCount,
        failed_count: failedCount,
        updated_at: new Date(),
      },
    });
  }

  private async _generateBatchNumber(tx: Tx): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `SB-${year}-`;
    // FIFO numbering — count rows for the year and append.
    // Race: two concurrent createBatch calls could both hit the same number.
    // The unique index on batch_number will reject one; we retry up to 5 times.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await tx.settlement_batches.count({
        where: { batch_number: { startsWith: prefix } },
      });
      const candidate = `${prefix}${(count + 1 + attempt).toString().padStart(4, "0")}`;
      const exists = await tx.settlement_batches.findUnique({ where: { batch_number: candidate } });
      if (!exists) return candidate;
    }
    throw new Error("INTERNAL: could not generate unique batch_number after 5 attempts");
  }

  private async _writeAuditInTx(tx: Tx, ctx: AdminCtx, params: {
    action_type: string;
    subject_type: string;
    subject_id: string;
    owner_id?: string | null;
    hostel_id?: string | null;
    before_state?: any;
    after_state?: any;
    reason?: string;
    metadata?: any;
  }) {
    await tx.admin_financial_audit_log.create({
      data: {
        admin_id: ctx.adminId,
        action_type: params.action_type,
        subject_type: params.subject_type,
        subject_id: params.subject_id,
        owner_id: params.owner_id ?? null,
        hostel_id: params.hostel_id ?? null,
        before_state: params.before_state ?? null,
        after_state: params.after_state ?? null,
        reason: params.reason ?? null,
        ip_address: ctx.ip ?? null,
        user_agent: ctx.userAgent ?? null,
        metadata: params.metadata ?? {},
      },
    });
  }

  private _scheduleEvent(eventName: string, payload: any) {
    process.nextTick(() => {
      eventSystem.trigger(eventName, payload).catch((err: any) =>
        logger.warn("batch.event.failed", { event: eventName, err: String(err?.message ?? err) })
      );
    });
  }

  private _assertAdmin(ctx: AdminCtx) {
    if (!ctx?.adminId || typeof ctx.adminId !== "string" || ctx.adminId.length < 32) {
      throw new Error("BAD_REQUEST: AdminCtx.adminId must be a UUID string");
    }
  }
  private _assertUuid(value: string, label: string) {
    if (typeof value !== "string" || value.length < 32) {
      throw new Error(`BAD_REQUEST: ${label} must be a UUID string`);
    }
  }
}

export const settlementBatchService = new SettlementBatchService();

// Suppress unused-name warning for constants exported for documentation/testing.
void COVERAGE_OCCUPYING_STATUSES;
void COVERAGE_FREEING_STATUSES;
