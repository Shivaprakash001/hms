import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { eventSystem } from "@/lib/events";
import { PaymentProviderFactory } from "./provider-factory";
import crypto from "crypto";
import { EmailService } from "@/lib/services/email-service";
import { receiptService } from "./receipt-service";
import { getObligationOperationalContext, getPaymentOperationalContext, getTenantOperationalContext, resolveHostelIdFromObligation } from "@/lib/hostel-context";
import { tenantAdvanceService } from "./tenant-advance-service";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { eventLog } from "@/lib/services/event-log-service";
import { getLogger } from "@/lib/logger";
import { incrementPayment, incrementWebhook } from "@/lib/metrics";
import { tenantAnalyticsService } from "@/lib/services/tenant-analytics-service";
import { financialService } from "./financial-service";
import { assertFinancialHostelMatch, assertSameFinancialHostel, assertScopedEntityHostel, requireFinancialHostelId } from "@/lib/services/financial-isolation";
import { getProviderContext } from "./merchant-context";
import { PAYMENT_DOMAIN, PAYMENT_FLOW, PAYMENT_SCOPE, SETTLEMENT_STATUS, MERCHANT_CONTEXT } from "./financial-domain";
import { paymentStatusEventService } from "@/lib/services/payment-status-event-service";
import { paymentRepository } from "@/src/repositories/paymentRepository";
import { paymentOperationalAnomalyService } from "@/lib/services/payment-operational-anomaly-service";
import { paymentWebhookEventService } from "@/lib/services/payment-webhook-event-service";
import { paymentProviderVerificationSnapshotService } from "@/lib/services/payment-provider-verification-snapshot-service";
import { backendUrl } from "@/lib/config/domains";

const logger = getLogger("payment.service");
type MaybeHostelId = string | null;

export class PaymentService {
  // 🔧 FIX C1: Old calculateProratedRent, generateMonthlyRent, previewMonthlyRent DELETED.
  // These were a split-brain duplicate of RentGenerationService with different rules:
  //   - No lock, no P2002 catch, hardcoded due day to 10th, local time instead of UTC.
  // Use rentGenerationService (lib/services/rent-generation-service.ts) exclusively.

  private attemptIdentityData(merchantTxnId: string, result?: any) {
    return {
      merchant_transaction_id: merchantTxnId,
      provider_order_id: result?.provider_order_id || result?.gateway_txn_id || null,
      provider_transaction_id: result?.provider_transaction_id || null,
      provider_reference_id: result?.provider_reference_id || result?.provider_transaction_id || result?.provider_order_id || result?.gateway_txn_id || null,
    };
  }

  private hmsFinancialOwnerId() {
    return process.env.HMS_FINANCIAL_OWNER_ID || null;
  }

  private isPlatformBillingAttempt(attempt: any) {
    return attempt?.payment_domain === PAYMENT_DOMAIN.PLATFORM_BILLING
      || Boolean(attempt?.invoice_id)
      || attempt?.flow_type === PAYMENT_FLOW.SUBSCRIPTION
      || attempt?.flow_type === PAYMENT_FLOW.ADDON;
  }

  private isAddonAttempt(attempt: any) {
    return (attempt?.payment_domain === PAYMENT_DOMAIN.PLATFORM_BILLING
      && attempt?.flow_type === PAYMENT_FLOW.ADDON)
      || attempt?.payment_type === "ADDON";
  }

  private async getProviderInstanceForAttempt(attempt: any, label: string) {
    if (this.isPlatformBillingAttempt(attempt)) {
      return {
        instance: PaymentProviderFactory.getProvider(attempt.provider, this.getOwnerLevelProviderConfig()),
        config: this.getOwnerLevelProviderConfig(),
      };
    }

    const hostelId = requireFinancialHostelId(attempt.hostel_id, label);
    const providerContext = await getProviderContext({
      paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
      flowType: (attempt as any).flow_type || PAYMENT_FLOW.RENT,
      operationalOwnerId: attempt.owner_id,
      financialOwnerId: attempt.owner_id,
      hostelId,
      scopeType: PAYMENT_SCOPE.HOSTEL,
    });
    return {
      instance: PaymentProviderFactory.getProvider(attempt.provider, providerContext.config),
      config: providerContext.config,
    };
  }

  private async updateAttemptStatus(tx: any, params: {
    attemptId: string;
    fromStatus?: string | null;
    toStatus: string;
    source: string;
    reason?: string;
    data?: any;
    actorId?: string | null;
    metadata?: any;
    operationalOwnerId?: string | null;
    financialOwnerId?: string | null;
    hostelId?: MaybeHostelId;
  }) {
    const updated = await tx.paymentAttempt.update({
      where: { id: params.attemptId },
      data: {
        ...(params.data || {}),
        status: params.toStatus,
      },
    });
    await paymentStatusEventService.append(tx, {
      attemptId: params.attemptId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      source: params.source,
      reason: params.reason,
      actorId: params.actorId || null,
      operationalOwnerId: params.operationalOwnerId || updated.owner_id || null,
      financialOwnerId: params.financialOwnerId || updated.owner_id || null,
      hostelId: params.hostelId || updated.hostel_id || null,
      metadata: params.metadata,
    });
    return updated;
  }

  private async updateAttemptStatusOutsideTx(params: any) {
    return prisma.$transaction((tx) => this.updateAttemptStatus(tx, params));
  }

  /**
   * Core DB-only payment logic — must be called inside an existing transaction.
   * No side-effects (events, receipts, audit logs) — callers handle those after commit.
   */
  private async _applyPaymentInTx(tx: any, data: {
    hostelId: string;
    obligationId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
    paymentAttemptId?: string;
    offlineRecordedBy?: string;
    offlineRecordedAt?: Date;
    offlineRecordedIp?: string;
    offlineNote?: string;
    ownerId?: string;
  }) {
    const hostelId = requireFinancialHostelId(data.hostelId, "payment application");

    await tx.$queryRaw`
      SELECT id FROM rent_obligations
      WHERE id = ${data.obligationId}::uuid
        AND hostel_id = ${hostelId}::uuid
      FOR UPDATE
    `;

    const obligation = await tx.rent_obligations.findUnique({
      where: { id: data.obligationId },
      include: {
        payments: { select: { amount_paid: true, hostel_id: true } },
        tenants: { select: { id: true, hostel_id: true, owner_id: true } },
        room_allocations: { select: { id: true, hostel_id: true } },
      }
    });

    if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
    assertScopedEntityHostel("rent obligation", obligation, hostelId);
    assertSameFinancialHostel("tenant", (obligation as any).tenants, "rent obligation", obligation);
    if ((obligation as any).room_allocations) {
      assertSameFinancialHostel("room allocation", (obligation as any).room_allocations, "rent obligation", obligation);
    }
    for (const payment of obligation.payments) {
      assertSameFinancialHostel("existing payment", payment, "rent obligation", obligation);
    }
    if (data.ownerId && obligation.owner_id && obligation.owner_id !== data.ownerId) {
      throw new Error("FORBIDDEN: Obligation does not belong to this owner");
    }
    if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");
    if (obligation.status === "PAID") throw new Error("BAD_REQUEST: Obligation already fully paid");

    const totalAlreadyPaidPaisa = obligation.payments.reduce(
      (acc: number, p: any) => acc + Math.round(Number(p.amount_paid) * 100), 0
    );
    const obligationPaisa = Math.round(Number(obligation.amount) * 100);
    const remainingPaisa = obligationPaisa - totalAlreadyPaidPaisa;
    const paymentPaisa = Math.round(data.amountPaid * 100);

    if (paymentPaisa > remainingPaisa) {
      throw new Error(`BAD_REQUEST: Payment exceeds balance. Remaining: ${(remainingPaisa / 100).toFixed(2)}`);
    }
    if (paymentPaisa <= 0) {
      throw new Error("BAD_REQUEST: Payment amount must be positive");
    }

    const payment = await tx.payments.create({
      data: {
        obligation_id: data.obligationId,
        tenant_id: obligation.tenant_id,
        owner_id: obligation.owner_id,
        amount_paid: paymentPaisa / 100,
        payment_method: data.paymentMethod,
        reference_number: data.referenceNumber,
        payment_date: data.paymentDate || new Date(),
        payment_attempt_id: data.paymentAttemptId || null,
        idempotency_key: data.paymentAttemptId
          ? `pay:${data.paymentAttemptId}:${data.obligationId}`
          : null,
        offline_recorded_by: data.offlineRecordedBy || null,
        offline_recorded_at: data.offlineRecordedAt || null,
        offline_recorded_ip: data.offlineRecordedIp || null,
        offline_note: data.offlineNote || null,
        hostel_id: obligation.hostel_id,
      }
    });

    assertFinancialHostelMatch("created payment", payment.hostel_id, obligation.hostel_id);

    const newTotalPaidPaisa = totalAlreadyPaidPaisa + paymentPaisa;
    const newStatus = newTotalPaidPaisa >= obligationPaisa ? "PAID" : "PARTIAL";

    await tx.rent_obligations.update({
      where: { id: data.obligationId },
      data: { status: newStatus }
    });

    return { payment, newStatus, tenantId: obligation.tenant_id, ownerId: obligation.owner_id, hostelId: obligation.hostel_id };
  }

  /**
   * Secure offline payment recording — atomically consumes a single-use identity
   * token and records the payment in one DB transaction.
   *
   * Atomicity guarantee:
   *   - Token consumed (used=true)  ┐
   *   - Payment row created         ├── all-or-nothing
   *   - Obligation status updated   ┘
   *
   * If the payment fails for any reason (over-payment, already PAID, DB error),
   * the transaction rolls back and the identity token remains UNUSED — the owner
   * can retry without re-entering their password.
   */
  async recordOfflinePaymentWithToken(jti: string, data: {
    hostelId: string;
    obligationId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
    userId: string;
    ownerId?: string;
    offlineRecordedBy: string;
    offlineRecordedAt: Date;
    offlineRecordedIp?: string;
    offlineNote?: string;
  }) {
    return prisma.$transaction(async (tx: any) => {
      // ── Consume the identity token (atomic, single-use enforcement) ───────
      const consumed = await tx.identity_tokens.updateMany({
        where: {
          jti,
          used: false,
          expires_at: { gt: new Date() },
        },
        data: { used: true, used_at: new Date() },
      });

      if (consumed.count === 0) {
        // Either already used, expired, or jti doesn't exist — all treated the same
        throw new Error("FORBIDDEN: Identity token has already been used or has expired. Please re-confirm your password.");
      }

      // ── Record payment (includes FOR UPDATE lock + balance validation) ────
      return this._applyPaymentInTx(tx, data);
    }).then(async (res: any) => {
      await eventSystem.trigger("payment_recorded", {
        payment_id: res.payment.id,
        obligation_id: data.obligationId,
        tenant_id: res.payment.tenant_id,
        owner_id: res.payment.owner_id,
        hostel_id: res.payment.hostel_id,
        amount: data.amountPaid,
        method: data.paymentMethod,
      });

      if (res.payment?.tenant_id) {
        await tenantAnalyticsService.markReminderConversion(data.obligationId, data.paymentDate || new Date());
        tenantAnalyticsService.calculateTenantScore(res.payment.tenant_id).catch((e: any) =>
          logger.error("tenantScore.failed", { err: e.message })
        );
      }

      receiptService.createReceipt(res.payment.id).then(async (receipt: any) => {
        try {
          // Resolve prefs from payment's immutable hostel chain.
          const { prefs } = await getPaymentOperationalContext(
            res.payment.id,
            res.payment.owner_id || "",
            res.payment.hostel_id,
            res.payment.tenant_id,
          );
          if (!prefs.auto_email_receipt) return;
          const renderContext = receipt._renderContext || {
            footer: prefs.receipt_footer || null,
            currency: prefs.currency,
            timezone: prefs.timezone,
          };
          const pdfBuffer = await receiptService.renderReceiptPdf(receipt, renderContext);
          const tenant = await prisma.tenants.findUnique({
            where: { id: res.payment.tenant_id },
            include: { profiles: true },
          });
          if (tenant?.profiles?.email) {
            const rentMonth = formatMonthYear(receipt.rent_month, prefs);
            await EmailService.sendReceipt({
              toEmail: tenant.profiles.email,
              name: tenant.profiles.name,
              amount: data.amountPaid,
              rentMonth,
              reference: receipt.receipt_number,
              pdfBuffer,
            });
          }
        } catch (err) {
          logger.error("recordOfflinePaymentWithToken.receipt_email_failed", { err });
        }
      }).catch((err: any) => logger.error("recordOfflinePaymentWithToken.receipt_failed", { err }));

      await eventLog.log("OFFLINE_PAYMENT_RECORDED", data.userId, {
        payment_id: res.payment.id,
        obligation_id: data.obligationId,
        amount: data.amountPaid,
        method: data.paymentMethod,
        jti,
        ip: data.offlineRecordedIp || null,
        note: data.offlineNote || null,
      });

      return res;
    });
  }

  async recordPayment(data: {
    hostelId: string;
    obligationId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
    userId?: string;
    ownerId?: string;
    paymentAttemptId?: string;
    offlineRecordedBy?: string;
    offlineRecordedAt?: Date;
    offlineRecordedIp?: string;
    offlineNote?: string;
  }) {
    return prisma.$transaction(async (tx: any) => {
      return this._applyPaymentInTx(tx, data);
    }).then(async (res: any) => {
      await eventSystem.trigger("payment_recorded", {
        payment_id: res.payment.id,
        obligation_id: data.obligationId,
        tenant_id: res.payment.tenant_id,
        owner_id: res.payment.owner_id,
        hostel_id: res.payment.hostel_id,
        amount: data.amountPaid,
        method: data.paymentMethod
      });

      // 📊 ANALYTICS: Track Reminder -> Payment Conversion & update score
      if (res.payment?.id && data.paymentDate) {
        await tenantAnalyticsService.markReminderConversion(data.obligationId, new Date(data.paymentDate));
      } else if (res.payment?.id) {
        await tenantAnalyticsService.markReminderConversion(data.obligationId, new Date());
      }
      
      if (res.payment?.tenant_id) {
        // Fire and forget behavior score update
        tenantAnalyticsService.calculateTenantScore(res.payment.tenant_id).catch(e => logger.error("tenantScore.failed", { err: e.message }));
      }

      // 🔧 FIX C3: Create receipt for ALL payment paths (manual + UPI)
      // Previously only the UPI finalization path created receipts.
      // Cash/manual payments (majority of hostel payments) were invisible to the receipt system.
      receiptService.createReceipt(res.payment.id).then(async (receipt) => {
        try {
          // Resolve prefs from payment's immutable hostel chain.
          const { prefs } = await getPaymentOperationalContext(
            res.payment.id,
            res.payment.owner_id || "",
            res.payment.hostel_id,
            res.payment.tenant_id,
          );
          if (!prefs.auto_email_receipt) return;

          const renderContext = receipt._renderContext || {
            footer: prefs.receipt_footer || null,
            currency: prefs.currency,
            timezone: prefs.timezone,
          };
          const pdfBuffer = await receiptService.renderReceiptPdf(receipt, renderContext);
          const tenant = await prisma.tenants.findUnique({
            where: { id: res.payment.tenant_id },
            include: { profiles: true },
          });
          if (tenant?.profiles?.email) {
            const rentMonth = formatMonthYear(receipt.rent_month, prefs);
            await EmailService.sendReceipt({
              toEmail: tenant.profiles.email,
              name: tenant.profiles.name,
              amount: data.amountPaid,
              rentMonth,
              reference: receipt.receipt_number,
              pdfBuffer,
            });
          }
        } catch (err) {
          console.error("[recordPayment] Receipt email failed:", err);
        }
      }).catch(err => console.error("[recordPayment] Receipt creation failed:", err));

      // 🔧 FIX M3: Audit log for all payment recordings
      await eventLog.log("PAYMENT_RECORDED", data.userId || null, {
        payment_id: res.payment.id,
        obligation_id: data.obligationId,
        amount: data.amountPaid,
        method: data.paymentMethod,
      });

      return res;
    });
  }

  /**
   * 💰 FIFO Payment Allocation — Financial-Grade Implementation
   *
   * Total payable = RENT + ALL unpaid LATE_FEEs
   *
   * Safety guarantees:
   * 1. Row-level locking (FOR UPDATE) — prevents concurrent double-pay
   * 2. Idempotency key — prevents duplicate payments from retries/double-clicks
   * 3. Paisa-safe arithmetic — all math in integer cents, no floating-point
   * 4. Payment grouping — one payment_group_id per user action
   * 5. Single receipt — one receipt per group, shows full breakdown
   * 6. FIFO order — oldest due_date first, RENT before LATE_FEE within same date
   * 7. Partial payments allowed — remaining obligations stay PENDING/PARTIAL
   */
  async recordTenantPayment(data: {
    hostelId: string;
    tenantId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
    userId?: string;
    paymentAttemptId?: string;
    idempotencyKey?: string;
  }) {
    const hostelId = requireFinancialHostelId(data.hostelId, "tenant payment");

    // ── 1. INPUT VALIDATION ──
    if (!data.tenantId) throw new Error("BAD_REQUEST: tenant_id is required");
    if (!data.paymentMethod) throw new Error("BAD_REQUEST: payment_method is required");
    if (!Number.isFinite(data.amountPaid) || data.amountPaid <= 0) {
      throw new Error("BAD_REQUEST: amount_paid must be a positive finite number");
    }
    if (data.amountPaid > 10_000_000) {
      throw new Error("BAD_REQUEST: amount_paid exceeds maximum allowed (₹1 crore)");
    }

    // Convert to paisa for all arithmetic (prevents floating-point errors)
    const amountPaisa = Math.round(data.amountPaid * 100);

    // ── 2. IDEMPOTENCY CHECK ──
    // If caller provides a key, check if this payment was already processed.
    // This prevents duplicate payments from retries, double-clicks, or network failures.
    if (data.idempotencyKey) {
      const existing = await prisma.payments.findFirst({
        where: { idempotency_key: data.idempotencyKey, hostel_id: hostelId },
        select: { payment_group_id: true, amount_paid: true, created_at: true },
      });
      if (existing) {
        logger.info("payments.record_tenant.idempotent_skip", {
          idempotency_key: data.idempotencyKey,
          payment_group_id: existing.payment_group_id,
        });
        // Return the existing group's data
        const groupPayments = await prisma.payments.findMany({
          where: { payment_group_id: existing.payment_group_id!, hostel_id: hostelId },
          include: { obligation: { select: { obligation_type: true, rent_month: true } } },
        });
        return {
          duplicate: true,
          payment_group_id: existing.payment_group_id,
          totalPaid: groupPayments.reduce((s, p) => s + Number(p.amount_paid), 0),
          payments: groupPayments.map(p => ({
            payment_id: p.id,
            obligation_id: p.obligation_id,
            obligation_type: p.obligation?.obligation_type,
            allocated: Number(p.amount_paid),
          })),
        };
      }
    }

    const groupId = crypto.randomUUID();

    // ── 3. ATOMIC TRANSACTION WITH ROW-LEVEL LOCKING ──
    const txResult = await prisma.$transaction(async (tx: any) => {
      // Lock ALL PENDING/PARTIAL obligations for this tenant.
      // FOR UPDATE prevents any concurrent transaction from reading or modifying these rows
      // until our transaction commits. This eliminates the double-pay race condition.
      const lockedRows: { id: string }[] = await tx.$queryRaw`
        SELECT id FROM rent_obligations
        WHERE tenant_id = ${data.tenantId}::uuid
          AND hostel_id = ${hostelId}::uuid
          AND status IN ('PENDING', 'PARTIAL')
        ORDER BY due_date ASC
        FOR UPDATE
      `;

      if (lockedRows.length === 0) {
        throw new Error("BAD_REQUEST: No unpaid obligations found for this tenant");
      }

      // Now read the full data (rows are locked, safe from concurrent modification)
      const obligations = await tx.rent_obligations.findMany({
        where: { id: { in: lockedRows.map(r => r.id) } },
        include: {
          payments: { select: { amount_paid: true, hostel_id: true } },
          tenants: { select: { id: true, hostel_id: true, owner_id: true } },
          room_allocations: { select: { id: true, hostel_id: true } },
        },
        orderBy: { due_date: "asc" },
      });

      for (const ob of obligations) {
        assertScopedEntityHostel("rent obligation", ob, hostelId);
        assertSameFinancialHostel("tenant", (ob as any).tenants, "rent obligation", ob);
        if ((ob as any).room_allocations) {
          assertSameFinancialHostel("room allocation", (ob as any).room_allocations, "rent obligation", ob);
        }
        for (const payment of ob.payments) {
          assertSameFinancialHostel("existing payment", payment, "rent obligation", ob);
        }
      }

      // Sort: FIFO by due_date, then RENT before LATE_FEE within same date
      obligations.sort((a: any, b: any) => {
        const dateDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (dateDiff !== 0) return dateDiff;
        if (a.obligation_type === "RENT" && b.obligation_type !== "RENT") return -1;
        if (a.obligation_type !== "RENT" && b.obligation_type === "RENT") return 1;
        return 0;
      });

      // Calculate total outstanding IN PAISA
      let totalDuePaisa = 0;
      const obData = obligations.map((ob: any) => {
        const paidPaisa = ob.payments.reduce(
          (s: number, p: any) => s + Math.round(Number(p.amount_paid) * 100), 0
        );
        const duePaisa = Math.round(Number(ob.amount) * 100);
        const outstandingPaisa = Math.max(duePaisa - paidPaisa, 0);
        totalDuePaisa += outstandingPaisa;
        return { ob, paidPaisa, duePaisa, outstandingPaisa };
      });

      // Reject overpayment (allow 1 paisa tolerance for decimal conversion edges)
      if (amountPaisa > totalDuePaisa + 1) {
        throw new Error(
          `BAD_REQUEST: MAX_PAYABLE_EXCEEDED: Payment (${(amountPaisa / 100).toFixed(2)}) exceeds total due (${(totalDuePaisa / 100).toFixed(2)}). Please refresh dues and pay up to ₹${(totalDuePaisa / 100).toFixed(2)}.`
        );
      }

      // ── 4. FIFO ALLOCATION ──
      let remainingPaisa = Math.min(amountPaisa, totalDuePaisa);
      const allocations: any[] = [];

      for (const { ob, paidPaisa, duePaisa, outstandingPaisa } of obData) {
        if (remainingPaisa <= 0) break;
        if (outstandingPaisa <= 0) continue;

        const allocPaisa = Math.min(remainingPaisa, outstandingPaisa);
        const allocRupees = allocPaisa / 100;

        const payment = await tx.payments.create({
          data: {
            obligation_id: ob.id,
            tenant_id: data.tenantId,
            owner_id: ob.owner_id,
            amount_paid: allocRupees,
            payment_method: data.paymentMethod,
            reference_number: data.referenceNumber,
            payment_date: data.paymentDate || new Date(),
            payment_attempt_id: data.paymentAttemptId || null,
            payment_group_id: groupId,
            // Only first payment in group gets the idempotency key (unique constraint)
            idempotency_key: allocations.length === 0 ? (data.idempotencyKey || null) : null,
            hostel_id: ob.hostel_id,
          },
        });
        assertFinancialHostelMatch("created payment", payment.hostel_id, ob.hostel_id);

        const newTotalPaidPaisa = paidPaisa + allocPaisa;
        const newStatus = newTotalPaidPaisa >= duePaisa ? "PAID" : "PARTIAL";

        await tx.rent_obligations.update({
          where: { id: ob.id },
          data: { status: newStatus },
        });

        allocations.push({
          payment_id: payment.id,
          obligation_id: ob.id,
          owner_id: payment.owner_id,
          obligation_type: ob.obligation_type,
          rent_month: ob.rent_month,
          allocated: allocRupees,
          new_status: newStatus,
        });

        remainingPaisa -= allocPaisa;
      }

      const totalPaid = amountPaisa / 100;
      const totalDue = totalDuePaisa / 100;
      const remaining = remainingPaisa / 100;
      const overallStatus = remainingPaisa <= 0 && amountPaisa >= totalDuePaisa ? "PAID" : "PARTIAL";

      return { allocations, totalDue, totalPaid, remaining, overallStatus, groupId };
    });

    // ── 5. POST-TRANSACTION: Events, receipt, audit log ──
    // (Outside transaction — idempotent side-effects)

    // Fire payment events
    for (const alloc of txResult.allocations) {
      await eventSystem.trigger("payment_recorded", {
        payment_id: alloc.payment_id,
        obligation_id: alloc.obligation_id,
        tenant_id: data.tenantId,
        owner_id: (alloc as any).owner_id,
        hostel_id: data.hostelId,
        amount: alloc.allocated,
        method: data.paymentMethod,
        group_id: txResult.groupId,
      });
    }

    // ONE receipt per payment group (not per allocation)
    // Uses the FIRST payment in the group as the anchor, stores full breakdown
    const firstPaymentId = txResult.allocations[0]?.payment_id;
    if (firstPaymentId) {
      receiptService.createReceipt(firstPaymentId).catch(err =>
        console.error("[recordTenantPayment] Receipt creation failed:", err)
      );
    }

    // Audit log
    await eventLog.log("TENANT_PAYMENT_RECORDED", data.userId || null, {
      tenant_id: data.tenantId,
      payment_group_id: txResult.groupId,
      total_paid: txResult.totalPaid,
      total_due: txResult.totalDue,
      allocations: txResult.allocations.map((a: any) => ({
        obligation_type: a.obligation_type,
        amount: a.allocated,
        status: a.new_status,
      })),
      method: data.paymentMethod,
      idempotency_key: data.idempotencyKey || null,
    });

    return txResult;
  }

  /**
   * 📊 Get total dues for a tenant — aggregates RENT + LATE_FEE obligations
   *
   * This is what the frontend payment page should call to show:
   *   [ ] Rent (May 2026) — ₹8,000
   *   [ ] Late Fee (Apr 2026) — ₹500
   *   [ ] Late Fee (Apr 2026) — ₹200
   *   Total: ₹8,700
   */
  async getTenantTotalDues(tenantId: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { owner_id: true, hostel_id: true },
    });
    if (!tenant?.hostel_id) throw new Error("HOSTEL_CONTEXT_REQUIRED: tenant hostel scope unavailable");
    return financialService.getTenantDues(tenantId, tenant.owner_id || undefined, tenant.hostel_id);
  }

  async createPaymentIntent(obligationId: string, amount: number | null, userId: string, tenantId?: string) {
    const obligation = await prisma.rent_obligations.findUnique({
      where: { id: obligationId },
      include: { tenants: { include: { profiles: true } } }
    });

    if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
    const hostelId = requireFinancialHostelId(obligation.hostel_id, "payment intent");
    assertSameFinancialHostel("tenant", (obligation as any).tenants, "rent obligation", obligation);
    if (tenantId && obligation.tenant_id !== tenantId) {
      throw new Error("FORBIDDEN: You can only pay your own obligations");
    }

    const alreadyPaid = await this.getExistingPaidAmount(obligationId);
    const balance = Number(obligation.amount) - alreadyPaid;
    const balancePaisa = Math.max(0, Math.round(balance * 100));
    const validationAmount = amount || balance;
    const validationAmountPaisa = Math.round(validationAmount * 100);

    // 1️⃣ Fetch Owner Preferences for Payment Rules
    // Phase 2: resolve from obligation's hostel chain, not findFirst(owner_id)
    const { prefs } = await getObligationOperationalContext(obligation);

    const allowPartial = prefs.allow_partial_payments;
    const minAmount = prefs.min_payment_amount;

    if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");
    if (validationAmountPaisa <= 0) throw new Error("BAD_REQUEST: Obligation is already paid");

    // 2️⃣ Partial Payment Enforcement
    if (!allowPartial && validationAmountPaisa < balancePaisa) {
      throw new Error(`BAD_REQUEST: Partial payments are disabled by the owner. Full payment of ${formatCurrency(balance)} is required.`);
    }

    // 3️⃣ Minimum Amount Enforcement
    const minAmountPaisa = Math.round(minAmount * 100);
    if (validationAmountPaisa < minAmountPaisa && validationAmountPaisa < balancePaisa) {
      throw new Error(`BAD_REQUEST: Minimum payment amount allowed is ${formatCurrency(minAmount)}.`);
    }

    if (validationAmountPaisa > balancePaisa + 1) {
      throw new Error(`BAD_REQUEST: MAX_PAYABLE_EXCEEDED: Payment (${formatCurrency(validationAmount)}) exceeds outstanding balance (${formatCurrency(balance)}). Please refresh dues and pay up to ${formatCurrency(balance)}.`);
    }

    // Check for existing pending or newly created attempt
    const existingAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        obligation_id: obligationId,
        hostel_id: hostelId,
        status: { in: ["PENDING", "CREATED"] },
        OR: [
          { expires_at: null, created_at: { gte: new Date(Date.now() - 5 * 60 * 1000) } }, // CREATED state protection
          { expires_at: { gte: new Date() } } // PENDING state protection
        ]
      },
      orderBy: { created_at: "desc" }
    });

    if (existingAttempt) {
      // If the attempt has a valid checkout_url, reuse it
      const checkoutUrl = existingAttempt.checkout_url || "";
      const isSandboxCheckout = ["mercury-t2", "api-preprod", "pg-sandbox"].some(m => checkoutUrl.includes(m));
      if (checkoutUrl && !checkoutUrl.includes("/payment-return") && !isSandboxCheckout) {
        return existingAttempt;
      }
      if (isSandboxCheckout) {
        logger.warn("payments.create_intent.expire_sandbox_attempt", {
          attemptId: existingAttempt.id,
          checkoutUrl,
          reason: "sandbox checkout URL rejected in production — expiring",
        });
      }
      // Otherwise expire the stale attempt so we create a fresh one with checkout_url
      await this.updateAttemptStatusOutsideTx({
        attemptId: existingAttempt.id,
        fromStatus: existingAttempt.status,
        toStatus: "EXPIRED",
        source: "CREATE_INTENT",
        reason: "stale single-obligation checkout attempt expired before replacement",
        operationalOwnerId: existingAttempt.owner_id,
        financialOwnerId: existingAttempt.owner_id,
        hostelId: existingAttempt.hostel_id,
        data: { settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
      });
    }

    const providerContext = await getProviderContext({
      paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
      flowType: PAYMENT_FLOW.RENT,
      operationalOwnerId: obligation.owner_id || "",
      financialOwnerId: obligation.owner_id || "",
      hostelId,
      scopeType: PAYMENT_SCOPE.HOSTEL,
    });
    const { provider, config } = providerContext;
    const instance = PaymentProviderFactory.getProvider(provider, config);

    const merchantTxnId = `hms_${obligationId.replace(/-/g, "").substring(0, 12)}_${crypto.randomBytes(4).toString("hex")}`;

    logger.info("payments.create_intent.start", {
      obligationId,
      userId,
      tenantId: tenantId || null,
      provider,
      amount: validationAmount,
      merchantTxnId,
    });

    const attempt = await prisma.paymentAttempt.create({
      data: {
        id: crypto.randomUUID(),
        obligation_id: obligationId,
        tenant_id: obligation.tenant_id,
        owner_id: obligation.owner_id || "",
        provider: provider,
        merchant_txn_id: merchantTxnId,
        merchant_transaction_id: merchantTxnId,
        amount: validationAmount,
        status: "CREATED",
        hostel_id: hostelId,
        payment_domain: providerContext.payment_domain,
        scope_type: providerContext.scope_type,
        flow_type: providerContext.flow_type,
        merchant_context_type: providerContext.merchant_context_type,
        merchant_context_id: providerContext.merchant_context_id,
        settlement_status: SETTLEMENT_STATUS.NOT_SETTLED,
      }
    });
    await paymentStatusEventService.appendOutsideTransaction({
      attemptId: attempt.id,
      fromStatus: null,
      toStatus: "CREATED",
      source: "CREATE_INTENT",
      reason: "rent single obligation attempt created",
      operationalOwnerId: obligation.owner_id || "",
      financialOwnerId: obligation.owner_id || "",
      hostelId,
    });

    try {
      const result = await instance.createIntent({
        amount: validationAmount,
        merchant_txn_id: merchantTxnId,
        tenant_name: (obligation as any).tenants?.profiles?.name || "Tenant",
        tenant_email: (obligation as any).tenants?.profiles?.email || "",
        tenant_phone: (obligation as any).tenants?.profiles?.phone || "",
        metadata: {
          obligation_id: obligationId,
          tenant_id: obligation.tenant_id,
          attempt_id: attempt.id
        }
      });

      return await this.updateAttemptStatusOutsideTx({
        attemptId: attempt.id,
        fromStatus: "CREATED",
        toStatus: "PENDING",
        source: "CREATE_INTENT",
        reason: "provider checkout created",
        operationalOwnerId: obligation.owner_id || "",
        financialOwnerId: obligation.owner_id || "",
        hostelId,
        data: {
          gateway_txn_id: result.gateway_txn_id,
          ...this.attemptIdentityData(merchantTxnId, result),
          upi_intent_url: result.upi_intent_url,
          qr_payload: result.qr_payload,
          checkout_url: result.checkout_url,
          expires_at: result.expires_at,
          raw_create_response: result.raw_response as any
        }
      });
    } catch (error) {
      logger.error("payments.create_intent.failed", {
        attemptId: attempt.id,
        provider,
        merchantTxnId,
        error: String(error),
      });
      await this.updateAttemptStatusOutsideTx({
        attemptId: attempt.id,
        fromStatus: "CREATED",
        toStatus: "FAILED",
        source: "CREATE_INTENT",
        reason: "provider checkout creation failed",
        operationalOwnerId: obligation.owner_id || "",
        financialOwnerId: obligation.owner_id || "",
        hostelId,
        data: { raw_create_response: { error: String(error) } as any, settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE }
      });
      throw error;
    }
  }

  async createMultiObligationPaymentIntent(
    obligationIds: string[],
    userId: string,
    tenantId?: string,
    options: { bypassCollectionPolicy?: boolean; source?: string } = {}
  ) {
    // ── 1. INITIAL VALIDATION (outside tx — fast-path rejects, no locks needed) ──
    const obligations = await prisma.rent_obligations.findMany({
      where: { id: { in: obligationIds } },
      include: { tenants: { include: { profiles: true } } }
    });

    if (obligations.length === 0) {
      throw new Error("NOT_FOUND: No obligations found");
    }
    if (obligations.length !== obligationIds.length) {
      const foundIds = new Set(obligations.map(o => o.id));
      const missing = obligationIds.filter(id => !foundIds.has(id));
      throw new Error(`NOT_FOUND: Obligations not found: ${missing.join(", ")}`);
    }

    const tenantIds = Array.from(new Set(obligations.map(o => o.tenant_id).filter(Boolean)));
    if (tenantIds.length > 1) {
      throw new Error("BAD_REQUEST: All obligations must belong to the same tenant");
    }
    const singleTenantId = tenantIds[0];
    if (tenantId && singleTenantId !== tenantId) {
      throw new Error("FORBIDDEN: You can only pay your own obligations");
    }
    if (obligations.some(o => o.status === "WAIVED")) {
      throw new Error("BAD_REQUEST: Cannot pay for waived obligations");
    }
    if (obligations.every(o => o.status === "PAID")) {
      throw new Error("BAD_REQUEST: All obligations are already paid");
    }

    const hostelIds = Array.from(new Set(obligations.map(o => o.hostel_id).filter(Boolean)));
    if (hostelIds.length !== 1) {
      throw new Error("HOSTEL_CONTEXT_MISMATCH: All selected obligations must belong to exactly one hostel");
    }
    const hostelId = requireFinancialHostelId(hostelIds[0], "multi-obligation payment intent");
    for (const obligation of obligations) {
      assertScopedEntityHostel("rent obligation", obligation, hostelId);
      assertSameFinancialHostel("tenant", (obligation as any).tenants, "rent obligation", obligation);
    }

    const ownerId = obligations[0].owner_id || "";
    // Resolve from the first obligation's immutable hostel chain.
    const { prefs } = await getObligationOperationalContext(obligations[0]);
    const providerContext = await getProviderContext({
      paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
      flowType: PAYMENT_FLOW.RENT,
      operationalOwnerId: ownerId,
      financialOwnerId: ownerId,
      hostelId,
      scopeType: PAYMENT_SCOPE.HOSTEL,
    });
    const { provider, config } = providerContext;
    const instance = PaymentProviderFactory.getProvider(provider, config);

    // ── 2. PAYMENT RULES — partial payment enforcement ──
    // Rule: if partial payments are disabled, tenant must cover ALL outstanding obligations,
    // not just a selected subset. Compare against the live DB count, not the selection.
    if (!options.bypassCollectionPolicy && !prefs.allow_partial_payments) {
      const tenantTotalOutstanding = await prisma.rent_obligations.count({
        where: {
          tenant_id: singleTenantId,
          status: { in: ["PENDING", "PARTIAL"] },
          hostel_id: hostelId,
        }
      });
      const selectedNonPaid = obligations.filter(o => o.status !== "PAID" && o.status !== "WAIVED").length;
      if (selectedNonPaid < tenantTotalOutstanding) {
        throw new Error(
          `BAD_REQUEST: Partial payments are disabled by the owner. All ${tenantTotalOutstanding} outstanding obligation(s) must be selected and paid at once.`
        );
      }
    }

    // ── 3. ATOMIC TRANSACTION: lock → re-read amounts → dedup → create attempt ──
    //
    // Two-level serialization:
    //   a) pg_advisory_xact_lock — tenant-scoped mutex. Prevents concurrent
    //      create-intent calls for the SAME TENANT even when they select
    //      non-overlapping obligation sets (which FOR UPDATE alone cannot stop).
    //   b) SELECT ... FOR UPDATE — obligation-row lock. Belt-and-suspenders for
    //      requests on the same obligation set that somehow bypass advisory lock.
    //
    // Both locks release automatically when this transaction commits or rolls back.
    // Gateway I/O happens OUTSIDE this transaction so locks are not held during
    // network delay.
    const txResult = await prisma.$transaction(async (tx) => {
      // Advisory lock: tenant-scoped, so two simultaneous create-intents for the
      // same tenant block here regardless of which obligations they select.
      // hashtext() maps the UUID string to int4; cast to bigint for the lock API.
      const advisoryKey = `pay_intent:${singleTenantId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${advisoryKey})::bigint)`;

      // Row-level lock on selected obligations — complements advisory lock and
      // protects re-read amounts from concurrent finalization.
      await tx.$queryRaw`
        SELECT id FROM rent_obligations
        WHERE id = ANY(${obligationIds}::uuid[])
          AND hostel_id = ${hostelId}::uuid
        FOR UPDATE
      `;

      // Re-read with fresh payments under lock — source of truth for amounts
      const locked = await tx.rent_obligations.findMany({
        where: { id: { in: obligationIds }, hostel_id: hostelId },
        include: { payments: { select: { amount_paid: true, hostel_id: true } } }
      });

      if (locked.length !== obligationIds.length) {
        throw new Error("HOSTEL_CONTEXT_MISMATCH: Selected obligations changed hostel scope during payment intent creation");
      }
      for (const ob of locked) {
        assertScopedEntityHostel("locked rent obligation", ob, hostelId);
        for (const payment of ob.payments) {
          assertSameFinancialHostel("existing payment", payment, "rent obligation", ob);
        }
      }

      let totalAmountPaisa = 0;
      const paymentBreakdown: { obligationId: string; amount: number }[] = [];

      for (const ob of locked) {
        if (ob.status === "PAID" || ob.status === "WAIVED") continue;
        const paidPaisa = ob.payments.reduce((sum, p) => sum + Math.round(Number(p.amount_paid) * 100), 0);
        const duePaisa = Math.round(Number(ob.amount) * 100);
        const outstandingPaisa = Math.max(0, duePaisa - paidPaisa);
        if (outstandingPaisa <= 0) continue;
        totalAmountPaisa += outstandingPaisa;
        paymentBreakdown.push({ obligationId: ob.id, amount: outstandingPaisa / 100 });
      }

      if (totalAmountPaisa <= 0) {
        throw new Error("BAD_REQUEST: No outstanding amount to pay (verified under lock)");
      }

      const totalAmount = totalAmountPaisa / 100;
      const minAmountPaisa = Math.round(prefs.min_payment_amount * 100);
      if (!options.bypassCollectionPolicy && totalAmountPaisa < minAmountPaisa) {
        throw new Error(`BAD_REQUEST: Minimum payment amount allowed is ${formatCurrency(prefs.min_payment_amount)}`);
      }

      // Dedup check inside the same tx — eliminates TOCTOU race
      const existingLinks = await tx.payment_attempt_obligations.findMany({
        where: {
          obligation_id: { in: paymentBreakdown.map(p => p.obligationId) },
          payment_attempts: { hostel_id: hostelId, status: { in: ["CREATED", "PENDING"] } },
        },
        include: { payment_attempts: true },
        orderBy: { created_at: "desc" },
      });

      if (existingLinks.length > 0) {
        const existingAttempt = existingLinks[0].payment_attempts;
        const checkoutUrl = existingAttempt.checkout_url || "";
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

        // An in-flight CREATED attempt has no checkout_url yet because the gateway
        // call is still running (we are outside the tx when we call PhonePe).
        // Do NOT expire it — return it and let the caller wait for the checkout_url.
        const isInFlight =
          existingAttempt.status === "CREATED" &&
          existingAttempt.created_at > twoMinAgo;

        // A live PENDING attempt already has a usable checkout URL.
        const isSandboxCheckout = ["mercury-t2", "api-preprod", "pg-sandbox"].some(m => checkoutUrl.includes(m));
        if (isSandboxCheckout) {
          logger.warn("payments.create_multi_intent.expire_sandbox_attempt", {
            attemptId: existingAttempt.id,
            checkoutUrl,
            reason: "sandbox checkout URL rejected in production — expiring",
          });
        }
        const hasValidCheckout =
          checkoutUrl.length > 0 && !checkoutUrl.includes("/payment-return") && !isSandboxCheckout;

        if (isInFlight || hasValidCheckout) {
          logger.info("payments.create_multi_intent.reuse_existing", {
            existingAttemptId: existingAttempt.id,
            merchantTxnId: existingAttempt.merchant_txn_id,
            reason: isInFlight ? "in_flight_created" : "valid_checkout",
          });
          return { attempt: existingAttempt, isReused: true as const, totalAmount, paymentBreakdown };
        }

        // Stale: CREATED > 2 min with no checkout_url, or PENDING with expired URL
        await this.updateAttemptStatus(tx, {
          attemptId: existingAttempt.id,
          fromStatus: existingAttempt.status,
          toStatus: "EXPIRED",
          source: "CREATE_INTENT",
          reason: "stale multi-obligation checkout attempt expired before replacement",
          operationalOwnerId: existingAttempt.owner_id,
          financialOwnerId: existingAttempt.owner_id,
          hostelId: existingAttempt.hostel_id,
          data: { settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
        });
      }

      const merchantTxnId = `hms_multi_${crypto.randomBytes(6).toString("hex")}`;

      logger.info("payments.create_multi_intent.start", {
        obligationCount: obligationIds.length,
        userId,
        tenantId: tenantId || null,
        provider,
        amount: totalAmount,
        merchantTxnId,
        breakdown: paymentBreakdown,
      });

      const newAttempt = await tx.paymentAttempt.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: singleTenantId,
          owner_id: ownerId,
          provider,
          merchant_txn_id: merchantTxnId,
          merchant_transaction_id: merchantTxnId,
          amount: totalAmount,
          status: "CREATED",
          hostel_id: hostelId,
          payment_domain: providerContext.payment_domain,
          scope_type: providerContext.scope_type,
          flow_type: providerContext.flow_type,
          merchant_context_type: providerContext.merchant_context_type,
          merchant_context_id: providerContext.merchant_context_id,
          settlement_status: SETTLEMENT_STATUS.NOT_SETTLED,
          raw_create_response: options.source ? { source: options.source, bypass_collection_policy: Boolean(options.bypassCollectionPolicy) } : undefined,
        }
      });
      await paymentStatusEventService.append(tx, {
        attemptId: newAttempt.id,
        fromStatus: null,
        toStatus: "CREATED",
        source: "CREATE_INTENT",
        reason: "rent multi-obligation attempt created",
        operationalOwnerId: ownerId,
        financialOwnerId: ownerId,
        hostelId,
      });

      await tx.payment_attempt_obligations.createMany({
        data: paymentBreakdown.map(item => ({
          id: crypto.randomUUID(),
          payment_attempt_id: newAttempt.id,
          obligation_id: item.obligationId,
          amount: item.amount,
        }))
      });

      return { attempt: newAttempt, isReused: false as const, totalAmount, paymentBreakdown };
    });

    if (txResult.isReused) return txResult.attempt;

    const { attempt, totalAmount } = txResult;

    // ── 4. CALL GATEWAY (outside transaction — network I/O must not hold a DB lock) ──
    try {
      const result = await instance.createIntent({
        amount: totalAmount,
        merchant_txn_id: attempt.merchant_txn_id,
        tenant_name: (obligations[0] as any).tenants?.profiles?.name || "Tenant",
        tenant_email: (obligations[0] as any).tenants?.profiles?.email || "",
        tenant_phone: (obligations[0] as any).tenants?.profiles?.phone || "",
        metadata: {
          obligation_ids: obligationIds,
          tenant_id: singleTenantId,
          attempt_id: attempt.id,
          is_multi: true
        }
      });

      return await this.updateAttemptStatusOutsideTx({
        attemptId: attempt.id,
        fromStatus: "CREATED",
        toStatus: "PENDING",
        source: "CREATE_INTENT",
        reason: "provider checkout created",
        operationalOwnerId: ownerId,
        financialOwnerId: ownerId,
        hostelId,
        data: {
          gateway_txn_id: result.gateway_txn_id,
          ...this.attemptIdentityData(attempt.merchant_txn_id, result),
          upi_intent_url: result.upi_intent_url,
          qr_payload: result.qr_payload,
          checkout_url: result.checkout_url,
          expires_at: result.expires_at,
          raw_create_response: result.raw_response as any
        }
      });
    } catch (error) {
      logger.error("payments.create_multi_intent.failed", {
        attemptId: attempt.id,
        provider,
        merchantTxnId: attempt.merchant_txn_id,
        error: String(error),
      });
      await this.updateAttemptStatusOutsideTx({
        attemptId: attempt.id,
        fromStatus: "CREATED",
        toStatus: "FAILED",
        source: "CREATE_INTENT",
        reason: "provider checkout creation failed",
        operationalOwnerId: ownerId,
        financialOwnerId: ownerId,
        hostelId,
        data: { raw_create_response: { error: String(error) } as any, settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE }
      });
      throw error;
    }
  }

  /**
   * Create a PhonePe payment intent for an advance/deposit payment.
   * No obligation is linked — on SUCCESS, finalizePaymentAttempt credits the ledger.
   *
   * Lock ordering (consistent with adjustAgainstObligation):
   *   pg_advisory_xact_lock(tenant) → tenant row FOR UPDATE
   */
  async createAdvancePaymentIntent(params: {
    tenantId: string;
    ownerId: string;
    amount: number;
    profileId: string;
  }) {
    const { tenantId, ownerId, amount, profileId } = params;

    if (amount <= 0) throw new Error("BAD_REQUEST: Amount must be positive");

    // Resolve prefs from the tenant's explicit hostel context.
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: { profiles: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: Tenant does not belong to this owner");

    const { prefs } = await getTenantOperationalContext(tenant.id, ownerId, tenant.hostel_id);
    const hostelId = requireFinancialHostelId(tenant.hostel_id, "advance payment intent");

    if (!prefs.advance_enabled) {
      throw new Error("BAD_REQUEST: Advance/deposit payments are not enabled for this hostel");
    }
    const minPaisa = Math.round(prefs.min_payment_amount * 100);
    const amountPaisa = Math.round(amount * 100);
    if (amountPaisa < minPaisa) {
      throw new Error(`BAD_REQUEST: Minimum payment amount is ${formatCurrency(prefs.min_payment_amount)}`);
    }

    const providerContext = await getProviderContext({
      paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
      flowType: PAYMENT_FLOW.ADVANCE,
      operationalOwnerId: ownerId,
      financialOwnerId: ownerId,
      hostelId,
      scopeType: PAYMENT_SCOPE.HOSTEL,
    });
    const { provider, config } = providerContext;
    const instance = PaymentProviderFactory.getProvider(provider, config);

    const txResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"adv_intent:" + tenantId})::bigint)`;
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

      // Dedup: reuse a live PENDING advance attempt for this tenant
      const existing = await tx.paymentAttempt.findFirst({
        where: {
          tenant_id: tenantId,
          payment_type: "ADVANCE",
          status: { in: ["CREATED", "PENDING"] },
        },
        orderBy: { created_at: "desc" },
      });

      if (existing) {
        const checkoutUrl = (existing as any).checkout_url || "";
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
        const isInFlight = existing.status === "CREATED" && existing.created_at > twoMinAgo;
        const hasValidCheckout = checkoutUrl.length > 0 && !checkoutUrl.includes("/payment-return");
        if (isInFlight || hasValidCheckout) {
          return { attempt: existing, isReused: true };
        }
        await this.updateAttemptStatus(tx, {
          attemptId: existing.id,
          fromStatus: existing.status,
          toStatus: "EXPIRED",
          source: "CREATE_INTENT",
          reason: "stale advance checkout attempt expired before replacement",
          operationalOwnerId: existing.owner_id,
          financialOwnerId: existing.owner_id,
          hostelId: existing.hostel_id,
          data: { settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
        });
      }

      const merchantTxnId = `hms_adv_${crypto.randomBytes(6).toString("hex")}`;
      const newAttempt = await tx.paymentAttempt.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          owner_id: ownerId,
          provider,
          merchant_txn_id: merchantTxnId,
          merchant_transaction_id: merchantTxnId,
          amount,
          status: "CREATED",
          payment_type: "ADVANCE",
          hostel_id: hostelId,
          payment_domain: providerContext.payment_domain,
          scope_type: providerContext.scope_type,
          flow_type: providerContext.flow_type,
          merchant_context_type: providerContext.merchant_context_type,
          merchant_context_id: providerContext.merchant_context_id,
          settlement_status: SETTLEMENT_STATUS.NOT_SETTLED,
        } as any,
      });
      await paymentStatusEventService.append(tx, {
        attemptId: newAttempt.id,
        fromStatus: null,
        toStatus: "CREATED",
        source: "CREATE_INTENT",
        reason: "advance payment attempt created",
        operationalOwnerId: ownerId,
        financialOwnerId: ownerId,
        hostelId,
      });
      return { attempt: newAttempt, isReused: false };
    });

    if (txResult.isReused) return txResult.attempt;

    const { attempt } = txResult;
    try {
      const result = await instance.createIntent({
        amount,
        merchant_txn_id: attempt.merchant_txn_id,
        tenant_name: tenant.profiles.name,
        tenant_email: tenant.profiles.email,
        tenant_phone: tenant.profiles.phone || "",
        metadata: { tenant_id: tenantId, attempt_id: attempt.id, payment_type: "ADVANCE" },
      });
      return await this.updateAttemptStatusOutsideTx({
        attemptId: attempt.id,
        fromStatus: "CREATED",
        toStatus: "PENDING",
        source: "CREATE_INTENT",
        reason: "provider checkout created",
        operationalOwnerId: ownerId,
        financialOwnerId: ownerId,
        hostelId,
        data: {
          gateway_txn_id: result.gateway_txn_id,
          ...this.attemptIdentityData(attempt.merchant_txn_id, result),
          upi_intent_url: result.upi_intent_url,
          qr_payload: result.qr_payload,
          checkout_url: result.checkout_url,
          expires_at: result.expires_at,
          raw_create_response: result.raw_response as any,
        },
      });
    } catch (error) {
      await this.updateAttemptStatusOutsideTx({
        attemptId: attempt.id,
        fromStatus: "CREATED",
        toStatus: "FAILED",
        source: "CREATE_INTENT",
        reason: "provider checkout creation failed",
        operationalOwnerId: ownerId,
        financialOwnerId: ownerId,
        hostelId,
        data: { raw_create_response: { error: String(error) } as any, settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
      });
      throw error;
    }
  }

  async previewPaymentAmount(obligationIds: string[], userId: string, tenantId?: string) {
    const obligations = await prisma.rent_obligations.findMany({
      where: { id: { in: obligationIds } },
      include: { payments: { select: { amount_paid: true } } }
    });

    if (obligations.length === 0) {
      throw new Error("NOT_FOUND: No obligations found");
    }
    if (obligations.length !== obligationIds.length) {
      const foundIds = new Set(obligations.map(o => o.id));
      const missing = obligationIds.filter(id => !foundIds.has(id));
      throw new Error(`NOT_FOUND: Obligations not found: ${missing.join(", ")}`);
    }

    const tenantIds = Array.from(new Set(obligations.map(o => o.tenant_id).filter(Boolean)));
    if (tenantIds.length > 1) {
      throw new Error("BAD_REQUEST: All obligations must belong to the same tenant");
    }
    const singleTenantId = tenantIds[0];
    if (tenantId && singleTenantId !== tenantId) {
      throw new Error("FORBIDDEN: You can only preview your own obligations");
    }

    const items = obligations.map(ob => {
      const paidPaisa = ob.payments.reduce((sum, p) => sum + Math.round(Number(p.amount_paid) * 100), 0);
      const duePaisa = Math.round(Number(ob.amount) * 100);
      const outstandingPaisa = Math.max(0, duePaisa - paidPaisa);
      return {
        id: ob.id,
        rent_month: ob.rent_month,
        obligation_type: ob.obligation_type,
        due_amount: Number(ob.amount),
        paid_amount: paidPaisa / 100,
        outstanding_amount: outstandingPaisa / 100,
        status: ob.status,
      };
    });

    const totalOutstandingPaisa = items.reduce((sum, item) => sum + Math.round(item.outstanding_amount * 100), 0);

    return {
      obligations: items,
      total_outstanding: totalOutstandingPaisa / 100,
      currency: "INR",
    };
  }

  async getPaymentAttempt(attemptId: string, userId: string, role: string, tenantId?: string) {
    const attempt = await prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new Error("NOT_FOUND: Payment attempt not found");

    if (role === "TENANT" && attempt.tenant_id !== tenantId) {
      throw new Error("FORBIDDEN: You can only view your own attempts");
    }
    if (role === "OWNER" && attempt.owner_id !== userId) {
      throw new Error("FORBIDDEN: You can only view attempts for your hostel");
    }

    return attempt;
  }

  async finalizePaymentAttempt(
    attemptId: string,
    status: string,
    gatewayTxnId?: string,
    rawPayload?: any,
    context?: { requestId?: string; source?: string; actor?: { id: string; ip?: string } }
  ) {
    const requestMeta = context?.requestId ? { request_id: context.requestId } : {};

    // ── Step 1: Acquire exclusive PROCESSING lock ──────────────────────────────
    // Atomically claim the attempt before reading or writing anything.
    // Only PENDING and PENDING_VERIFICATION can transition to PROCESSING:
    //   PENDING            → still waiting for webhook/verify
    //   PENDING_VERIFICATION → webhook claimed it, now we finalize
    // If count === 0 the attempt is already PROCESSING (another caller beat us)
    // or already terminal (SUCCESS/FAILED/etc.). Re-read and return — no work.
    const preLockAttempt = await prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      select: { status: true, owner_id: true, hostel_id: true, payment_domain: true, flow_type: true },
    });

    const lockResult = await prisma.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: ["PENDING", "PENDING_VERIFICATION", "PENDING_MANUAL_CONFIRMATION"] } },
      data: { status: "PROCESSING" },
    });

    if (lockResult.count === 0) {
      const fresh = await prisma.paymentAttempt.findUnique({
        where: { id: attemptId },
        include: { payments: true },
      });
      if (!fresh) throw new Error("NOT_FOUND: Attempt not found");
      if (["SUCCESS", "FAILED", "EXPIRED", "CANCELLED"].includes(fresh.status)) {
        logger.info("payments.finalize.already_terminal", { ...requestMeta, attempt_id: attemptId, status: fresh.status });
      } else {
        logger.info("payments.finalize.lock_contention", { ...requestMeta, attempt_id: attemptId, status: fresh.status });
      }
      return fresh;
    }

    logger.info("payments.finalize.lock_acquired", { ...requestMeta, attempt_id: attemptId, incoming_status: status });
    await paymentStatusEventService.appendOutsideTransaction({
      attemptId,
      fromStatus: preLockAttempt?.status || null,
      toStatus: "PROCESSING",
      source: context?.source === "reconcile" ? "RECONCILE" : context?.source === "MANUAL_CONFIRM" ? "MANUAL_CONFIRM" : "VERIFY",
      reason: "attempt claimed for settlement",
      actorId: context?.actor?.id || null,
      operationalOwnerId: preLockAttempt?.owner_id || null,
      financialOwnerId: this.isPlatformBillingAttempt(preLockAttempt) ? this.hmsFinancialOwnerId() : preLockAttempt?.owner_id || null,
      hostelId: preLockAttempt?.hostel_id || null,
    });

    // ── Step 2: Read current state (status = PROCESSING — we own the lock) ─────
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      include: { payments: true }
    });
    if (!attempt) throw new Error("NOT_FOUND: Attempt not found");

    // ──────────────────────────────────────────────────────────────
    // 🎁 ADDON PATH: Reminder pack credit allocation
    // ──────────────────────────────────────────────────────────────
    if (this.isAddonAttempt(attempt)) {
      // Non-success statuses: record and exit
      if (status !== "SUCCESS") {
        logger.info("addons.webhook.non_success", { ...requestMeta, attempt_id: attemptId, status });
        return await this.updateAttemptStatusOutsideTx({
          attemptId,
          fromStatus: "PROCESSING",
          toStatus: status,
          source: context?.source === "reconcile" ? "RECONCILE" : "VERIFY",
          reason: "provider returned non-success status for addon",
          operationalOwnerId: attempt.owner_id,
          financialOwnerId: this.hmsFinancialOwnerId(),
          hostelId: null,
          data: { gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null, settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
        });
      }

      // ── Security: validate pack is from allow-list ────────────────
      const pack = attempt.addon_pack as string | null;
      const PACK_MAP: Record<string, { credits: number; amount: number }> = {
        "TEST_1": { credits: 1, amount: 1 },
        "200": { credits: 200, amount: 99 },
        "500": { credits: 500, amount: 199 },
      };

      if (!pack || !PACK_MAP[pack]) {
        logger.error("addons.webhook.invalid_pack", { ...requestMeta, attempt_id: attemptId, pack });
        throw new Error(`VALIDATION_ERROR: Unknown addon pack: "${pack}"`);
      }

      // ── Security: validate payment amount matches pack price ──────
      // This closes the fraud hole where someone tampers the checkout amount.
      const expectedAmount = PACK_MAP[pack].amount;
      const actualAmountPaisa   = Math.round(Number(attempt.amount) * 100);
      const expectedAmountPaisa = Math.round(expectedAmount * 100);

      if (actualAmountPaisa !== expectedAmountPaisa) {
        logger.error("addons.webhook.amount_mismatch", {
          ...requestMeta,
          attempt_id: attemptId,
          pack,
          expected_paise: expectedAmountPaisa,
          actual_paise: actualAmountPaisa,
        });
        // Mark attempt FAILED — do NOT credit
        await this.updateAttemptStatusOutsideTx({
          attemptId,
          fromStatus: "PROCESSING",
          toStatus: "FAILED",
          source: context?.source === "reconcile" ? "RECONCILE" : "VERIFY",
          reason: "addon amount mismatch",
          operationalOwnerId: attempt.owner_id,
          financialOwnerId: this.hmsFinancialOwnerId(),
          hostelId: null,
          data: { raw_webhook_payload: rawPayload || null, settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
        });
        throw new Error(`VALIDATION_ERROR: Amount mismatch for addon pack "${pack}". Expected ₹${expectedAmount}, got ₹${Number(attempt.amount)}.`);
      }

      const credits = PACK_MAP[pack].credits;

      // ── Atomic: updateMany as idempotency gate ────────────────────
      // updateMany returns count=0 if status is already SUCCESS/FAILED/etc.
      // This makes double-crediting structurally impossible — not just a runtime check.
      let credited = false;
      await prisma.$transaction(async (tx) => {
        const gate = await tx.paymentAttempt.updateMany({
          where: { id: attemptId, status: { in: ["PENDING", "PROCESSING"] } },
          data: {
            status: "SUCCESS",
            gateway_txn_id: gatewayTxnId,
            raw_webhook_payload: rawPayload || null,
            confirmed_at: new Date(),
            settlement_status: SETTLEMENT_STATUS.SETTLED,
            settled_at: new Date(),
          },
        });

        // gate.count === 0 → already finalized → no credit
        if (gate.count === 0) {
          logger.info("addons.webhook.idempotent_skip", { ...requestMeta, attempt_id: attemptId });
          return;
        }
        await paymentStatusEventService.append(tx, {
          attemptId,
          fromStatus: "PROCESSING",
          toStatus: "SUCCESS",
          source: context?.source === "reconcile" ? "RECONCILE" : "VERIFY",
          reason: "addon credits credited atomically",
          operationalOwnerId: attempt.owner_id,
          financialOwnerId: this.hmsFinancialOwnerId(),
          hostelId: null,
          metadata: { pack, credits },
        });

        // ── Soft cap: prevent abuse / overflow ────────────────────
        const current = await tx.addonUsage.findUnique({
          where: { owner_id: attempt.owner_id },
          select: { reminders_remaining: true },
        });
        const currentBalance = current?.reminders_remaining ?? 0;
        const CREDIT_CAP = 10_000;

        if (currentBalance + credits > CREDIT_CAP) {
          logger.warn("addons.webhook.cap_exceeded", {
            ...requestMeta,
            attempt_id: attemptId,
            owner_id: attempt.owner_id,
            current_balance: currentBalance,
            credits,
          });
          throw new Error(`CREDIT_CAP_EXCEEDED: Balance would exceed ${CREDIT_CAP.toLocaleString()} credits. Current: ${currentBalance}.`);
        }

        // Credit the account
        await tx.addonUsage.upsert({
          where: { owner_id: attempt.owner_id },
          update: { reminders_remaining: { increment: credits } },
          create: { owner_id: attempt.owner_id, reminders_remaining: credits + 5, reminders_used: 0 },
        });

        // Audit trail: immutable ledger entry
        await tx.addonTransactions.create({
          data: {
            owner_id: attempt.owner_id,
            payment_attempt_id: attemptId,
            pack,
            credits_added: credits,
          },
        });

        credited = true;
      }); // end $transaction

      if (credited) {
        logger.info("addons.credits_allocated", {
          ...requestMeta,
          attempt_id: attemptId,
          owner_id: attempt.owner_id,
          pack,
          credits,
        });
        await eventLog.log("ADDON_CREDITS_ADDED", attempt.owner_id, {
          pack,
          credits,
          payment_attempt_id: attemptId,
          gateway_txn_id: gatewayTxnId,
        }).catch(() => {});
      }

      return await prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    } // end ADDON PATH



    // ──────────────────────────────────────────────────────────────
    // 💰 RENT PATH: Obligation payment (existing logic)
    // ──────────────────────────────────────────────────────────────

    if (status !== "SUCCESS") {
      logger.info("payments.finalize.rent_non_success", { ...requestMeta, attempt_id: attemptId, status });
      return await this.updateAttemptStatusOutsideTx({
        attemptId,
        fromStatus: "PROCESSING",
        toStatus: status,
        source: context?.source === "reconcile" ? "RECONCILE" : "VERIFY",
        reason: "provider returned non-success status",
        operationalOwnerId: attempt.owner_id,
        financialOwnerId: attempt.owner_id,
        hostelId: attempt.hostel_id,
        data: {
          gateway_txn_id: gatewayTxnId,
          raw_webhook_payload: rawPayload || null,
          settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE,
        },
      });
    }


    const isManualConfirm = context?.source === "MANUAL_CONFIRM";

    // ──────────────────────────────────────────────────────────────
    // 💎 ADVANCE PATH: Gateway-driven deposit, no obligation linkage
    // ──────────────────────────────────────────────────────────────
    if ((attempt as any).payment_domain === PAYMENT_DOMAIN.RENT_COLLECTION && (attempt as any).flow_type === PAYMENT_FLOW.ADVANCE) {
      if (!attempt.tenant_id) {
        throw new Error("INTERNAL: ADVANCE payment attempt is missing tenant_id");
      }
      const advanceTenantId: string = attempt.tenant_id;
      const finalizedAdvance = await prisma.$transaction(async (tx) => {
        // Lock ordering: tenant row first (consistent with adjustAgainstObligation)
        await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${advanceTenantId}::uuid FOR UPDATE`;
        await tenantAdvanceService.creditIdempotentInTx(tx, {
          tenantId: advanceTenantId,
          ownerId: attempt.owner_id,
          amount: Number(attempt.amount),
          referenceId: attempt.id,
          referenceType: "PAYMENT_ATTEMPT",
          createdBy: attempt.owner_id,
        });
        return this.updateAttemptStatus(tx, {
          attemptId,
          fromStatus: "PROCESSING",
          toStatus: "SUCCESS",
          source: context?.source === "reconcile" ? "RECONCILE" : isManualConfirm ? "MANUAL_CONFIRM" : "VERIFY",
          reason: "advance ledger credited atomically",
          actorId: context?.actor?.id || null,
          operationalOwnerId: attempt.owner_id,
          financialOwnerId: attempt.owner_id,
          hostelId: attempt.hostel_id,
          data: {
            gateway_txn_id: gatewayTxnId,
            raw_webhook_payload: rawPayload || null,
            confirmed_at: new Date(),
            settlement_status: SETTLEMENT_STATUS.SETTLED,
            settled_at: new Date(),
            ...(isManualConfirm && context?.actor ? {
              manual_confirmed_by: context.actor.id,
              manual_confirmed_at: new Date(),
              manual_confirm_ip: context.actor.ip ?? null,
            } : {}),
          },
        });
      });
      logger.info("payments.finalize.advance_credited", {
        ...requestMeta,
        attempt_id: attemptId,
        amount: Number(attempt.amount),
        tenant_id: attempt.tenant_id,
      });
      await eventLog.log("ADVANCE_CREDITED", attempt.owner_id, {
        attempt_id: attemptId,
        merchant_txn_id: attempt.merchant_txn_id,
        amount: Number(attempt.amount),
        tenant_id: attempt.tenant_id,
        gateway_txn_id: gatewayTxnId || null,
      });
      return finalizedAdvance;
    }

    // Use ONLY junction table - no fallback to raw_create_response
    const obligationLinks = await prisma.payment_attempt_obligations.findMany({
      where: { payment_attempt_id: attemptId }
    });
    const attemptHostelId = requireFinancialHostelId(attempt.hostel_id, "rent payment attempt finalization");

    // Single atomic transaction — all obligation payments succeed or all roll back.
    // _applyPaymentInTx is used directly so we don't nest prisma.$transaction calls.
    const appliedPayments: { payment: any; newStatus: string; tenantId: string; ownerId: string }[] = [];

    let updatedAttempt: any = null;
    if (attempt.payments.length > 0) {
      updatedAttempt = await this.updateAttemptStatusOutsideTx({
        attemptId,
        fromStatus: "PROCESSING",
        toStatus: "SUCCESS",
        source: context?.source === "reconcile" ? "RECONCILE" : isManualConfirm ? "MANUAL_CONFIRM" : "VERIFY",
        reason: "rent attempt already has ledger payments",
        actorId: context?.actor?.id || null,
        operationalOwnerId: attempt.owner_id,
        financialOwnerId: attempt.owner_id,
        hostelId: attempt.hostel_id,
        data: {
          gateway_txn_id: gatewayTxnId,
          raw_webhook_payload: rawPayload || null,
          confirmed_at: new Date(),
          settlement_status: SETTLEMENT_STATUS.SETTLED,
          settled_at: new Date(),
        },
      });
    } else {
    updatedAttempt = await prisma.$transaction(async (tx) => {
      if (obligationLinks.length > 0) {
        // Multi-obligation payment: use junction table
        for (const link of obligationLinks) {
          if (Number(link.amount) > 0) {
            const res = await this._applyPaymentInTx(tx, {
              hostelId: attemptHostelId,
              obligationId: link.obligation_id,
              amountPaid: Number(link.amount),
              paymentMethod: "UPI",
              referenceNumber: gatewayTxnId || attempt.merchant_txn_id,
              paymentDate: new Date(),
              paymentAttemptId: attempt.id,
            });
            appliedPayments.push(res);
          }
        }
      } else if (attempt.obligation_id) {
        // Single obligation payment (legacy)
        const res = await this._applyPaymentInTx(tx, {
          hostelId: attemptHostelId,
          obligationId: attempt.obligation_id,
          amountPaid: Number(attempt.amount),
          paymentMethod: "UPI",
          referenceNumber: gatewayTxnId || attempt.merchant_txn_id,
          paymentDate: new Date(),
          paymentAttemptId: attempt.id,
        });
        appliedPayments.push(res);
      }
      // If neither — invoice payment or no linkage (handled in billing path above)
      if (appliedPayments.length === 0) {
        throw new Error("SETTLEMENT_FAILED: Rent payment attempt has no linked obligations to settle");
      }
      const finalized = await this.updateAttemptStatus(tx, {
        attemptId,
        fromStatus: "PROCESSING",
        toStatus: "SUCCESS",
        source: context?.source === "reconcile" ? "RECONCILE" : isManualConfirm ? "MANUAL_CONFIRM" : "VERIFY",
        reason: "rent ledger settled atomically",
        actorId: context?.actor?.id || null,
        operationalOwnerId: attempt.owner_id,
        financialOwnerId: attempt.owner_id,
        hostelId: attempt.hostel_id,
        data: {
          gateway_txn_id: gatewayTxnId,
          raw_webhook_payload: rawPayload || null,
          confirmed_at: new Date(),
          settlement_status: SETTLEMENT_STATUS.SETTLED,
          settled_at: new Date(),
          ...(isManualConfirm && context?.actor ? {
            manual_confirmed_by: context.actor.id,
            manual_confirmed_at: new Date(),
            manual_confirm_ip: context.actor.ip ?? null,
          } : {}),
        },
      });
      return finalized;
    });
    }
    logger.info("payments.finalize.marked_success", { ...requestMeta, attempt_id: attemptId, gateway_txn_id: gatewayTxnId ?? null, source: context?.source ?? "auto" });

    // Post-transaction side-effects: events, receipts, audit logs
    for (const { payment, tenantId: tId } of appliedPayments) {
      await eventSystem.trigger("payment_recorded", {
        payment_id: payment.id,
        obligation_id: payment.obligation_id,
        tenant_id: tId,
        owner_id: payment.owner_id,
        hostel_id: payment.hostel_id,
        amount: Number(payment.amount_paid),
        method: "UPI",
        attempt_id: attemptId,
      });
    }
    if (appliedPayments.length > 0) {
      receiptService.createReceipt(appliedPayments[0].payment.id).catch(err =>
        logger.error("payments.finalize.receipt_failed", { attempt_id: attemptId, error: String(err) })
      );
    }
    await eventLog.log("PAYMENT_FINALIZED", attempt.owner_id, {
      attempt_id: attemptId,
      merchant_txn_id: attempt.merchant_txn_id,
      gateway_txn_id: gatewayTxnId || null,
      obligation_count: appliedPayments.length,
    });

    return updatedAttempt;
  }

  async handlePaymentWebhook(providerName: string, headers: any, body: any, context?: { requestId?: string; webhookEventId?: string }) {
    const providerStr = providerName.toUpperCase();
    const requestMeta = context?.requestId ? { request_id: context.requestId } : {};
    
    // Instead of searching top 20 pending attempts, we MUST extract the merchantOrderId directly
    // since we know it's a PhonePe webhook and the format.
    let merchantOrderId: string | null = null;
    
    try {
      let parsed = body;
      if (typeof body === "string") parsed = JSON.parse(body);
      merchantOrderId = parsed?.payload?.merchantOrderId || null;
    } catch (e) {
      logger.warn("payments.webhook.merchant_order_id_extract_failed", {
        ...requestMeta,
        error: String(e),
      });
    }

    if (!merchantOrderId) {
      throw new Error("BAD_REQUEST: Webhook payload missing merchantOrderId");
    }

    // Direct lookup - O(1) and safe
    const attempt = await prisma.paymentAttempt.findFirst({
      where: {
        OR: [
          { merchant_txn_id: merchantOrderId },
          { merchant_transaction_id: merchantOrderId },
        ],
      }
    });

    if (!attempt) {
      throw new Error(`NOT_FOUND: Payment attempt not found for merchant_txn_id: ${merchantOrderId}`);
    }
    if (context?.webhookEventId) {
      await paymentWebhookEventService.markProcessing(context.webhookEventId).catch(() => {});
    }

    if (attempt.provider !== providerStr) {
      throw new Error(`BAD_REQUEST: Webhook provider ${providerStr} does not match attempt provider ${attempt.provider}`);
    }

    // Idempotency check with ATOMIC LOCKING
    const lockResult = await prisma.paymentAttempt.updateMany({
      where: { 
        id: attempt.id, 
        status: { in: ["PENDING", "CREATED"] } 
      },
      data: { 
        status: "PENDING_VERIFICATION",
        updated_at: new Date()
      }
    });

    if (lockResult.count === 0) {
      logger.info("payments.webhook.attempt_already_processed_or_locked", {
        ...requestMeta,
        attemptId: attempt.id,
        status: attempt.status,
      });
      incrementWebhook(true); // Already processed, not an error
      if (context?.webhookEventId) {
        await paymentWebhookEventService.markProcessed(context.webhookEventId, {
          attempt_id: attempt.id,
          status: attempt.status,
          idempotent: true,
        }).catch(() => {});
      }
      return { success: true, message: `Attempt already processed or locked` };
    }
    await paymentStatusEventService.appendOutsideTransaction({
      attemptId: attempt.id,
      fromStatus: attempt.status,
      toStatus: "PENDING_VERIFICATION",
      source: "WEBHOOK",
      reason: "webhook claimed attempt for provider source-of-truth verification",
      operationalOwnerId: attempt.owner_id,
      financialOwnerId: this.isPlatformBillingAttempt(attempt) ? this.hmsFinancialOwnerId() : attempt.owner_id,
      hostelId: this.isPlatformBillingAttempt(attempt) ? null : attempt.hostel_id,
      metadata: { provider: providerStr, webhookEventId: context?.webhookEventId || null },
    }).catch((error) => {
      logger.warn("payments.webhook.status_event_failed", {
        ...requestMeta,
        attempt_id: attempt.id,
        error: String(error),
      });
    });

    logger.info("payments.webhook.attempt_matched", {
      ...requestMeta,
      provider: providerStr,
      attemptId: attempt.id,
      merchantTxnId: attempt.merchant_txn_id,
      hasVerifyHeader: Boolean(headers?.["x-verify"] || headers?.["X-VERIFY"]),
    });

    const { instance } = await this.getProviderInstanceForAttempt(attempt, "payment webhook verification");
    
    // 1. Initial parsing of the webhook payload
    const verification = await instance.verifyWebhook(headers, body);
    
    if (verification.merchant_txn_id !== attempt.merchant_txn_id) {
       throw new Error(`SECURITY_ERROR: Webhook merchantTxnId ${verification.merchant_txn_id} does not match DB ${attempt.merchant_txn_id}`);
    }

    // 2. CRITICAL SECURITY: Never trust webhook payload blindly.
    // Call out to the payment provider to fetch the absolute source of truth status.
    let sourceOfTruth;
    try {
      sourceOfTruth = await instance.fetchStatus(attempt.merchant_txn_id, verification.gateway_txn_id || undefined);
    } catch (e) {
      // SRE FIX: If the provider API is down, save the raw webhook payload so we don't lose the event data
      // even though we are returning 500 and expecting a retry.
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { raw_webhook_payload: verification.raw_event }
      });
      throw e;
    }
    await paymentProviderVerificationSnapshotService.record({
      provider: providerStr,
      source: "WEBHOOK",
      attempt,
      webhookEventId: context?.webhookEventId || null,
      providerTransactionId: sourceOfTruth.provider_transaction_id || verification.provider_transaction_id || null,
      providerOrderId: sourceOfTruth.provider_order_id || verification.provider_order_id || sourceOfTruth.gateway_txn_id || verification.gateway_txn_id || null,
      providerReferenceId: sourceOfTruth.provider_reference_id || verification.provider_reference_id || null,
      providerStatus: (sourceOfTruth as any).provider_status || sourceOfTruth.status,
      normalizedStatus: sourceOfTruth.status,
      amount: verification.amount ?? null,
      rawResponse: sourceOfTruth.raw_status,
    });
    
    if (sourceOfTruth.status === "PENDING" && verification.status === "SUCCESS") {
      throw new Error(`SECURITY_ERROR: Webhook claimed SUCCESS but Provider API claims PENDING for ${attempt.merchant_txn_id}`);
    }

    const finalStatus = sourceOfTruth.status !== "PENDING" ? sourceOfTruth.status : verification.status;

    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        provider_transaction_id: sourceOfTruth.provider_transaction_id || verification.provider_transaction_id || null,
        provider_order_id: sourceOfTruth.provider_order_id || verification.provider_order_id || sourceOfTruth.gateway_txn_id || verification.gateway_txn_id || null,
        provider_reference_id: sourceOfTruth.provider_reference_id || verification.provider_reference_id || sourceOfTruth.provider_transaction_id || verification.provider_transaction_id || sourceOfTruth.gateway_txn_id || verification.gateway_txn_id || null,
      } as any,
    }).catch(async (error: any) => {
      if (String(error?.message || error).includes("Unique")) {
        await paymentOperationalAnomalyService.create({
          anomalyType: "DUPLICATE_PROVIDER_REFERENCE",
          severity: "HIGH",
          paymentDomain: (attempt as any).payment_domain,
          flowType: (attempt as any).flow_type,
          paymentAttemptId: attempt.id,
          webhookEventId: context?.webhookEventId || null,
          operationalOwnerId: attempt.owner_id,
          financialOwnerId: attempt.owner_id,
          hostelId: attempt.hostel_id,
          metadata: { provider: providerStr },
        });
      }
    });

    if (finalStatus === "SUCCESS") {
      const expectedPaise = Math.round(Number(attempt.amount) * 100);
      const receivedPaise =
        verification.amount == null ? null : Math.round(Number(verification.amount) * 100);

      // Only reject if amount IS present and doesn't match — PhonePe webhooks sometimes
      // omit amount, and throwing on null would silently kill all webhook processing.
      if (receivedPaise !== null && receivedPaise !== expectedPaise) {
        logger.error("payments.webhook.amount_mismatch", {
          ...requestMeta,
          attemptId: attempt.id,
          merchantTxnId: attempt.merchant_txn_id,
          expectedAmount: Number(attempt.amount),
          receivedAmount: verification.amount ?? null,
        });
        throw new Error("BAD_REQUEST: Webhook amount does not match payment attempt");
      }
    }

    logger.info("payments.webhook.verified", {
      ...requestMeta,
      attemptId: attempt.id,
      merchantTxnId: attempt.merchant_txn_id,
      status: verification.status,
    });
    
    const result = await this.finalizePaymentAttempt(
      attempt.id,
      finalStatus,
      sourceOfTruth.gateway_txn_id || verification.gateway_txn_id || undefined,
      verification.raw_event,
      context
    );
    incrementWebhook(true);
    if (result?.status === "SUCCESS") incrementPayment("success");
    if (context?.webhookEventId) {
      await paymentWebhookEventService.markProcessed(context.webhookEventId, {
        attempt_id: attempt.id,
        final_status: result?.status || finalStatus,
      }).catch(() => {});
    }
    return result;
  }

  async verifyPaymentStatus(params: {
    userId: string;
    role: string;
    tenantId?: string;
    attemptId?: string;
    merchantTxnId?: string;
    gatewayTxnId?: string;
  }) {
    const { userId, role, tenantId, attemptId, merchantTxnId, gatewayTxnId } = params;

    if (!attemptId && !merchantTxnId && !gatewayTxnId) {
      throw new Error("BAD_REQUEST: attempt_id or merchant_txn_id or gateway_txn_id is required");
    }

    const attempt = await prisma.paymentAttempt.findFirst({
      where: {
        OR: [
          ...(attemptId ? [{ id: attemptId }] : []),
          ...(merchantTxnId ? [{ merchant_txn_id: merchantTxnId }, { merchant_transaction_id: merchantTxnId }] : []),
          ...(gatewayTxnId ? [
            { gateway_txn_id: gatewayTxnId },
            { provider_transaction_id: gatewayTxnId },
            { provider_order_id: gatewayTxnId },
            { provider_reference_id: gatewayTxnId },
          ] : []),
        ]
      }
    });

    if (!attempt) {
      logger.warn("payments.verify.attempt_not_found", {
        userId,
        role,
        attemptId: attemptId || null,
        merchantTxnId: merchantTxnId || null,
        gatewayTxnId: gatewayTxnId || null,
      });
      throw new Error("NOT_FOUND: Payment attempt not found");
    }

    if (role === "TENANT" && attempt.tenant_id !== tenantId) {
      logger.warn("payments.verify.forbidden_tenant_mismatch", {
        userId,
        role,
        attemptTenantId: attempt.tenant_id,
        requestTenantId: tenantId,
        merchantTxnId: attempt.merchant_txn_id,
      });
      throw new Error("FORBIDDEN: You can only verify your own attempts");
    }
    if (role === "OWNER" && attempt.owner_id !== userId) {
      logger.warn("payments.verify.forbidden_owner_mismatch", {
        userId,
        role,
        attemptOwnerId: attempt.owner_id,
        requestUserId: userId,
        merchantTxnId: attempt.merchant_txn_id,
      });
      throw new Error("FORBIDDEN: You can only verify attempts for your hostel");
    }

    logger.info("payments.verify.attempt_found", {
      attemptId: attempt.id,
      merchantTxnId: attempt.merchant_txn_id,
      status: attempt.status,
      role,
    });

    if (["SUCCESS", "FAILED", "EXPIRED", "CANCELLED", "PENDING_MANUAL_CONFIRMATION"].includes(attempt.status)) {
      return {
        attempt,
        status: attempt.status,
        source: "cached"
      };
    }

    const { instance } = await this.getProviderInstanceForAttempt(attempt, "payment attempt verification");
    let fetched;

    try {
      fetched = await instance.fetchStatus(
        (attempt as any).merchant_transaction_id || attempt.merchant_txn_id,
        gatewayTxnId || (attempt as any).provider_order_id || attempt.gateway_txn_id || undefined
      );
      await paymentProviderVerificationSnapshotService.record({
        provider: attempt.provider,
        source: "VERIFY",
        attempt,
        providerTransactionId: fetched.provider_transaction_id || null,
        providerOrderId: fetched.provider_order_id || fetched.gateway_txn_id || null,
        providerReferenceId: fetched.provider_reference_id || null,
        providerStatus: (fetched as any).provider_status || fetched.status,
        normalizedStatus: fetched.status,
        amount: (fetched as any).amount ?? null,
        rawResponse: fetched.raw_status,
      });
    } catch (error) {
      logger.error("payments.verify.fetch_status_failed", {
        attemptId: attempt.id,
        merchantTxnId: attempt.merchant_txn_id,
        provider: attempt.provider,
        error: String(error),
      });

      return {
        attempt,
        status: attempt.status,
        source: "cached_pending"
      };
    }

    logger.info("payments.verify.fetched_status", {
      attemptId: attempt.id,
      merchantTxnId: attempt.merchant_txn_id,
      fromStatus: attempt.status,
      fetchedStatus: fetched.status,
      provider: attempt.provider,
    });

    // Skip finalize when provider says PENDING — no state change needed, avoids
    // a no-op DB write on every poll while payment is in-flight.
    if (fetched.status === "PENDING") {
      return { attempt, status: attempt.status, source: "pending" };
    }

    const finalized = await this.finalizePaymentAttempt(
      attempt.id,
      fetched.status,
      fetched.provider_transaction_id || fetched.gateway_txn_id || undefined,
      { source: "verify", payload: fetched.raw_status }
    );

    const resolvedAttempt = finalized || attempt;

    return {
      attempt: resolvedAttempt,
      status: resolvedAttempt.status,
      source: "provider"
    };
  }

  async waiveObligation(obligationId: string, userId: string) {
    const existingPayments = await prisma.payments.findMany({ where: { obligation_id: obligationId } });
    if (existingPayments.length > 0) throw new Error("BAD_REQUEST: Cannot waive an obligation with payments");

    // CRITICAL: Scoping the update to the authenticated owner_id
    const obligation = await prisma.rent_obligations.update({
      where: { id: obligationId, owner_id: userId },
      data: { status: "WAIVED" }
    });

    await eventSystem.trigger("rent_waived", { obligationId, userId });
    return obligation;
  }

  async getDuesReport(ownerId: string, hostelId: string, rentMonth?: Date, status?: string) {
    const dues = await paymentRepository.getDuesReportData(ownerId, hostelId, rentMonth, status);

    return dues.map((d: any) => ({
      obligation_id: d.id,
      tenant_id: d.tenant_id,
      hostel_id: d.hostel_id,
      tenant_name: d.tenants?.profiles?.name || "Tenant",
      tenant_email: d.tenants?.profiles?.email || "",
      tenant_phone: d.tenants?.profiles?.phone || "",
      photo_url: d.tenants?.photo_url || null,
      room_no: d.room_allocations?.room?.room_no || "N/A",
      rent_month: d.rent_month,
      due_date: d.due_date,
      amount: Number(d.amount),
      status: d.status,
      outstanding: Math.max(0, Number(d.amount) - (d.payments?.reduce((s: number, p: any) => s + Number(p.amount_paid), 0) || 0))
    }));
  }

  async getAllPayments(
    ownerId: string,
    hostelId: string,
    limit: number = 50,
    offset: number = 0,
    filters?: {
      tenantId?: string;
      status?: string;
      method?: string;
      month?: string;
    }
  ) {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const statusFilter = (filters?.status || "").toUpperCase();

    const methodFilter = filters?.method
      ? Prisma.sql`AND p.payment_method = ${filters.method}`
      : Prisma.empty;
    const monthFilter = typeof filters?.month === "string" && /^\d{4}-\d{2}$/.test(filters.month)
      ? Prisma.sql`AND o.rent_month >= ${new Date(`${filters.month}-01T00:00:00.000Z`)}::date
          AND o.rent_month < ${new Date(Date.UTC(Number(filters.month.slice(0, 4)), Number(filters.month.slice(5, 7)), 1, 0, 0, 0, 0))}::date`
      : Prisma.empty;
    const tenantFilter = filters?.tenantId
      ? Prisma.sql`AND o.tenant_id = ${filters.tenantId}::uuid`
      : Prisma.empty;

    const statusWhere =
      !statusFilter || statusFilter === "ALL"
        ? Prisma.sql`TRUE`
        : statusFilter === "PAID"
          ? Prisma.sql`computed_status = 'paid'`
          : statusFilter === "PENDING"
            ? Prisma.sql`computed_status IN ('pending', 'partial')`
            : statusFilter === "OVERDUE"
              ? Prisma.sql`computed_status = 'overdue'`
              : statusFilter === "PARTIAL"
                ? Prisma.sql`computed_status = 'partial'`
                : statusFilter === "WAIVED"
                  ? Prisma.sql`computed_status = 'waived'`
                  : Prisma.sql`UPPER(computed_status) = ${statusFilter}`;

    const rows = await prisma.$queryRaw<any[]>`
      WITH hostel_scope AS (
        SELECT EXISTS (
          SELECT 1
          FROM hostels h
          WHERE h.id = ${hostelId}::uuid
            AND h.owner_id = ${ownerId}::uuid
            AND h.is_active = true
        ) AS allowed
      ),
      base AS (
        SELECT
          o.id,
          o.tenant_id,
          o.rent_month,
          o.due_date,
          o.amount::float AS rent_amount,
          o.status::text AS status_raw,
          COALESCE(pay.total_paid, 0)::float AS paid_amount,
          GREATEST(0, o.amount::float - COALESCE(pay.total_paid, 0))::float AS balance,
          COALESCE(pay.payment_methods, '[]'::jsonb) AS payment_methods,
          prof.name AS tenant_name,
          prof.phone AS tenant_phone,
          prof.email AS tenant_email,
          r.room_no,
          latest.id AS latest_payment_id,
          latest.payment_method AS latest_payment_method,
          latest.reference_number AS latest_reference_number,
          latest.created_at AS latest_created_at,
          latest.payment_date AS latest_payment_date,
          CASE
            WHEN o.status::text = 'WAIVED' THEN 'waived'
            WHEN o.status::text = 'PAID' OR o.amount::float - COALESCE(pay.total_paid, 0) <= 0 THEN 'paid'
            WHEN o.due_date < ${todayUTC}::date THEN 'overdue'
            WHEN o.status::text = 'PARTIAL' THEN 'partial'
            ELSE 'pending'
          END AS computed_status
        FROM rent_obligations o
        JOIN hostel_scope hs ON hs.allowed
        LEFT JOIN tenants t ON t.id = o.tenant_id
        LEFT JOIN profiles prof ON prof.id = t.profile_id
        LEFT JOIN room_allocations ra ON ra.id = o.allocation_id
        LEFT JOIN rooms r ON r.id = ra.room_id
        LEFT JOIN LATERAL (
          SELECT
            SUM(p.amount_paid)::float AS total_paid,
            COALESCE(jsonb_agg(DISTINCT p.payment_method) FILTER (WHERE p.payment_method IS NOT NULL), '[]'::jsonb) AS payment_methods
          FROM payments p
          WHERE p.obligation_id = o.id
          ${methodFilter}
        ) pay ON true
        LEFT JOIN LATERAL (
          SELECT p.id, p.payment_method, p.reference_number, p.created_at, p.payment_date
          FROM payments p
          WHERE p.obligation_id = o.id
          ${methodFilter}
          ORDER BY p.payment_date DESC, p.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE o.owner_id = ${ownerId}::uuid
          AND o.hostel_id = ${hostelId}::uuid
          ${tenantFilter}
          ${monthFilter}
      ),
      filtered AS (
        SELECT *
        FROM base
        WHERE ${statusWhere}
      ),
      paged AS (
        SELECT *
        FROM filtered
        ORDER BY rent_month DESC NULLS LAST, due_date DESC NULLS LAST
        LIMIT ${limit}
        OFFSET ${offset}
      ),
      stats AS (
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(paid_amount), 0)::float AS total_collected,
          COUNT(*) FILTER (WHERE computed_status IN ('pending', 'partial', 'overdue'))::int AS pending_rows,
          COUNT(*) FILTER (WHERE computed_status = 'overdue')::int AS overdue_rows
        FROM filtered
      ),
      operational_dues AS (
        SELECT
          COALESCE(SUM(
            o.amount - COALESCE(pay_agg.total_paid, 0)
          ), 0)::float AS pending_total,
          COALESCE(SUM(
            CASE WHEN o.due_date < ${todayUTC}::date
              THEN o.amount - COALESCE(pay_agg.total_paid, 0)
              ELSE 0
            END
          ), 0)::float AS overdue_total
        FROM rent_obligations o
        JOIN hostel_scope hs ON hs.allowed
        JOIN tenants t ON t.id = o.tenant_id
        LEFT JOIN (
          SELECT obligation_id, SUM(amount_paid)::float AS total_paid
          FROM payments
          GROUP BY obligation_id
        ) pay_agg ON pay_agg.obligation_id = o.id
        WHERE o.owner_id = ${ownerId}::uuid
          AND o.hostel_id = ${hostelId}::uuid
          AND o.status IN ('PENDING', 'PARTIAL')
          AND t.status = 'ACTIVE'
          AND o.amount - COALESCE(pay_agg.total_paid, 0) > 0
      ),
      active_tenants AS (
        SELECT COUNT(*)::int AS active_tenants
        FROM tenants t
        WHERE t.owner_id = ${ownerId}::uuid
          AND t.hostel_id = ${hostelId}::uuid
          AND t.status = 'ACTIVE'
      ),
      payment_records AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', p.id,
          'obligationId', f.id,
          'tenantId', f.tenant_id,
          'tenantName', COALESCE(f.tenant_name, 'Unknown'),
          'amount', p.amount_paid::float,
          'month', f.rent_month,
          'date', p.payment_date,
          'paymentDate', p.payment_date,
          'createdAt', p.created_at,
          'method', p.payment_method,
          'status', 'paid'
        ) ORDER BY p.payment_date DESC, p.created_at DESC), '[]'::jsonb) AS rows
        FROM filtered f
        JOIN payments p ON p.obligation_id = f.id
        ${filters?.method ? Prisma.sql`WHERE p.payment_method = ${filters.method}` : Prisma.empty}
      ),
      page_rows AS (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', id,
          'obligationId', id,
          'tenantId', tenant_id,
          'tenantName', COALESCE(tenant_name, 'Unknown'),
          'tenant_name', COALESCE(tenant_name, 'Unknown'),
          'tenantPhone', tenant_phone,
          'tenantEmail', tenant_email,
          'room', COALESCE(room_no, 'N/A'),
          'room_no', COALESCE(room_no, 'N/A'),
          'month', rent_month,
          'dueDate', due_date,
          'rentAmount', rent_amount,
          'paidAmount', paid_amount,
          'amount_paid', paid_amount,
          'balance', balance,
          'outstanding', balance,
          'status', computed_status,
          'statusRaw', UPPER(status_raw),
          'paymentMethod', latest_payment_method,
          'paymentMethods', payment_methods,
          'latestPaymentId', latest_payment_id,
          'reference_number', latest_reference_number,
          'preferred_app', null,
          'createdAt', latest_created_at,
          'paymentDate', latest_payment_date,
          'payment_date', latest_payment_date,
          'isReceiptAvailable', latest_payment_id IS NOT NULL,
          'entityType', 'ledger',
          'amount', CASE WHEN balance > 0 THEN balance ELSE COALESCE(NULLIF(paid_amount, 0), rent_amount) END
        ) ORDER BY rent_month DESC NULLS LAST, due_date DESC NULLS LAST), '[]'::jsonb) AS rows
        FROM paged
      )
      SELECT
        hs.allowed,
        s.total,
        s.total_collected,
        od.pending_total AS pending_dues,
        od.overdue_total AS overdue_amount,
        s.pending_rows,
        s.overdue_rows,
        a.active_tenants,
        pr.rows AS payment_records,
        page.rows AS payments
      FROM hostel_scope hs
      CROSS JOIN stats s
      CROSS JOIN operational_dues od
      CROSS JOIN active_tenants a
      CROSS JOIN payment_records pr
      CROSS JOIN page_rows page
    `;

    const row = rows[0] || {};
    if (!row.allowed) {
      const error = new Error("Hostel is not owned by the authenticated owner.");
      (error as any).code = "FORBIDDEN";
      throw error;
    }

    const paginatedRows = Array.isArray(row.payments) ? row.payments : [];
    const paymentRecords = Array.isArray(row.payment_records) ? row.payment_records : [];
    const total = Number(row.total || 0);
    const stats = {
      total_collected: Number(Number(row.total_collected || 0).toFixed(2)),
      pending_dues: Number(Number(row.pending_dues || 0).toFixed(2)),
      overdue_amount: Number(Number(row.overdue_amount || 0).toFixed(2)),
      active_tenants: Number(row.active_tenants || 0),
      pending_rows: Number(row.pending_rows || 0),
      overdue_rows: Number(row.overdue_rows || 0),
    };

    return {
      stats,
      payments: paginatedRows,
      payment_records: paymentRecords,
      total,
      limit,
      offset,
    };
  }

  private async getExistingPaidAmount(obligationId: string): Promise<number> {
    const payments = await prisma.payments.findMany({
      where: { obligation_id: obligationId },
      select: { amount_paid: true }
    });
    return payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
  }

  private async getProviderForOwner(ownerId: string, hostelId: string) {
    const scopedHostelId = requireFinancialHostelId(hostelId, "payment provider resolution");
    const hostel = await prisma.hostels.findUnique({
      where: { id: scopedHostelId },
      include: { profiles: true },
    });

    if (!hostel || hostel.owner_id !== ownerId) {
      throw new Error("HOSTEL_ACCESS_DENIED: Payment provider hostel does not belong to this owner.");
    }

    if (!hostel.upi_id) {
      throw new Error("CONFIG_ERROR: Owner UPI ID is not configured. Please set your UPI ID in hostel settings.");
    }

    // UPI Direct provider — tenant pays owner directly via UPI intent link
    return {
      provider: "PHONEPE", // Provider class name kept for backward compat with existing attempts table
      config: {
        owner_upi_id: hostel.upi_id,
        owner_name: hostel.name || (hostel as any).profiles?.name || "Hostel",
        hostel_id: hostel.id,
      }
    };
  }

  private async getProviderInstance(ownerId: string, providerName: string, hostelId: string) {
    const { config } = await this.getProviderForOwner(ownerId, hostelId);
    return {
      instance: PaymentProviderFactory.getProvider(providerName, config),
      config
    };
  }

  private getOwnerLevelProviderConfig() {
    return {
      clientId: process.env.PHONEPE_CLIENT_ID!,
      clientSecret: process.env.PHONEPE_CLIENT_SECRET!,
      clientVersion: process.env.PHONEPE_CLIENT_VERSION || "1",
      merchantId: process.env.PHONEPE_MERCHANT_ID!,
      saltKey: process.env.PHONEPE_SALT_KEY!,
      saltIndex: process.env.PHONEPE_SALT_INDEX!,
      environment: (process.env.PHONEPE_ENV as "SANDBOX" | "PRODUCTION") || "SANDBOX",
      callbackUrl: backendUrl("/api/webhooks/payments/phonepe"),
    };
  }

  async getTenantPaymentHistory(tenantId: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        room_allocations: {
          where: { is_active: true, end_date: null },
          include: { room: true },
          orderBy: { created_at: "desc" }
        },
        rent_obligations: {
          orderBy: { due_date: "desc" },
          include: {
            payments: {
              orderBy: { payment_date: "desc" }
            }
          }
        }
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");

    if (!tenant.hostel_id) throw new Error("HOSTEL_CONTEXT_REQUIRED: tenant hostel scope unavailable");
    const dues = await financialService.getTenantDues(tenantId, tenant.owner_id || undefined, tenant.hostel_id);
    let totalDue = dues.total_due;
    let totalPaid = 0;
    const allPayments: any[] = [];
    const latestUnpaidDueDate = dues.items[0]?.due_date || null;

    const formattedObligations = (tenant as any).rent_obligations.map((o: any) => {
      const obligationPaid = o.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
      const remainingDue = Math.max(0, Number(o.amount) - obligationPaid);

      totalPaid += obligationPaid;
      o.payments.forEach((p: any) => {
        const transactionId = p.reference_number || p.payment_attempt_id || p.id;
        allPayments.push({
          id: p.id,
          obligation_id: p.obligation_id,
          amount_paid: Number(p.amount_paid),
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          reference_number: p.reference_number,
          transaction_id: transactionId,
          rent_month: o.rent_month
        });
      });

      return {
        id: o.id,
        rent_month: o.rent_month,
        due_date: o.due_date,
        amount: Number(o.amount),
        obligation_type: o.obligation_type,
        status: o.status,
        remaining_due: o.status === "WAIVED" ? 0 : remainingDue,
        payments: o.payments.map((p: any) => ({
          id: p.id,
          amount_paid: Number(p.amount_paid),
          payment_date: p.payment_date,
          method: p.payment_method,
          transaction_id: p.reference_number || p.payment_attempt_id || p.id
        }))
      };
    });

    const outstandingBalance = dues.total_due;
    const paymentStatus = outstandingBalance <= 0
      ? "PAID"
      : totalPaid > 0
        ? "PARTIAL"
        : "PENDING";
    const allocationRent = Number((tenant as any).room_allocations?.[0]?.room?.base_rent || 0);
    const fallbackObligationRent = Number((tenant as any).rent_obligations?.[0]?.amount || 0);
    const tenantRent = Number(tenant.monthly_rent || 0);
    const monthlyRent =
      (allocationRent > 0 ? allocationRent : 0) ||
      (tenantRent > 0 ? tenantRent : 0) ||
      (fallbackObligationRent > 0 ? fallbackObligationRent : 0);

    return {
      tenant_id: tenantId,
      obligations: formattedObligations,
      payments: allPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
      monthly_rent: monthlyRent,
      next_due_date: latestUnpaidDueDate,
      payment_status: paymentStatus,
      total_due: totalDue,
      total_paid: totalPaid,
      outstanding_balance: outstandingBalance
    };
  }

  async reconcilePendingAttempts(options?: {
    ownerId?: string;
    hostelId?: MaybeHostelId;
    paymentDomain?: string;
    attemptIds?: string[];
  }) {
    const now = new Date();
    const ownerFilter = options?.ownerId ? { owner_id: options.ownerId } : {};
    const hostelFilter = options?.hostelId ? { hostel_id: options.hostelId } : {};
    const domainFilter = options?.paymentDomain ? { payment_domain: options.paymentDomain } : {};
    const idFilter = options?.attemptIds?.length
      ? { OR: [
          { id: { in: options.attemptIds } },
          { merchant_txn_id: { in: options.attemptIds } },
          { merchant_transaction_id: { in: options.attemptIds } },
          { gateway_txn_id: { in: options.attemptIds } },
          { provider_transaction_id: { in: options.attemptIds } },
          { provider_order_id: { in: options.attemptIds } },
          { provider_reference_id: { in: options.attemptIds } },
        ] }
      : {};
    const run = await (prisma as any).paymentReconciliationRun.create({
      data: {
        id: crypto.randomUUID(),
        payment_domain: options?.paymentDomain || (options?.hostelId ? PAYMENT_DOMAIN.RENT_COLLECTION : PAYMENT_DOMAIN.PLATFORM_BILLING),
        scope_type: options?.hostelId ? PAYMENT_SCOPE.HOSTEL : PAYMENT_SCOPE.PLATFORM,
        operational_owner_id: options?.ownerId || null,
        financial_owner_id: (options?.paymentDomain === PAYMENT_DOMAIN.PLATFORM_BILLING || (!options?.hostelId && !options?.ownerId))
          ? this.hmsFinancialOwnerId()
          : options?.ownerId || null,
        hostel_id: options?.hostelId || null,
      },
    });
    const createItem = async (data: any) => {
      await (prisma as any).paymentReconciliationItem.create({
        data: {
          id: crypto.randomUUID(),
          reconciliation_run_id: run.id,
          ...data,
          operational_owner_id: options?.ownerId || data.operational_owner_id || null,
          financial_owner_id: options?.paymentDomain === PAYMENT_DOMAIN.PLATFORM_BILLING
            ? this.hmsFinancialOwnerId()
            : options?.ownerId || data.financial_owner_id || null,
          hostel_id: options?.hostelId || data.hostel_id || null,
        },
      }).catch((error: any) => logger.warn("payments.reconcile.item_failed", { run_id: run.id, error: String(error) }));
    };

    // ── Pass 0: Release stale PROCESSING / PENDING_VERIFICATION locks ──────────
    // If a server crashed while holding PROCESSING (or while PENDING_VERIFICATION
    // was set by the webhook handler), the attempt is stuck and no future webhook
    // will ever pick it up. Recovery SLA: 5 minutes.
    //
    //   PENDING_VERIFICATION > 5 min → reset to PENDING
    //     (webhook verification / provider API call likely crashed before completing)
    //
    //   PROCESSING > 5 min, payments already committed → mark SUCCESS
    //     (the payment TX committed but the status update crashed afterward)
    //
    //   PROCESSING > 5 min, no payments → reset to PENDING
    //     (the payment TX never committed; normal reconciliation will retry)
    const staleLockCutoff = new Date(now.getTime() - 5 * 60 * 1000);

    const stalePendingVerificationList = await prisma.paymentAttempt.findMany({
      where: { status: "PENDING_VERIFICATION", updated_at: { lt: staleLockCutoff }, ...ownerFilter, ...hostelFilter, ...domainFilter, ...idFilter },
    });
    let stalePendingVerificationReset = 0;
    for (const stale of stalePendingVerificationList) {
      await this.updateAttemptStatusOutsideTx({
        attemptId: stale.id,
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "PENDING",
        source: "RECONCILE",
          reason: "stale provider verification lock reset",
          operationalOwnerId: stale.owner_id,
          financialOwnerId: this.isPlatformBillingAttempt(stale) ? this.hmsFinancialOwnerId() : stale.owner_id,
          hostelId: this.isPlatformBillingAttempt(stale) ? null : stale.hostel_id,
      }).then(() => { stalePendingVerificationReset++; }).catch(() => {});
      await createItem({
        payment_attempt_id: stale.id,
        anomaly_type: "STALE_PENDING_VERIFICATION",
        severity: "MEDIUM",
        action: "RESET_TO_PENDING",
        result: "REPAIRED",
        metadata: { merchant_transaction_id: (stale as any).merchant_transaction_id || stale.merchant_txn_id },
      });
    }

    const staleProcessingList = await prisma.paymentAttempt.findMany({
      where: { status: "PROCESSING", updated_at: { lt: staleLockCutoff }, ...ownerFilter, ...hostelFilter, ...domainFilter, ...idFilter },
      include: { payments: { select: { id: true } } },
    });

    let staleProcessingRecovered = 0;
    let staleProcessingReset = 0;
    for (const stale of staleProcessingList) {
      if ((stale as any).payments.length > 0) {
        await this.updateAttemptStatusOutsideTx({
          attemptId: stale.id,
          fromStatus: "PROCESSING",
          toStatus: "SUCCESS",
          source: "RECONCILE",
          reason: "stale processing recovered because ledger exists",
          operationalOwnerId: stale.owner_id,
          financialOwnerId: this.isPlatformBillingAttempt(stale) ? this.hmsFinancialOwnerId() : stale.owner_id,
          hostelId: this.isPlatformBillingAttempt(stale) ? null : stale.hostel_id,
          data: { settlement_status: SETTLEMENT_STATUS.SETTLED, settled_at: new Date() },
        }).catch(() => {});
        staleProcessingRecovered++;
        await createItem({ payment_attempt_id: stale.id, anomaly_type: "STALE_PROCESSING", severity: "HIGH", action: "MARK_SUCCESS_WITH_EXISTING_LEDGER", result: "REPAIRED" });
        logger.warn("payments.reconcile.stale_processing_recovered", {
          attempt_id: stale.id, merchant_txn_id: stale.merchant_txn_id,
          payment_count: (stale as any).payments.length,
        });
      } else {
        await this.updateAttemptStatusOutsideTx({
          attemptId: stale.id,
          fromStatus: "PROCESSING",
          toStatus: "PENDING",
          source: "RECONCILE",
          reason: "stale processing without ledger reset",
          operationalOwnerId: stale.owner_id,
          financialOwnerId: this.isPlatformBillingAttempt(stale) ? this.hmsFinancialOwnerId() : stale.owner_id,
          hostelId: this.isPlatformBillingAttempt(stale) ? null : stale.hostel_id,
        }).catch(() => {});
        staleProcessingReset++;
        await createItem({ payment_attempt_id: stale.id, anomaly_type: "STALE_PROCESSING", severity: "MEDIUM", action: "RESET_TO_PENDING", result: "REPAIRED" });
        logger.warn("payments.reconcile.stale_processing_reset", {
          attempt_id: stale.id, merchant_txn_id: stale.merchant_txn_id,
        });
      }
    }

    logger.info("payments.reconcile.stale_lock_sweep", {
      pending_verification_reset: stalePendingVerificationReset,
      processing_recovered: staleProcessingRecovered,
      processing_reset: staleProcessingReset,
    });

    // ── Pass 1: Auto-expire stale CREATED attempts (no provider call needed) ──
    // CREATED = PaymentAttempt was inserted but gateway call never returned / crashed.
    // 10-minute grace window; anything older is a ghost attempt.
    const staleCreatedCutoff = new Date(now.getTime() - 10 * 60 * 1000);
    const staleCreatedList = await prisma.paymentAttempt.findMany({
      where: { status: "CREATED", created_at: { lt: staleCreatedCutoff }, ...ownerFilter, ...hostelFilter, ...domainFilter, ...idFilter },
    });
    let staleCreatedExpired = 0;
    for (const stale of staleCreatedList) {
      await this.updateAttemptStatusOutsideTx({
        attemptId: stale.id,
        fromStatus: "CREATED",
        toStatus: "EXPIRED",
        source: "RECONCILE",
        reason: "stale created attempt expired",
        operationalOwnerId: stale.owner_id,
        financialOwnerId: this.isPlatformBillingAttempt(stale) ? this.hmsFinancialOwnerId() : stale.owner_id,
        hostelId: this.isPlatformBillingAttempt(stale) ? null : stale.hostel_id,
        data: { settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
      }).then(() => { staleCreatedExpired++; }).catch(() => {});
      await createItem({ payment_attempt_id: stale.id, anomaly_type: "STALE_CREATED", severity: "LOW", action: "EXPIRE", result: "REPAIRED" });
    }

    // ── Pass 2: Auto-expire PENDING attempts past their expires_at ──
    // These are gateway-issued expiry times. Proactively mark EXPIRED without
    // hitting the provider API — the gateway already considers them invalid.
    const autoExpireList = await prisma.paymentAttempt.findMany({
      where: { status: "PENDING", expires_at: { lt: now }, ...ownerFilter, ...hostelFilter, ...domainFilter, ...idFilter },
    });
    let autoExpired = 0;
    for (const stale of autoExpireList) {
      await this.updateAttemptStatusOutsideTx({
        attemptId: stale.id,
        fromStatus: "PENDING",
        toStatus: "EXPIRED",
        source: "RECONCILE",
        reason: "attempt expired by gateway expiry",
        operationalOwnerId: stale.owner_id,
        financialOwnerId: this.isPlatformBillingAttempt(stale) ? this.hmsFinancialOwnerId() : stale.owner_id,
        hostelId: this.isPlatformBillingAttempt(stale) ? null : stale.hostel_id,
        data: { settlement_status: SETTLEMENT_STATUS.NOT_APPLICABLE },
      }).then(() => { autoExpired++; }).catch(() => {});
      await createItem({ payment_attempt_id: stale.id, anomaly_type: "STALE_PENDING", severity: "LOW", action: "EXPIRE", result: "REPAIRED" });
    }

    logger.info("payments.reconcile.sweep", {
      stale_created_expired: staleCreatedExpired,
      auto_expired_by_expiry: autoExpired,
    });

    const orphanSuccessList = await prisma.paymentAttempt.findMany({
      where: {
        status: "SUCCESS",
        OR: [{ payment_domain: PAYMENT_DOMAIN.RENT_COLLECTION }, { payment_domain: null }],
        flow_type: { notIn: [PAYMENT_FLOW.ADDON, PAYMENT_FLOW.SUBSCRIPTION, PAYMENT_FLOW.ADVANCE] },
        ...ownerFilter,
        ...hostelFilter,
        ...domainFilter,
        ...idFilter,
      },
      include: { payments: { select: { id: true } } },
    });
    let orphanSuccess = 0;
    for (const orphan of orphanSuccessList) {
      if ((orphan as any).payments.length > 0) continue;
      orphanSuccess++;
      await paymentOperationalAnomalyService.create({
        anomalyType: "ORPHAN_SUCCESS",
        severity: "CRITICAL",
        paymentDomain: (orphan as any).payment_domain || PAYMENT_DOMAIN.RENT_COLLECTION,
        flowType: (orphan as any).flow_type || PAYMENT_FLOW.RENT,
        paymentAttemptId: orphan.id,
        reconciliationRunId: run.id,
        operationalOwnerId: orphan.owner_id,
        financialOwnerId: orphan.owner_id,
        hostelId: orphan.hostel_id,
        metadata: { merchant_transaction_id: (orphan as any).merchant_transaction_id || orphan.merchant_txn_id },
      });
      await createItem({
        payment_attempt_id: orphan.id,
        anomaly_type: "ORPHAN_SUCCESS",
        severity: "CRITICAL",
        action: "DETECT_ONLY",
        result: "MANUAL_REVIEW_REQUIRED",
        operational_owner_id: orphan.owner_id,
        financial_owner_id: orphan.owner_id,
        hostel_id: orphan.hostel_id,
      });
    }

    // ── Pass 3: Query provider for remaining PENDING attempts (48h window) ──
    // 48h instead of 24h to catch delayed webhook delivery on flaky connections.
    //
    // BACKOFF: Only reconcile attempts that are at least 15 minutes old.
    // Anything younger should be resolved by a webhook or the tenant's verify
    // poll — hitting the provider API immediately wastes quota and races with
    // in-flight webhooks. Operator-supplied IDs bypass this floor so support
    // engineers can force-reconcile a specific attempt at any time.
    const pendingCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const backoffFloor = options?.attemptIds?.length
      ? new Date(0)                                      // no floor for explicit IDs
      : new Date(now.getTime() - 15 * 60 * 1000);      // 15-minute floor for sweeps
    const pending = await prisma.paymentAttempt.findMany({
      where: {
        status: "PENDING",
        created_at: { gte: pendingCutoff, lt: backoffFloor },
        ...ownerFilter,
        ...hostelFilter,
        ...domainFilter,
        ...idFilter,
      }
    });

    let success = 0;
    let failed = 0;
    let pendingCount = 0;
    let expired = 0;
    let cancelled = 0;
    let errors = 0;

    // Cache provider instances by owner + hostel + provider so multi-hostel owners
    // cannot reconcile one hostel through another hostel's merchant context.
    const providerCache = new Map<string, any>();

    for (const attempt of pending) {
      try {
        const attemptHostelId = this.isPlatformBillingAttempt(attempt)
          ? null
          : requireFinancialHostelId(attempt.hostel_id, "payment reconciliation");
        const cacheKey = [attempt.owner_id, (attempt as any).payment_domain || "LEGACY", attemptHostelId || "platform", attempt.provider].join(":");
        let instance = providerCache.get(cacheKey);
        if (!instance) {
          const pi = await this.getProviderInstanceForAttempt(attempt, "payment reconciliation");
          instance = pi.instance;
          providerCache.set(cacheKey, instance);
        }

        const fetched = await instance.fetchStatus(
          (attempt as any).merchant_transaction_id || attempt.merchant_txn_id,
          (attempt as any).provider_order_id || attempt.gateway_txn_id || undefined
        );
        await paymentProviderVerificationSnapshotService.record({
          provider: attempt.provider,
          source: "RECONCILE",
          attempt,
          reconciliationRunId: run.id,
          providerTransactionId: fetched.provider_transaction_id || null,
          providerOrderId: fetched.provider_order_id || fetched.gateway_txn_id || null,
          providerReferenceId: fetched.provider_reference_id || null,
          providerStatus: (fetched as any).provider_status || fetched.status,
          normalizedStatus: fetched.status,
          amount: (fetched as any).amount ?? null,
          rawResponse: fetched.raw_status,
        });

        // If the provider still says PENDING but expires_at has now passed
        // (may have just crossed the boundary during this reconcile run)
        let nextStatus = fetched.status;
        if (nextStatus === "PENDING" && attempt.expires_at && attempt.expires_at < now) {
          nextStatus = "EXPIRED";
        }

        const finalized = await this.finalizePaymentAttempt(
          attempt.id,
          nextStatus,
          fetched.provider_transaction_id || fetched.gateway_txn_id || undefined,
          { source: "reconcile", payload: fetched.raw_status }
        );

        const resolvedAttempt = finalized || attempt;

        if (resolvedAttempt.status === "SUCCESS") success++;
        else if (resolvedAttempt.status === "FAILED") failed++;
        else if (resolvedAttempt.status === "EXPIRED") expired++;
        else if (resolvedAttempt.status === "CANCELLED") cancelled++;
        else pendingCount++;
      } catch (error) {
        errors++;
        logger.error("payments.reconcile.failed", {
          attemptId: attempt.id,
          merchantTxnId: attempt.merchant_txn_id,
          error: String(error),
        });
      }
    }

    const summary = {
      processed: pending.length,
      stale_pending_verification_reset: stalePendingVerificationReset,
      stale_processing_recovered: staleProcessingRecovered,
      stale_processing_reset: staleProcessingReset,
      stale_created_expired: staleCreatedExpired,
      auto_expired: autoExpired,
      orphan_success: orphanSuccess,
      success,
      failed,
      pending: pendingCount,
      expired,
      cancelled,
      errors,
    };
    await (prisma as any).paymentReconciliationRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", completed_at: new Date(), summary: summary as any },
    }).catch(() => {});
    return summary;
  }

  async getPaymentDetail(obligationId: string, ownerId: string, hostelId: string) {
    const obligation = await prisma.rent_obligations.findFirst({
      where: { id: obligationId, owner_id: ownerId, hostel_id: hostelId },
      include: {
        tenants: {
          include: {
            profiles: { select: { name: true, phone: true, email: true } },
            tenant_behavior_scores: { select: { score: true } },
            room_allocations: {
              where: { is_active: true, end_date: null },
              include: { room: { select: { room_no: true, floor: true, room_type: true, floor_ref: { select: { name: true } } } } },
              take: 1,
            },
          },
        },
        payments: {
          orderBy: { payment_date: "desc" },
          include: { receipts: { select: { receipt_number: true } } },
        },
        reminder_logs: {
          orderBy: { sent_at: "asc" },
          select: { id: true, channel: true, sent_at: true, converted_to_payment: true, converted_at: true },
        },
      },
    });

    if (!obligation) throw new Error("NOT_FOUND: Obligation not found");

    const tenant = obligation.tenants;
    const profile = tenant?.profiles;
    const behaviorScore = tenant?.tenant_behavior_scores?.score ?? null;
    const allocation = tenant?.room_allocations?.[0];
    const room = allocation?.room;
    const floorLabel = room?.floor_ref?.name ?? (room?.floor != null ? `Floor ${room.floor}` : null);

    const totalPaid = obligation.payments.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);
    const totalAmount = Number(obligation.total_amount || obligation.amount || 0);
    const remaining = Math.max(0, totalAmount - totalPaid);

    return {
      id: obligation.id,
      rent_month: obligation.rent_month,
      due_date: obligation.due_date,
      status: obligation.status,
      obligation_type: obligation.obligation_type,
      total_amount: totalAmount,
      amount_paid: totalPaid,
      remaining,
      tenant: {
        id: tenant?.id ?? null,
        name: profile?.name ?? "Unknown",
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
        room_no: room?.room_no ?? "N/A",
        floor: floorLabel,
        room_type: room?.room_type ?? null,
        behavior_score: behaviorScore,
        joined_on: tenant?.joined_on ?? null,
        status: tenant?.status ?? null,
      },
      payments: obligation.payments.map((p: any) => ({
        id: p.id,
        amount_paid: Number(p.amount_paid || 0),
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
        receipt_number: p.receipts?.receipt_number ?? null,
        offline_note: p.offline_note ?? null,
        recorded_by: p.recorded_by ?? null,
        created_at: p.created_at,
      })),
      reminders: obligation.reminder_logs.map((r: any) => ({
        id: r.id,
        channel: r.channel,
        sent_at: r.sent_at,
        converted: r.converted_to_payment,
        converted_at: r.converted_at,
      })),
    };
  }
}

export const paymentService = new PaymentService();
