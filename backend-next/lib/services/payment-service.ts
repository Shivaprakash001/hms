import { prisma } from "../db";
import { eventSystem } from "../events";
import { PaymentProviderFactory } from "./payments/provider-factory";
import crypto from "crypto";
import { EmailService } from "./email-service";
import { receiptService } from "./receipt-service";

export class PaymentService {
  /**
   * Calculate prorated rent for a month.
   */
  calculateProratedRent(monthlyRent: number, startDate: Date, endDate: Date | null, targetMonth: Date): number {
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), lastDay);

    const actualStart = startDate > monthStart ? startDate : monthStart;
    const actualEnd = endDate && endDate < monthEnd ? endDate : monthEnd;

    if (actualStart > actualEnd) return 0;

    const daysOccupied = Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysOccupied >= lastDay) return monthlyRent;

    return Number(((monthlyRent * daysOccupied) / lastDay).toFixed(2));
  }

  async generateMonthlyRent(rentMonth: Date, ownerId?: string) {
    const targetMonth = new Date(rentMonth.getFullYear(), rentMonth.getMonth(), 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const monthEndDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), lastDay);

    // Find all allocations active during some part of this month
    const allocations = await prisma.roomAllocation.findMany({
      where: {
        start_date: { lte: monthEndDate },
        OR: [
          { end_date: null },
          { end_date: { gte: targetMonth } }
        ],
        ...(ownerId && { tenant: { owner_id: ownerId } })
      },
      include: { tenant: true }
    });

    let generated = 0;
    let skipped = 0;

    for (const alloc of allocations) {
      if (!alloc.tenant) continue;

      // Fallback to 0 if monthly rent is null to prevent NaN Prisma crashes
      const monthlyRent = Number(alloc.tenant.monthly_rent || 0);
      
      // Use the full monthly rent instead of prorating based on joining dates
      // to ensure consistency between the tenant profile and ledger.
      const amount = monthlyRent;

      if (isNaN(amount) || amount <= 0) continue;

      // Check for existing
      const existing = await prisma.rentObligation.findFirst({
        where: {
          tenant_id: alloc.tenant_id,
          rent_month: targetMonth,
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      const obligation = await prisma.rentObligation.create({
        data: {
          tenant_id: alloc.tenant_id,
          allocation_id: alloc.id,
          owner_id: ownerId || alloc.tenant.owner_id,
          rent_month: targetMonth,
          amount: amount,
          due_date: new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 10), // Default 10th
          status: "PENDING"
        }
      });

      generated++;
      await eventSystem.trigger("rent_obligation_created", {
        obligationId: obligation.id,
        tenantId: alloc.tenant_id,
        amount
      });
    }

    return { generated, skipped, total: allocations.length };
  }

  async previewMonthlyRent(rentMonth: Date, ownerId?: string) {
    const targetMonth = new Date(rentMonth.getFullYear(), rentMonth.getMonth(), 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const monthEndDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), lastDay);

    const allocations = await prisma.roomAllocation.findMany({
      where: {
        start_date: { lte: monthEndDate },
        OR: [
          { end_date: null },
          { end_date: { gte: targetMonth } }
        ],
        ...(ownerId && { tenant: { owner_id: ownerId } })
      },
      include: { tenant: true }
    });

    let tenantsToCreate = 0;
    let tenantsAlreadyGenerated = 0;
    let totalAmount = 0;

    for (const alloc of allocations) {
      if (!alloc.tenant) continue;

      const amount = this.calculateProratedRent(
        Number(alloc.tenant.monthly_rent),
        alloc.start_date,
        alloc.end_date,
        targetMonth
      );

      if (amount <= 0) continue;

      const existing = await prisma.rentObligation.findFirst({
        where: {
          tenant_id: alloc.tenant_id,
          rent_month: targetMonth,
        }
      });

      if (existing) {
        tenantsAlreadyGenerated++;
        continue;
      }

      tenantsToCreate++;
      totalAmount += amount;
    }

    return {
      tenants: allocations.length,
      tenants_to_create: tenantsToCreate,
      tenants_already_generated: tenantsAlreadyGenerated,
      total_amount: Number(totalAmount.toFixed(2)),
      rent_month: targetMonth.toISOString().slice(0, 10),
    };
  }

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
      const obligation = await tx.rentObligation.findUnique({
        where: { id: data.obligationId },
        include: { payments: true }
      });

      if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
      if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");

      const totalAlreadyPaid = obligation.payments.reduce((acc: number, p: any) => acc + Number(p.amount_paid), 0);
      const remaining = Number(obligation.amount) - totalAlreadyPaid;

      if (data.amountPaid > remaining) throw new Error(`BAD_REQUEST: Payment exceeds balance. Remaining: ${remaining}`);

      const payment = await tx.payment.create({
        data: {
          obligation_id: data.obligationId,
          tenant_id: obligation.tenant_id,
          owner_id: obligation.owner_id,
          amount_paid: data.amountPaid,
          payment_method: data.paymentMethod,
          reference_number: data.referenceNumber,
          payment_date: data.paymentDate || new Date(),
          payment_attempt_id: data.paymentAttemptId || null,
        }
      });

      const newTotalPaid = totalAlreadyPaid + data.amountPaid;
      const newStatus = newTotalPaid >= Number(obligation.amount) ? "PAID" : "PARTIAL";

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
      return res;
    });
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
    const hostel: any = await prisma.hostel.findFirst({
        where: { owner_id: obligation.owner_id || "" },
    });
    const prefConfig = (hostel?.preferences_config as any) || {};

    const allowPartial = prefConfig.allow_partial_payments ?? false;
    const minAmount = Number(prefConfig.min_payment_amount) || 0;

    if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");
    if (validationAmount <= 0) throw new Error("BAD_REQUEST: Obligation is already paid");

    // 2️⃣ Partial Payment Enforcement
    if (!allowPartial && validationAmount < balance) {
        throw new Error(`BAD_REQUEST: Partial payments are disabled by the owner. Full payment of ₹${balance} is required.`);
    }

    // 3️⃣ Minimum Amount Enforcement
    if (validationAmount < minAmount && validationAmount < balance) {
        throw new Error(`BAD_REQUEST: Minimum payment amount allowed is ₹${minAmount}.`);
    }

    if (validationAmount > balance) {
        throw new Error(`BAD_REQUEST: Payment (₹${validationAmount}) exceeds outstanding balance (₹${balance}).`);
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
      if (existingAttempt.checkout_url) {
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
    const attempt = await prisma.paymentAttempt.findUnique({
        where: { id: attemptId },
        include: { payments: true }
    });

    if (!attempt) throw new Error("NOT_FOUND: Attempt not found");
    if (attempt.status === "SUCCESS") return attempt;

    if (status !== "SUCCESS") {
        return await prisma.paymentAttempt.update({
            where: { id: attemptId },
            data: {
                status: status as any,
                gateway_txn_id: gatewayTxnId,
                raw_webhook_payload: rawPayload || null
            }
        });
    }

    // Success path
    if (attempt.payments.length > 0) {
        return await prisma.paymentAttempt.update({
            where: { id: attemptId },
            data: { status: "SUCCESS", gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null, confirmed_at: new Date() }
        });
    }

    const recordResult = await this.recordPayment({
        obligationId: attempt.obligation_id,
        amountPaid: Number(attempt.amount),
        paymentMethod: "UPI",
        referenceNumber: gatewayTxnId || attempt.merchant_txn_id,
        paymentDate: new Date(),
        userId: attempt.owner_id,
        paymentAttemptId: attempt.id
    });

    // Create receipt record in DB (idempotent — won't duplicate)
    // Then asynchronously generate PDF and email it
    receiptService.createReceipt(recordResult.payment.id).then(async (receipt) => {
        try {
            const pdfBuffer = receiptService.renderReceiptPdf(receipt);
            const tenant = await prisma.tenant.findUnique({
                where: { id: attempt.tenant_id },
                include: { profile: true }
            });
            
            if (tenant?.profile?.email) {
                const rentMonth = receipt.rent_month
                    ? new Date(receipt.rent_month).toLocaleString('default', { month: 'long', year: 'numeric' })
                    : 'N/A';
                await EmailService.sendReceipt({
                    toEmail: tenant.profile.email,
                    name: tenant.profile.name,
                    amount: Number(attempt.amount),
                    rentMonth,
                    reference: receipt.receipt_number,
                    pdfBuffer
                });
            }
        } catch (emailErr) {
            console.error("Failed to generate/send receipt email:", emailErr);
        }
    }).catch(err => console.error("Failed to create receipt record:", err));

    const result = await prisma.paymentAttempt.update({
        where: { id: attemptId },
        data: { status: "SUCCESS", gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null, confirmed_at: new Date() }
    });

    return result;
  }

  async handlePaymentWebhook(providerName: string, headers: any, body: any) {
    // This is complex because we need to find the correct attempt
    // For now, let's assume we can match by merchantTxnId in the provider's verifyWebhook
    const providerStr = providerName.toUpperCase();
    
    // We'll search for recent pending attempts of this provider
    const attempts = await prisma.paymentAttempt.findMany({
        where: { provider: providerStr, status: "PENDING" },
        orderBy: { created_at: "desc" },
        take: 20
    });

    console.info("[payments.webhook] received", {
      provider: providerStr,
      pendingCandidates: attempts.length,
      hasVerifyHeader: Boolean(headers?.["x-verify"] || headers?.["X-VERIFY"]),
    });

    for (const attempt of attempts) {
        const { instance } = await this.getProviderInstance(attempt.owner_id, attempt.provider);
        try {
            const verification = await instance.verifyWebhook(headers, body);
            if (verification.merchant_txn_id === attempt.merchant_txn_id) {
              if (verification.status === "SUCCESS") {
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

              console.info("[payments.webhook] matched attempt", {
                attemptId: attempt.id,
                merchantTxnId: attempt.merchant_txn_id,
                status: verification.status,
              });
                return await this.finalizePaymentAttempt(
                    attempt.id,
                    verification.status,
                    verification.gateway_txn_id || undefined,
                    verification.raw_event
                );
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error("NOT_FOUND: Matching payment attempt not found or verification failed");
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

    if (attempt.status === "SUCCESS") {
      return {
        attempt,
        status: attempt.status,
        source: "cached"
      };
    }

    const { instance } = await this.getProviderInstance(attempt.owner_id, attempt.provider);
    const fetched = await instance.fetchStatus(attempt.merchant_txn_id, gatewayTxnId || attempt.gateway_txn_id || undefined);

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

    return {
      attempt: finalized,
      status: finalized.status,
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

        if (finalized.status === "SUCCESS") success++;
        else if (finalized.status === "FAILED") failed++;
        else if (finalized.status === "EXPIRED") expired++;
        else if (finalized.status === "CANCELLED") cancelled++;
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
