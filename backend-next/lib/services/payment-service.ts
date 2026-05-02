import { prisma } from "../db";
import { eventSystem } from "../events";
import { PaymentProviderFactory } from "./payments/provider-factory";
import crypto from "crypto";
import { EmailService } from "./email-service";
import { receiptService } from "./receipt-service";
import { getPreferences } from "../preferences";
import { formatCurrency, formatMonthYear } from "../format";
import { eventLog } from "./event-log-service";
import { logger } from "../logger";
import { incrementPayment, incrementWebhook } from "../metrics";

export class PaymentService {
  // 🔧 FIX C1: Old calculateProratedRent, generateMonthlyRent, previewMonthlyRent DELETED.
  // These were a split-brain duplicate of RentGenerationService with different rules:
  //   - No lock, no P2002 catch, hardcoded due day to 10th, local time instead of UTC.
  // Use rentGenerationService (lib/services/rent-generation-service.ts) exclusively.

  async recordPayment(data: {
    obligationId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
    userId?: string;
    paymentAttemptId?: string;
  }) {
    return prisma.$transaction(async (tx: any) => {
      // Row-level lock on this specific obligation — prevents concurrent double-pay
      await tx.$queryRaw`
        SELECT id FROM rent_obligations WHERE id = ${data.obligationId}::uuid FOR UPDATE
      `;

      const obligation = await tx.rentObligation.findUnique({
        where: { id: data.obligationId },
        include: { payments: { select: { amount_paid: true } } }
      });

      if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
      if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");
      if (obligation.status === "PAID") throw new Error("BAD_REQUEST: Obligation already fully paid");

      // Paisa-safe arithmetic
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

      const payment = await tx.payment.create({
        data: {
          obligation_id: data.obligationId,
          tenant_id: obligation.tenant_id,
          owner_id: obligation.owner_id,
          amount_paid: paymentPaisa / 100,
          payment_method: data.paymentMethod,
          reference_number: data.referenceNumber,
          payment_date: data.paymentDate || new Date(),
          payment_attempt_id: data.paymentAttemptId || null,
        }
      });

      const newTotalPaidPaisa = totalAlreadyPaidPaisa + paymentPaisa;
      const newStatus = newTotalPaidPaisa >= obligationPaisa ? "PAID" : "PARTIAL";

      await tx.rentObligation.update({
        where: { id: data.obligationId },
        data: { status: newStatus }
      });

      return { payment, newStatus };
    }).then(async (res: any) => {
      await eventSystem.trigger("payment_recorded", {
        payment_id: res.payment.id,
        obligation_id: data.obligationId,
        tenant_id: res.payment.tenant_id,
        owner_id: res.payment.owner_id,
        amount: data.amountPaid,
        method: data.paymentMethod
      });

      // 🔧 FIX C3: Create receipt for ALL payment paths (manual + UPI)
      // Previously only the UPI finalization path created receipts.
      // Cash/manual payments (majority of hostel payments) were invisible to the receipt system.
      receiptService.createReceipt(res.payment.id).then(async (receipt) => {
        try {
          const prefs = await getPreferences(res.payment.owner_id || "");
          if (!prefs.auto_email_receipt) return;

          const renderContext = receipt._renderContext || {
            footer: prefs.receipt_footer || null,
            currency: prefs.currency,
            timezone: prefs.timezone,
          };
          const pdfBuffer = await receiptService.renderReceiptPdf(receipt, renderContext);
          const tenant = await prisma.tenant.findUnique({
            where: { id: res.payment.tenant_id },
            include: { profile: true },
          });
          if (tenant?.profile?.email) {
            const rentMonth = formatMonthYear(receipt.rent_month, prefs);
            await EmailService.sendReceipt({
              toEmail: tenant.profile.email,
              name: tenant.profile.name,
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
    tenantId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
    userId?: string;
    paymentAttemptId?: string;
    idempotencyKey?: string;
  }) {
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
      const existing = await prisma.payment.findFirst({
        where: { idempotency_key: data.idempotencyKey },
        select: { payment_group_id: true, amount_paid: true, created_at: true },
      });
      if (existing) {
        console.info(`[PAYMENT] Idempotent skip: key=${data.idempotencyKey}, group=${existing.payment_group_id}`);
        // Return the existing group's data
        const groupPayments = await prisma.payment.findMany({
          where: { payment_group_id: existing.payment_group_id! },
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
          AND status IN ('PENDING', 'PARTIAL')
        ORDER BY due_date ASC
        FOR UPDATE
      `;

      if (lockedRows.length === 0) {
        throw new Error("BAD_REQUEST: No unpaid obligations found for this tenant");
      }

      // Now read the full data (rows are locked, safe from concurrent modification)
      const obligations = await tx.rentObligation.findMany({
        where: { id: { in: lockedRows.map(r => r.id) } },
        include: { payments: { select: { amount_paid: true } } },
        orderBy: { due_date: "asc" },
      });

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

      // Reject overpayment
      if (amountPaisa > totalDuePaisa) {
        throw new Error(
          `BAD_REQUEST: Payment (${(amountPaisa / 100).toFixed(2)}) exceeds total due (${(totalDuePaisa / 100).toFixed(2)})`
        );
      }

      // ── 4. FIFO ALLOCATION ──
      let remainingPaisa = amountPaisa;
      const allocations: any[] = [];

      for (const { ob, paidPaisa, duePaisa, outstandingPaisa } of obData) {
        if (remainingPaisa <= 0) break;
        if (outstandingPaisa <= 0) continue;

        const allocPaisa = Math.min(remainingPaisa, outstandingPaisa);
        const allocRupees = allocPaisa / 100;

        const payment = await tx.payment.create({
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
          },
        });

        const newTotalPaidPaisa = paidPaisa + allocPaisa;
        const newStatus = newTotalPaidPaisa >= duePaisa ? "PAID" : "PARTIAL";

        await tx.rentObligation.update({
          where: { id: ob.id },
          data: { status: newStatus },
        });

        allocations.push({
          payment_id: payment.id,
          obligation_id: ob.id,
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
    const obligations = await prisma.rentObligation.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      include: {
        payments: { select: { amount_paid: true } },
        allocation: { include: { room: { select: { room_no: true } } } },
      },
      orderBy: [{ due_date: "asc" }],
    });

    const items = obligations.map((ob: any) => {
      const paid = ob.payments.reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
      const outstanding = Math.max(Number(ob.amount) - paid, 0);
      return {
        obligation_id: ob.id,
        type: ob.obligation_type,
        rent_month: ob.rent_month,
        due_date: ob.due_date,
        amount: Number(ob.amount),
        paid,
        outstanding,
        status: ob.status,
        room_no: ob.allocation?.room?.room_no || null,
      };
    });

    const totalDue = items.reduce((s, i) => s + i.outstanding, 0);
    const rentDue = items.filter(i => i.type === "RENT").reduce((s, i) => s + i.outstanding, 0);
    const lateFeesDue = items.filter(i => i.type === "LATE_FEE").reduce((s, i) => s + i.outstanding, 0);

    return {
      tenant_id: tenantId,
      items,
      total_due: totalDue,
      rent_due: rentDue,
      late_fees_due: lateFeesDue,
      obligation_count: items.length,
    };
  }

  async createPaymentIntent(obligationId: string, amount: number | null, userId: string, tenantId?: string) {
    const obligation = await prisma.rentObligation.findUnique({
      where: { id: obligationId },
      include: { tenant: { include: { profile: true } } }
    });

    if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
    if (tenantId && obligation.tenant_id !== tenantId) {
      throw new Error("FORBIDDEN: You can only pay your own obligations");
    }

    const alreadyPaid = await this.getExistingPaidAmount(obligationId);
    const balance = Number(obligation.amount) - alreadyPaid;
    const validationAmount = amount || balance;

    // 1️⃣ Fetch Owner Preferences for Payment Rules
    const prefs = await getPreferences(obligation.owner_id || "");

    const allowPartial = prefs.allow_partial_payments;
    const minAmount = prefs.min_payment_amount;

    if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");
    if (validationAmount <= 0) throw new Error("BAD_REQUEST: Obligation is already paid");

    // 2️⃣ Partial Payment Enforcement
    if (!allowPartial && validationAmount < balance) {
      throw new Error(`BAD_REQUEST: Partial payments are disabled by the owner. Full payment of ${formatCurrency(balance)} is required.`);
    }

    // 3️⃣ Minimum Amount Enforcement
    if (validationAmount < minAmount && validationAmount < balance) {
      throw new Error(`BAD_REQUEST: Minimum payment amount allowed is ${formatCurrency(minAmount)}.`);
    }

    if (validationAmount > balance) {
      throw new Error(`BAD_REQUEST: Payment (${formatCurrency(validationAmount)}) exceeds outstanding balance (${formatCurrency(balance)}).`);
    }

    // Check for existing pending or newly created attempt
    const existingAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        obligation_id: obligationId,
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
      if (checkoutUrl && !checkoutUrl.includes("/payment-return")) {
        return existingAttempt;
      }
      // Otherwise expire the stale attempt so we create a fresh one with checkout_url
      await prisma.paymentAttempt.update({
        where: { id: existingAttempt.id },
        data: { status: "EXPIRED" }
      });
    }

    const { provider, config } = await this.getProviderForOwner(obligation.owner_id || "");
    const instance = PaymentProviderFactory.getProvider(provider, config);

    const merchantTxnId = `hms_${obligationId.replace(/-/g, "").substring(0, 12)}_${crypto.randomBytes(4).toString("hex")}`;

    console.info("[payments.createIntent] creating attempt", {
      obligationId,
      userId,
      tenantId: tenantId || null,
      provider,
      amount: validationAmount,
      merchantTxnId,
    });

    const attempt = await prisma.paymentAttempt.create({
      data: {
        obligation_id: obligationId,
        tenant_id: obligation.tenant_id,
        owner_id: obligation.owner_id || "",
        provider: provider,
        merchant_txn_id: merchantTxnId,
        amount: validationAmount,
        status: "CREATED"
      }
    });

    try {
      const result = await instance.createIntent({
        amount: validationAmount,
        merchant_txn_id: merchantTxnId,
        tenant_name: obligation.tenant.profile.name,
        tenant_email: obligation.tenant.profile.email,
        tenant_phone: obligation.tenant.profile.phone || "",
        metadata: {
          obligation_id: obligationId,
          tenant_id: obligation.tenant_id,
          attempt_id: attempt.id
        }
      });

      return await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "PENDING",
          gateway_txn_id: result.gateway_txn_id,
          upi_intent_url: result.upi_intent_url,
          qr_payload: result.qr_payload,
          checkout_url: result.checkout_url,
          expires_at: result.expires_at,
          raw_create_response: result.raw_response as any
        }
      });
    } catch (error) {
      console.error("[payments.createIntent] provider create failed", {
        attemptId: attempt.id,
        provider,
        merchantTxnId,
        error: String(error),
      });
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", raw_create_response: { error: String(error) } as any }
      });
      throw error;
    }
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

  async finalizePaymentAttempt(attemptId: string, status: string, gatewayTxnId?: string, rawPayload?: any) {
    // 1. Use atomic update to prevent double-crediting race conditions
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      include: { payments: true, invoice: true }
    });

    if (!attempt) throw new Error("NOT_FOUND: Attempt not found");
    if (attempt.status === "SUCCESS" || attempt.status === "FAILED") return attempt;

    // ──────────────────────────────────────────────────────────────
    // 🧾 BILLING PATH: Invoice payment (plan upgrade/renewal)
    // ──────────────────────────────────────────────────────────────
    if (attempt.invoice_id && attempt.invoice) {
      const invoice = attempt.invoice;

      // SAFETY 1: Idempotency — if invoice already PAID, do nothing
      if (invoice.status === "PAID") {
        console.info(`[billing.webhook] Invoice ${invoice.id} already PAID, skipping`);
        if (attempt.status === "PENDING") {
          await prisma.paymentAttempt.update({
            where: { id: attemptId, status: "PENDING" },
            data: { status: "SUCCESS", gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null, confirmed_at: new Date() }
          }).catch(() => {});
        }
        return attempt;
      }

      // SAFETY 2: Non-SUCCESS statuses → mark attempt but leave invoice PENDING
      if (status !== "SUCCESS") {
        console.info(`[billing.webhook] Invoice payment ${attemptId} status=${status}, not activating`);
        return await prisma.paymentAttempt.update({
          where: { id: attemptId, status: "PENDING" },
          data: { status: status as any, gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null }
        }).catch(() => attempt);
      }

      // SAFETY 3: Validate amount match (paisa-safe)
      const attemptPaisa = Math.round(Number(attempt.amount) * 100);
      const invoicePaisa = invoice.amount_paise;
      if (attemptPaisa !== invoicePaisa) {
        console.error(`[billing.webhook] Amount mismatch: attempt=${attemptPaisa} invoice=${invoicePaisa}`);
        throw new Error(`VALIDATION_ERROR: Payment amount (${attemptPaisa}) does not match invoice (${invoicePaisa})`);
      }

      // SAFETY 4: Validate owner match
      if (attempt.owner_id !== invoice.owner_id) {
        console.error(`[billing.webhook] Owner mismatch: attempt=${attempt.owner_id} invoice=${invoice.owner_id}`);
        throw new Error(`SECURITY_ERROR: Payment owner does not match invoice owner`);
      }

      // SAFETY 5: Ensure invoice has plan_id (required for activation)
      if (!invoice.plan_id) {
        throw new Error(`VALIDATION_ERROR: Invoice ${invoice.id} missing plan_id, cannot activate subscription`);
      }

      // SAFETY 6: Reject expired invoices
      const now = new Date();
      if (invoice.expires_at && invoice.expires_at < now) {
        console.error(`[billing.webhook] Invoice ${invoice.id} expired at ${invoice.expires_at.toISOString()}`);
        await prisma.paymentAttempt.update({
          where: { id: attemptId },
          data: { status: "FAILED", raw_webhook_payload: rawPayload || null }
        }).catch(() => {});
        throw new Error(`VALIDATION_ERROR: Invoice expired on ${invoice.expires_at.toISOString()}. Payment rejected.`);
      }

      // ── Atomic transaction: mark invoice PAID + activate/extend subscription ──
      await prisma.$transaction(async (tx) => {
        // Mark invoice PAID (idempotent WHERE clause)
        const updated = await tx.ownerInvoice.updateMany({
          where: { id: invoice.id, status: "PENDING" },
          data: { status: "PAID", paid_at: new Date() }
        });

        if (updated.count === 0) {
          console.warn(`[billing.webhook] Invoice ${invoice.id} already processed by another webhook`);
          return; // Race condition: another webhook already marked it PAID
        }

        // CONCURRENCY SAFETY: Lock subscription row to serialize concurrent updates
        // This prevents race conditions where two webhooks read the same end_date
        // and both calculate the same new end_date, causing one month to be lost.
        await tx.$queryRaw`
          SELECT id FROM owner_subscriptions
          WHERE owner_id = ${invoice.owner_id}::uuid
          FOR UPDATE
        `;

        // Fetch current subscription (now locked for this transaction)
        const currentSub = await tx.ownerSubscription.findUnique({
          where: { owner_id: invoice.owner_id }
        });

        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (currentSub && currentSub.status === "ACTIVE" && currentSub.end_date) {
          // EXTEND from current end_date (not from now)
          startDate = currentSub.start_date;
          const currentEnd = new Date(currentSub.end_date);
          const effectiveStart = currentEnd > now ? currentEnd : now;
          endDate = new Date(Date.UTC(
            effectiveStart.getUTCFullYear(),
            effectiveStart.getUTCMonth() + 1,
            effectiveStart.getUTCDate()
          ));
        } else {
          // NEW or EXPIRED subscription: start now
          startDate = now;
          endDate = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            now.getUTCDate()
          ));
        }

        // Upsert subscription (single-owner invariant)
        await tx.ownerSubscription.upsert({
          where: { owner_id: invoice.owner_id },
          update: {
            plan_id: invoice.plan_id!,
            status: "ACTIVE",
            start_date: startDate,
            end_date: endDate,
            auto_renew: true,
            updated_at: now
          },
          create: {
            owner_id: invoice.owner_id,
            plan_id: invoice.plan_id!,
            status: "ACTIVE",
            start_date: startDate,
            end_date: endDate,
            auto_renew: true
          }
        });

        // Mark attempt SUCCESS
        await tx.paymentAttempt.update({
          where: { id: attemptId, status: "PENDING" },
          data: {
            status: "SUCCESS",
            gateway_txn_id: gatewayTxnId,
            raw_webhook_payload: rawPayload || null,
            confirmed_at: now
          }
        }).catch(() => {}); // Idempotent: ignore if already SUCCESS

        console.info(`[billing.webhook] Subscription activated: owner=${invoice.owner_id} plan=${invoice.plan_id} end=${endDate.toISOString()}`);
      });

      // Audit logging for billing events
      await eventLog.log("INVOICE_PAID", invoice.owner_id, {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount_paise: invoice.amount_paise,
        plan_id: invoice.plan_id,
        payment_attempt_id: attemptId,
        gateway_txn_id: gatewayTxnId
      });

      await eventLog.log("SUBSCRIPTION_ACTIVATED", invoice.owner_id, {
        plan_id: invoice.plan_id,
        invoice_id: invoice.id,
        start_date: (await prisma.ownerSubscription.findUnique({ where: { owner_id: invoice.owner_id } }))?.start_date,
        end_date: (await prisma.ownerSubscription.findUnique({ where: { owner_id: invoice.owner_id } }))?.end_date,
        status: "ACTIVE"
      });

      return await prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    }

    // ──────────────────────────────────────────────────────────────
    // 💰 RENT PATH: Obligation payment (existing logic)
    // ──────────────────────────────────────────────────────────────

    if (status !== "SUCCESS") {
      // Atomic status transition
      return await prisma.paymentAttempt.update({
        where: { id: attemptId, status: "PENDING" },
        data: {
          status: status as any,
          gateway_txn_id: gatewayTxnId,
          raw_webhook_payload: rawPayload || null
        }
      }).catch(e => attempt); // Return existing if race condition already updated it
    }

    // Success path - atomic transition
    let updatedAttempt;
    try {
      updatedAttempt = await prisma.paymentAttempt.update({
        where: { id: attemptId, status: "PENDING" },
        data: { status: "SUCCESS", gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null, confirmed_at: new Date() }
      });
    } catch (e) {
      console.warn(`[payments] Race condition mitigated for attempt ${attemptId}`);
      return attempt; // Already updated by another thread
    }

    if (attempt.payments.length > 0) {
      return updatedAttempt;
    }

    const recordResult = await this.recordPayment({
      obligationId: attempt.obligation_id!, // rent path: guaranteed by XOR constraint
      amountPaid: Number(attempt.amount),
      paymentMethod: "UPI",
      referenceNumber: gatewayTxnId || attempt.merchant_txn_id,
      paymentDate: new Date(),
      userId: attempt.owner_id,
      paymentAttemptId: attempt.id
    });

    // 🔧 Receipt creation now handled inside recordPayment() (FIX C3).
    // createReceipt is idempotent, so the centralized call covers both UPI and manual paths.

    const result = await prisma.paymentAttempt.update({
      where: { id: attemptId },
      data: { status: "SUCCESS", gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null, confirmed_at: new Date() }
    });

    return result;
  }

  async handlePaymentWebhook(providerName: string, headers: any, body: any) {
    const providerStr = providerName.toUpperCase();
    
    // Instead of searching top 20 pending attempts, we MUST extract the merchantOrderId directly
    // since we know it's a PhonePe webhook and the format.
    let merchantOrderId: string | null = null;
    
    try {
      let parsed = body;
      if (typeof body === "string") parsed = JSON.parse(body);
      merchantOrderId = parsed?.payload?.merchantOrderId || null;
    } catch (e) {
      console.warn("[payments.webhook] Could not extract merchantOrderId from body", e);
    }

    if (!merchantOrderId) {
      throw new Error("BAD_REQUEST: Webhook payload missing merchantOrderId");
    }

    // Direct lookup - O(1) and safe
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { merchant_txn_id: merchantOrderId }
    });

    if (!attempt) {
      throw new Error(`NOT_FOUND: Payment attempt not found for merchant_txn_id: ${merchantOrderId}`);
    }

    if (attempt.provider !== providerStr) {
      throw new Error(`BAD_REQUEST: Webhook provider ${providerStr} does not match attempt provider ${attempt.provider}`);
    }

    // Idempotency check
    if (attempt.status !== "PENDING") {
      console.info("[payments.webhook] attempt already processed", {
        attemptId: attempt.id,
        status: attempt.status,
      });
      incrementWebhook(true); // Already processed, not an error
      return { success: true, message: `Attempt already in ${attempt.status} state` };
    }

    console.info("[payments.webhook] received matching attempt", {
      provider: providerStr,
      attemptId: attempt.id,
      merchantTxnId: attempt.merchant_txn_id,
      hasVerifyHeader: Boolean(headers?.["x-verify"] || headers?.["X-VERIFY"]),
    });

    const { instance } = await this.getProviderInstance(attempt.owner_id, attempt.provider);
    
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
    
    if (sourceOfTruth.status === "PENDING" && verification.status === "SUCCESS") {
      throw new Error(`SECURITY_ERROR: Webhook claimed SUCCESS but Provider API claims PENDING for ${attempt.merchant_txn_id}`);
    }

    const finalStatus = sourceOfTruth.status !== "PENDING" ? sourceOfTruth.status : verification.status;

    if (finalStatus === "SUCCESS") {
      const expectedPaise = Math.round(Number(attempt.amount) * 100);
      const receivedPaise =
        verification.amount == null ? null : Math.round(Number(verification.amount) * 100);

      if (receivedPaise == null || receivedPaise !== expectedPaise) {
        console.error("[payments.webhook] amount mismatch", {
          attemptId: attempt.id,
          merchantTxnId: attempt.merchant_txn_id,
          expectedAmount: Number(attempt.amount),
          receivedAmount: verification.amount ?? null,
        });
        throw new Error("BAD_REQUEST: Webhook amount does not match payment attempt");
      }
    }

    console.info("[payments.webhook] matched attempt successfully", {
      attemptId: attempt.id,
      merchantTxnId: attempt.merchant_txn_id,
      status: verification.status,
    });
    
    incrementWebhook(true);
    incrementPayment("success");
    
    return await this.finalizePaymentAttempt(
      attempt.id,
      finalStatus,
      sourceOfTruth.gateway_txn_id || verification.gateway_txn_id || undefined,
      verification.raw_event
    );
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
          ...(merchantTxnId ? [{ merchant_txn_id: merchantTxnId }] : []),
          ...(gatewayTxnId ? [{ gateway_txn_id: gatewayTxnId }] : []),
        ]
      }
    });

    if (!attempt) throw new Error("NOT_FOUND: Payment attempt not found");

    if (role === "TENANT" && attempt.tenant_id !== tenantId) {
      throw new Error("FORBIDDEN: You can only verify your own attempts");
    }
    if (role === "OWNER" && attempt.owner_id !== userId) {
      throw new Error("FORBIDDEN: You can only verify attempts for your hostel");
    }

    if (["SUCCESS", "FAILED", "EXPIRED", "CANCELLED"].includes(attempt.status)) {
      return {
        attempt,
        status: attempt.status,
        source: "cached"
      };
    }

    const { instance } = await this.getProviderInstance(attempt.owner_id, attempt.provider);
    let fetched;

    try {
      fetched = await instance.fetchStatus(attempt.merchant_txn_id, gatewayTxnId || attempt.gateway_txn_id || undefined);
    } catch (error) {
      console.error("[payments.verify] provider status fetch failed", {
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

    console.info("[payments.verify] fetched status", {
      attemptId: attempt.id,
      merchantTxnId: attempt.merchant_txn_id,
      fromStatus: attempt.status,
      fetchedStatus: fetched.status,
      provider: attempt.provider,
    });

    const finalized = await this.finalizePaymentAttempt(
      attempt.id,
      fetched.status,
      fetched.gateway_txn_id || undefined,
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
    const existingPayments = await prisma.payment.findMany({ where: { obligation_id: obligationId } });
    if (existingPayments.length > 0) throw new Error("BAD_REQUEST: Cannot waive an obligation with payments");

    const obligation = await prisma.rentObligation.update({
      where: { id: obligationId },
      data: { status: "WAIVED" }
    });

    await eventSystem.trigger("rent_waived", { obligationId, userId });
    return obligation;
  }

  async getDuesReport(ownerId: string, rentMonth?: Date, status?: string) {
    const dues = await prisma.rentObligation.findMany({
      where: {
        owner_id: ownerId,
        ...(rentMonth && { rent_month: rentMonth }),
        ...(status ? { status: status as any } : {})
      },
      include: {
        tenant: { include: { profile: true } },
        allocation: { include: { room: true } },
        payments: true
      },
      orderBy: { rent_month: "desc" }
    });

    return dues.map((d: any) => ({
      obligation_id: d.id,
      tenant_id: d.tenant_id,
      tenant_name: d.tenant.profile.name,
      tenant_email: d.tenant.profile.email,
      tenant_phone: d.tenant.profile.phone,
      room_no: d.allocation?.room?.room_no || "N/A",
      rent_month: d.rent_month,
      due_date: d.due_date,
      amount: Number(d.amount),
      status: d.status,
      outstanding: Math.max(0, Number(d.amount) - (d.payments?.reduce((s: number, p: any) => s + Number(p.amount_paid), 0) || 0))
    }));
  }

  async getAllPayments(ownerId: string, limit: number = 50, offset: number = 0, tenantId?: string) {
    const where: any = {
      owner_id: ownerId,
      ...(tenantId ? { tenant_id: tenantId } : {})
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          tenant: { include: { profile: true } },
          obligation: true
        },
        orderBy: { payment_date: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.payment.count({ where })
    ]);

    return {
      payments: payments.map((p: any) => ({
        ...p,
        tenant_name: p.tenant.profile.name,
        rent_month: p.obligation.rent_month
      })),
      total
    };
  }

  private async getExistingPaidAmount(obligationId: string): Promise<number> {
    const payments = await prisma.payment.findMany({
      where: { obligation_id: obligationId },
      select: { amount_paid: true }
    });
    return payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
  }

  private async getProviderForOwner(ownerId: string) {
    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: ownerId },
      include: { owner: true },
    });

    if (!hostel) {
      throw new Error("CONFIG_ERROR: No hostel found for this owner. Please set up your hostel first.");
    }

    if (!hostel.upi_id) {
      throw new Error("CONFIG_ERROR: Owner UPI ID is not configured. Please set your UPI ID in hostel settings.");
    }

    // UPI Direct provider — tenant pays owner directly via UPI intent link
    return {
      provider: "PHONEPE", // Provider class name kept for backward compat with existing attempts table
      config: {
        owner_upi_id: hostel.upi_id,
        owner_name: hostel.name || hostel.owner?.name || "Hostel",
        hostel_id: hostel.id,
      }
    };
  }

  private async getProviderInstance(ownerId: string, providerName: string) {
    const { config } = await this.getProviderForOwner(ownerId);
    return {
      instance: PaymentProviderFactory.getProvider(providerName, config),
      config
    };
  }

  async getTenantPaymentHistory(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        allocations: {
          where: { is_active: true, end_date: null },
          include: { room: true },
          orderBy: { created_at: "desc" }
        },
        obligations: {
          orderBy: { due_date: "desc" },
          include: {
            payments: {
              include: { attempt: true },
              orderBy: { payment_date: "desc" }
            }
          }
        }
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");

    let totalDue = 0;
    let totalPaid = 0;
    const allPayments: any[] = [];

    // Sort obligations to find earliest unpaid reliably
    const latestUnpaidDueDate = tenant.obligations
      .filter((o: any) => o.status === "PENDING" || o.status === "PARTIAL")
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]?.due_date || null;

    const formattedObligations = tenant.obligations.map((o: any) => {
      const obligationPaid = o.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
      const remainingDue = Math.max(0, Number(o.amount) - obligationPaid);

      if (o.status !== "WAIVED") totalDue += Number(o.amount);
      totalPaid += obligationPaid;
      o.payments.forEach((p: any) => {
        allPayments.push({
          id: p.id,
          obligation_id: p.obligation_id,
          amount_paid: Number(p.amount_paid),
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          reference_number: p.reference_number,
          transaction_id: p.reference_number || p.attempt?.gateway_txn_id || p.attempt?.merchant_txn_id || p.id,
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
          transaction_id: p.reference_number || p.attempt?.gateway_txn_id || p.attempt?.merchant_txn_id || p.id
        }))
      };
    });

    const outstandingBalance = Math.max(totalDue - totalPaid, 0);
    const paymentStatus = outstandingBalance <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "PENDING";
    const allocationRent = Number(tenant.allocations?.[0]?.room?.base_rent || 0);
    const fallbackObligationRent = Number(tenant.obligations?.[0]?.amount || 0);
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
    attemptIds?: string[];
  }) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pending = await prisma.paymentAttempt.findMany({
      where: {
        status: "PENDING",
        created_at: { gte: cutoff },
        ...(options?.ownerId ? { owner_id: options.ownerId } : {}),
        ...(options?.attemptIds?.length
          ? {
            OR: [
              { id: { in: options.attemptIds } },
              { merchant_txn_id: { in: options.attemptIds } },
              { gateway_txn_id: { in: options.attemptIds } },
            ]
          }
          : {})
      }
    });

    let success = 0;
    let failed = 0;
    let pendingCount = 0;
    let expired = 0;
    let cancelled = 0;
    let errors = 0;

    for (const attempt of pending) {
      try {
        const { instance } = await this.getProviderInstance(attempt.owner_id, attempt.provider);
        const fetched = await instance.fetchStatus(attempt.merchant_txn_id, attempt.gateway_txn_id || undefined);

        let nextStatus = fetched.status;
        if (nextStatus === "PENDING" && attempt.expires_at && attempt.expires_at < new Date()) {
          nextStatus = "EXPIRED";
        }

        const finalized = await this.finalizePaymentAttempt(
          attempt.id,
          nextStatus,
          fetched.gateway_txn_id || undefined,
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
        console.error("[payments.reconcile] failed to reconcile attempt", {
          attemptId: attempt.id,
          merchantTxnId: attempt.merchant_txn_id,
          error: String(error),
        });
      }
    }

    return {
      processed: pending.length,
      success,
      failed,
      pending: pendingCount,
      expired,
      cancelled,
      errors,
    };
  }
}

export const paymentService = new PaymentService();
