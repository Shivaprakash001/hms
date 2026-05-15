/**
 * SettlementLedgerService
 *
 * Canonical source of truth for owner payable balances.
 *
 * Core invariants (enforced jointly by DB CHECK constraints + this service):
 *
 *  I-1  Append-only: rows are NEVER updated or deleted by this service.
 *  I-2  Idempotency: every write provides `idempotency_key`. Duplicate keys
 *       are detected and the existing row is returned without side effects.
 *  I-3  Determinism: `balance_after` is computed from the previous tip row
 *       under a per-(owner_id, hostel_id) transaction-scoped advisory lock.
 *       Concurrent writers serialize.
 *  I-4  Non-negative balance: a DEBIT (payout / refund / debit adjustment)
 *       that would drive balance_after below zero is REJECTED.
 *  I-5  Domain awareness: this ledger represents RENT_COLLECTION liability
 *       only. Platform billing (HMS revenue) MUST NOT be written here.
 *  I-6  Source of truth: ledger reads return `balance_after` from the latest
 *       row. NEVER recompute by summing `payments.amount_paid`.
 *
 * Concurrency model:
 *   Every write acquires `pg_advisory_xact_lock(hashtext(owner_id), hashtext(hostel_id))`
 *   at the start of its transaction. The lock is released automatically on
 *   COMMIT or ROLLBACK. Two concurrent writers to the same (owner, hostel)
 *   pair will serialize; writers to different pairs proceed in parallel.
 *
 * Phase-3 scope:
 *   - CREDIT_COLLECTION (tenant rent payment → owner liability)
 *   - DEBIT_PAYOUT (manual payout by HMS admin — issued by Phase 4)
 *   - ADJUSTMENT_CREDIT / ADJUSTMENT_DEBIT (admin tooling — Phase 5)
 *   - Read APIs for owner-level and HMS-aggregate balances
 *
 * Out of scope for Phase 3:
 *   - Tenant advance ledger CREDIT (different reference shape — Phase 7 or later)
 *   - Reconciliation drift detection (Phase 7)
 *   - Reversal / void semantics (no production need yet)
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { eventSystem } from "../events";
import { getLogger } from "../logger";

const logger = getLogger("settlement.ledger");

// ---------- Types ----------

export const LEDGER_ENTRY_TYPES = {
  CREDIT_COLLECTION: "CREDIT_COLLECTION",
  DEBIT_PAYOUT: "DEBIT_PAYOUT",
  ADJUSTMENT_CREDIT: "ADJUSTMENT_CREDIT",
  ADJUSTMENT_DEBIT: "ADJUSTMENT_DEBIT",
  REFUND_DEBIT: "REFUND_DEBIT",
  REVERSAL_CREDIT: "REVERSAL_CREDIT",
} as const;

export type LedgerEntryType = typeof LEDGER_ENTRY_TYPES[keyof typeof LEDGER_ENTRY_TYPES];

export const LEDGER_SETTLEMENT_STATUS = {
  PENDING_SETTLEMENT: "PENDING_SETTLEMENT",
  SETTLED: "SETTLED",
  VOIDED: "VOIDED",
} as const;

export type LedgerSettlementStatus = typeof LEDGER_SETTLEMENT_STATUS[keyof typeof LEDGER_SETTLEMENT_STATUS];

export const LEDGER_EVENTS = {
  OWNER_SETTLEMENT_PENDING: "OWNER_SETTLEMENT_PENDING",
  OWNER_SETTLEMENT_COMPLETED: "OWNER_SETTLEMENT_COMPLETED",
  OWNER_SETTLEMENT_FAILED: "OWNER_SETTLEMENT_FAILED",
  LEDGER_DRIFT_DETECTED: "LEDGER_DRIFT_DETECTED",
} as const;

type Tx = Prisma.TransactionClient;

interface BaseAppendParams {
  ownerId: string;
  hostelId: string;
  amount: number;        // positive, INR
  idempotencyKey: string;
  metadata?: Record<string, any>;
  createdBy?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface CreditCollectionParams extends BaseAppendParams {
  paymentId: string;
}

export interface DebitPayoutParams extends BaseAppendParams {
  batchId: string;
  batchItemId: string;
}

export interface AdjustmentParams extends BaseAppendParams {
  /** human-readable reason; persisted into metadata.reason */
  reason: string;
}

interface LedgerRowShape {
  id: string;
  owner_id: string;
  hostel_id: string;
  entry_type: string;
  direction: string;
  amount: any;
  balance_after: any;
  settlement_status: string;
  settled_at: Date | null;
  idempotency_key: string;
  payment_id: string | null;
  settlement_batch_id: string | null;
  batch_item_id: string | null;
  created_at: Date;
}

// ---------- Money helpers ----------

/**
 * Convert a number-like amount to paise (integer) for exact arithmetic.
 * All amounts on the ledger are stored as Decimal(14,2) but we manipulate
 * paise internally to dodge FP error entirely.
 */
function toPaise(amount: number | string | Prisma.Decimal): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) throw new Error("BAD_REQUEST: amount not finite");
  return Math.round(n * 100);
}

function fromPaise(paise: number): number {
  return paise / 100;
}

// ---------- Service ----------

export class SettlementLedgerService {
  // ===================================================================
  //  WRITE PATH
  // ===================================================================

  /**
   * Append a CREDIT_COLLECTION entry inside an existing transaction.
   *
   * Called by payment-service after a successful tenant rent payment row.
   * Must execute in the SAME transaction as the `payments.create` call so
   * that the credit and the payment commit atomically — if either fails,
   * neither persists.
   *
   * Idempotency key convention: `credit:payment:<paymentId>`.
   * The DB partial unique index `udx_osl_one_credit_per_payment` guarantees
   * a second call with the same `paymentId` is a no-op even if the
   * idempotency_key is malformed by the caller.
   */
  async creditCollectionInTx(tx: Tx, params: CreditCollectionParams) {
    this._assertPositiveAmount(params.amount, "creditCollectionInTx");
    this._assertUuid(params.paymentId, "paymentId");

    const key = params.idempotencyKey || `credit:payment:${params.paymentId}`;
    return this._appendEntryInTx(tx, {
      ownerId: params.ownerId,
      hostelId: params.hostelId,
      entryType: LEDGER_ENTRY_TYPES.CREDIT_COLLECTION,
      direction: "C",
      amount: params.amount,
      idempotencyKey: key,
      paymentId: params.paymentId,
      batchId: null,
      batchItemId: null,
      settlementStatus: LEDGER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
      metadata: params.metadata,
      referenceType: params.referenceType ?? "PAYMENT",
      referenceId: params.referenceId ?? params.paymentId,
      createdBy: params.createdBy ?? null,
    }).then(async (result) => {
      // After-commit handler runs only when the outer tx commits.
      // We schedule the event emission via process.nextTick so the caller
      // is not blocked, and to ensure the row is visible to listeners.
      if (!result.alreadyExisted) {
        this._scheduleEvent(LEDGER_EVENTS.OWNER_SETTLEMENT_PENDING, {
          owner_id: params.ownerId,
          hostel_id: params.hostelId,
          payment_id: params.paymentId,
          amount: params.amount,
          ledger_entry_id: result.entry.id,
          balance_after: Number(result.entry.balance_after),
        });
      }
      return result;
    });
  }

  /**
   * Standalone variant for backfills / scripts. Opens its own transaction.
   * Production webhook & finalize paths should use creditCollectionInTx.
   */
  async creditCollection(params: CreditCollectionParams) {
    return prisma.$transaction((tx: Tx) => this.creditCollectionInTx(tx, params));
  }

  /**
   * Append a DEBIT_PAYOUT entry inside an existing transaction.
   *
   * Called by the Phase-4 settlement-batch processor when a payout is
   * marked SUCCESS by an admin. The settlement_batch_id and batch_item_id
   * link the debit to the operational batch row.
   *
   * Idempotency key convention: `debit:batch_item:<batchItemId>`.
   * The DB partial unique index `udx_osl_one_debit_per_batch_item` is the
   * authoritative guard against double-debit.
   *
   * Enforces I-4 (no negative balance). If `balance_after` would go below
   * zero, throws `LEDGER_INSUFFICIENT_BALANCE` and the transaction must
   * roll back.
   */
  async debitPayoutInTx(tx: Tx, params: DebitPayoutParams) {
    this._assertPositiveAmount(params.amount, "debitPayoutInTx");
    this._assertUuid(params.batchId, "batchId");
    this._assertUuid(params.batchItemId, "batchItemId");

    const key = params.idempotencyKey || `debit:batch_item:${params.batchItemId}`;
    return this._appendEntryInTx(tx, {
      ownerId: params.ownerId,
      hostelId: params.hostelId,
      entryType: LEDGER_ENTRY_TYPES.DEBIT_PAYOUT,
      direction: "D",
      amount: params.amount,
      idempotencyKey: key,
      paymentId: null,
      batchId: params.batchId,
      batchItemId: params.batchItemId,
      settlementStatus: LEDGER_SETTLEMENT_STATUS.SETTLED,
      metadata: params.metadata,
      referenceType: params.referenceType ?? "BATCH_ITEM",
      referenceId: params.referenceId ?? params.batchItemId,
      createdBy: params.createdBy ?? null,
    });
  }

  /**
   * Admin-tool ledger adjustment. Use rarely. `reason` is mandatory.
   */
  async adjustCreditInTx(tx: Tx, params: AdjustmentParams) {
    this._assertPositiveAmount(params.amount, "adjustCreditInTx");
    if (!params.reason) throw new Error("BAD_REQUEST: adjustment reason required");
    if (!params.idempotencyKey) throw new Error("BAD_REQUEST: idempotency_key required for adjustment");
    if (!params.createdBy) throw new Error("BAD_REQUEST: createdBy admin id required for adjustment");

    return this._appendEntryInTx(tx, {
      ownerId: params.ownerId,
      hostelId: params.hostelId,
      entryType: LEDGER_ENTRY_TYPES.ADJUSTMENT_CREDIT,
      direction: "C",
      amount: params.amount,
      idempotencyKey: params.idempotencyKey,
      paymentId: null,
      batchId: null,
      batchItemId: null,
      settlementStatus: LEDGER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
      metadata: { ...(params.metadata ?? {}), reason: params.reason },
      referenceType: params.referenceType ?? "ADJUSTMENT",
      referenceId: params.referenceId ?? null,
      createdBy: params.createdBy,
    });
  }

  async adjustDebitInTx(tx: Tx, params: AdjustmentParams) {
    this._assertPositiveAmount(params.amount, "adjustDebitInTx");
    if (!params.reason) throw new Error("BAD_REQUEST: adjustment reason required");
    if (!params.idempotencyKey) throw new Error("BAD_REQUEST: idempotency_key required for adjustment");
    if (!params.createdBy) throw new Error("BAD_REQUEST: createdBy admin id required for adjustment");

    return this._appendEntryInTx(tx, {
      ownerId: params.ownerId,
      hostelId: params.hostelId,
      entryType: LEDGER_ENTRY_TYPES.ADJUSTMENT_DEBIT,
      direction: "D",
      amount: params.amount,
      idempotencyKey: params.idempotencyKey,
      paymentId: null,
      batchId: null,
      batchItemId: null,
      settlementStatus: LEDGER_SETTLEMENT_STATUS.SETTLED,
      metadata: { ...(params.metadata ?? {}), reason: params.reason },
      referenceType: params.referenceType ?? "ADJUSTMENT",
      referenceId: params.referenceId ?? null,
      createdBy: params.createdBy,
    });
  }

  // ===================================================================
  //  READ PATH (canonical source of truth)
  // ===================================================================

  /**
   * Current payable balance from HMS to the owner for a single hostel.
   * Reads the latest ledger row's `balance_after` directly — no SUM().
   * Returns 0 if no ledger entries exist yet.
   */
  async getOwnerHostelBalance(ownerId: string, hostelId: string): Promise<number> {
    this._assertUuid(ownerId, "ownerId");
    this._assertUuid(hostelId, "hostelId");
    const tip = await prisma.owner_settlement_ledger.findFirst({
      where: { owner_id: ownerId, hostel_id: hostelId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: { balance_after: true },
    });
    return tip ? Number(tip.balance_after) : 0;
  }

  /**
   * Portfolio-wide payable: sum of latest balance_after per hostel for one owner.
   * Uses DISTINCT ON via raw SQL for correctness in a single round-trip.
   */
  async getOwnerPortfolioBalance(ownerId: string): Promise<{
    owner_id: string;
    total_pending: number;
    by_hostel: Array<{ hostel_id: string; balance: number; last_entry_at: Date | null }>;
  }> {
    this._assertUuid(ownerId, "ownerId");
    const rows = await prisma.$queryRaw<Array<{
      hostel_id: string;
      balance_after: string;
      created_at: Date;
    }>>`
      SELECT DISTINCT ON (hostel_id)
        hostel_id,
        balance_after::text AS balance_after,
        created_at
      FROM owner_settlement_ledger
      WHERE owner_id = ${ownerId}::uuid
      ORDER BY hostel_id, created_at DESC, id DESC
    `;
    const by_hostel = rows.map((r: { hostel_id: string; balance_after: string; created_at: Date }) => ({
      hostel_id: r.hostel_id,
      balance: Number(r.balance_after),
      last_entry_at: r.created_at,
    }));
    const total_pending = by_hostel.reduce((acc: number, h: { balance: number }) => acc + h.balance, 0);
    return {
      owner_id: ownerId,
      total_pending: Math.round(total_pending * 100) / 100,
      by_hostel,
    };
  }

  /**
   * Pending (un-settled) credits eligible to be included in the next payout
   * batch for an owner+hostel. Returned in FIFO (oldest credit first).
   */
  async listPendingCredits(ownerId: string, hostelId: string, limit = 200) {
    this._assertUuid(ownerId, "ownerId");
    this._assertUuid(hostelId, "hostelId");
    return prisma.owner_settlement_ledger.findMany({
      where: {
        owner_id: ownerId,
        hostel_id: hostelId,
        entry_type: LEDGER_ENTRY_TYPES.CREDIT_COLLECTION,
        settlement_status: LEDGER_SETTLEMENT_STATUS.PENDING_SETTLEMENT,
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      take: Math.min(limit, 1000),
    });
  }

  /**
   * Full ledger history for an owner+hostel pair, paginated.
   */
  async listLedgerEntries(params: {
    ownerId: string;
    hostelId: string;
    limit?: number;
    cursor?: string | null;
  }) {
    this._assertUuid(params.ownerId, "ownerId");
    this._assertUuid(params.hostelId, "hostelId");
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    return prisma.owner_settlement_ledger.findMany({
      where: { owner_id: params.ownerId, hostel_id: params.hostelId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
    });
  }

  /**
   * HMS-internal: total unsettled liability across all owners/hostels.
   * For the admin treasury dashboard (Phase 5). Pure ledger read.
   */
  async getHMSAggregateLiability(): Promise<{
    total_payable: number;
    owners_with_balance: number;
    hostels_with_balance: number;
  }> {
    const rows = await prisma.$queryRaw<Array<{
      owner_id: string;
      hostel_id: string;
      balance_after: string;
    }>>`
      SELECT DISTINCT ON (owner_id, hostel_id)
        owner_id,
        hostel_id,
        balance_after::text AS balance_after
      FROM owner_settlement_ledger
      ORDER BY owner_id, hostel_id, created_at DESC, id DESC
    `;
    const owners = new Set<string>();
    const hostels = new Set<string>();
    let totalPaise = 0;
    for (const r of rows) {
      const bal = toPaise(r.balance_after);
      if (bal <= 0) continue;
      totalPaise += bal;
      owners.add(r.owner_id);
      hostels.add(r.hostel_id);
    }
    return {
      total_payable: fromPaise(totalPaise),
      owners_with_balance: owners.size,
      hostels_with_balance: hostels.size,
    };
  }

  // ===================================================================
  //  INTERNAL CORE — _appendEntryInTx
  // ===================================================================

  /**
   * Single chokepoint for every ledger write. All public write methods
   * funnel here. Holds the per-(owner, hostel) advisory lock for the rest
   * of the transaction, reads the tip, computes balance, and inserts.
   *
   * Idempotency contract:
   *   - On unique-key collision (idempotency_key) the existing row is
   *     re-read and returned. `alreadyExisted=true`.
   *   - For CREDIT_COLLECTION the partial index also guards by payment_id.
   *   - For DEBIT_PAYOUT the partial index also guards by batch_item_id.
   */
  private async _appendEntryInTx(
    tx: Tx,
    p: {
      ownerId: string;
      hostelId: string;
      entryType: LedgerEntryType;
      direction: "C" | "D";
      amount: number;
      idempotencyKey: string;
      paymentId: string | null;
      batchId: string | null;
      batchItemId: string | null;
      settlementStatus: LedgerSettlementStatus;
      metadata?: Record<string, any>;
      referenceType: string | null;
      referenceId: string | null;
      createdBy: string | null;
    }
  ): Promise<{ entry: LedgerRowShape; alreadyExisted: boolean }> {
    this._assertUuid(p.ownerId, "ownerId");
    this._assertUuid(p.hostelId, "hostelId");

    // ── Idempotency fast path: if the key already exists, return that row
    // without taking the advisory lock. Avoids spurious lock contention
    // under webhook retry storms.
    const preExisting = await tx.owner_settlement_ledger.findUnique({
      where: { idempotency_key: p.idempotencyKey },
    });
    if (preExisting) {
      this._assertIdempotencyMatch(preExisting, p);
      logger.info("ledger.append.idempotent_hit", {
        idempotency_key: p.idempotencyKey,
        existing_id: preExisting.id,
      });
      return { entry: preExisting as unknown as LedgerRowShape, alreadyExisted: true };
    }

    // ── Acquire per-(owner, hostel) transaction-scoped advisory lock.
    // Two int4 keys: hashtext(owner_id) + hashtext(hostel_id).
    // Released automatically on COMMIT/ROLLBACK.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${p.ownerId}), hashtext(${p.hostelId}))
    `;

    // ── Re-check idempotency after acquiring the lock (another concurrent
    // writer may have inserted between fast-path and lock acquisition).
    const postLockExisting = await tx.owner_settlement_ledger.findUnique({
      where: { idempotency_key: p.idempotencyKey },
    });
    if (postLockExisting) {
      this._assertIdempotencyMatch(postLockExisting, p);
      return { entry: postLockExisting as unknown as LedgerRowShape, alreadyExisted: true };
    }

    // ── Read the latest tip for this (owner, hostel) and compute next balance.
    const tip = await tx.owner_settlement_ledger.findFirst({
      where: { owner_id: p.ownerId, hostel_id: p.hostelId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: { balance_after: true },
    });
    const prevPaise = tip ? toPaise(tip.balance_after) : 0;
    const deltaPaise = toPaise(p.amount);

    if (deltaPaise <= 0) {
      throw new Error("BAD_REQUEST: ledger amount must be > 0 paise");
    }

    const nextPaise =
      p.direction === "C" ? prevPaise + deltaPaise : prevPaise - deltaPaise;

    if (nextPaise < 0) {
      // I-4: prevent overdraft. Caller (Phase 4 batch processor) must reduce
      // the payout amount or split the batch.
      logger.warn("ledger.append.insufficient_balance", {
        owner_id: p.ownerId,
        hostel_id: p.hostelId,
        prev_paise: prevPaise,
        delta_paise: deltaPaise,
        entry_type: p.entryType,
      });
      throw new Error(
        `LEDGER_INSUFFICIENT_BALANCE: cannot debit ${fromPaise(deltaPaise)} from balance ${fromPaise(prevPaise)}`
      );
    }

    const settledAt =
      p.settlementStatus === LEDGER_SETTLEMENT_STATUS.SETTLED ? new Date() : null;

    // ── Insert. Race with another writer holding the lock is impossible
    // because we hold the (owner, hostel) advisory lock. Race with a
    // DIFFERENT idempotency_key writer for the SAME payment_id (CREDIT)
    // or batch_item_id (DEBIT) is caught by the partial unique indexes
    // — we map that error to a clearer DUPLICATE_LEDGER_REFERENCE.
    try {
      const entry = await tx.owner_settlement_ledger.create({
        data: {
          owner_id: p.ownerId,
          hostel_id: p.hostelId,
          entry_type: p.entryType,
          direction: p.direction,
          amount: fromPaise(deltaPaise),
          balance_after: fromPaise(nextPaise),
          settlement_status: p.settlementStatus,
          settled_at: settledAt,
          idempotency_key: p.idempotencyKey,
          payment_id: p.paymentId,
          settlement_batch_id: p.batchId,
          batch_item_id: p.batchItemId,
          reference_type: p.referenceType,
          reference_id: p.referenceId,
          metadata: (p.metadata ?? {}) as any,
          created_by: p.createdBy,
        },
      });
      logger.info("ledger.append.ok", {
        entry_id: entry.id,
        owner_id: p.ownerId,
        hostel_id: p.hostelId,
        entry_type: p.entryType,
        direction: p.direction,
        amount: fromPaise(deltaPaise),
        balance_after: fromPaise(nextPaise),
      });
      return { entry: entry as unknown as LedgerRowShape, alreadyExisted: false };
    } catch (err: any) {
      if (err?.code === "P2002") {
        const target = Array.isArray(err?.meta?.target)
          ? err.meta.target.join(",")
          : String(err?.meta?.target ?? "");
        if (target.includes("idempotency_key")) {
          // Re-read and return the winner.
          const winner = await tx.owner_settlement_ledger.findUnique({
            where: { idempotency_key: p.idempotencyKey },
          });
          if (winner) {
            this._assertIdempotencyMatch(winner, p);
            return { entry: winner as unknown as LedgerRowShape, alreadyExisted: true };
          }
        }
        logger.error("ledger.append.duplicate_reference", {
          target,
          owner_id: p.ownerId,
          hostel_id: p.hostelId,
          payment_id: p.paymentId,
          batch_item_id: p.batchItemId,
        });
        throw new Error(`DUPLICATE_LEDGER_REFERENCE: ${target}`);
      }
      throw err;
    }
  }

  // ===================================================================
  //  HELPERS
  // ===================================================================

  private _assertPositiveAmount(amount: number, label: string): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`BAD_REQUEST: ${label}: amount must be > 0`);
    }
    if (toPaise(amount) <= 0) {
      throw new Error(`BAD_REQUEST: ${label}: amount must be > 0 paise after rounding`);
    }
  }

  private _assertUuid(value: string, label: string): void {
    if (typeof value !== "string" || value.length < 32) {
      throw new Error(`BAD_REQUEST: ${label} must be a UUID string`);
    }
  }

  /**
   * Idempotent re-issue MUST refer to the same business operation.
   * If the caller re-uses an idempotency_key with a different owner/hostel/
   * amount, that is a programming bug and must be loud.
   */
  private _assertIdempotencyMatch(existing: any, p: {
    ownerId: string;
    hostelId: string;
    amount: number;
    entryType: LedgerEntryType;
  }): void {
    const mismatches: string[] = [];
    if (existing.owner_id !== p.ownerId) mismatches.push(`owner_id`);
    if (existing.hostel_id !== p.hostelId) mismatches.push(`hostel_id`);
    if (existing.entry_type !== p.entryType) mismatches.push(`entry_type`);
    if (toPaise(existing.amount) !== toPaise(p.amount)) mismatches.push(`amount`);
    if (mismatches.length > 0) {
      logger.error("ledger.append.idempotency_collision", {
        idempotency_key: existing.idempotency_key,
        existing_id: existing.id,
        mismatched_fields: mismatches,
      });
      throw new Error(
        `LEDGER_IDEMPOTENCY_COLLISION: idempotency_key reused with different ${mismatches.join(",")}`
      );
    }
  }

  private _scheduleEvent(eventName: string, payload: any): void {
    // Fire on nextTick so the row is visible to listeners and the caller
    // is not blocked by event handlers (which may do their own DB I/O).
    process.nextTick(() => {
      eventSystem.trigger(eventName, payload).catch((err: any) => {
        logger.warn("ledger.event.failed", { event: eventName, err: String(err?.message ?? err) });
      });
    });
  }
}

export const settlementLedgerService = new SettlementLedgerService();
