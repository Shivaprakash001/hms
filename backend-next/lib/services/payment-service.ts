import { prisma } from "../db";
import { eventSystem } from "../events";
import { PaymentProviderFactory } from "./payments/provider-factory";
import crypto from "crypto";

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
        ...(ownerId && { student: { owner_id: ownerId } })
      },
      include: { student: true }
    });

    let generated = 0;
    let skipped = 0;

    for (const alloc of allocations) {
      if (!alloc.student) continue;

      const amount = this.calculateProratedRent(
        Number(alloc.student.monthly_rent),
        alloc.start_date,
        alloc.end_date,
        targetMonth
      );

      if (amount <= 0) continue;

      // Check for existing
      const existing = await prisma.rentObligation.findFirst({
        where: {
          student_id: alloc.student_id,
          rent_month: targetMonth,
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      const obligation = await prisma.rentObligation.create({
        data: {
          student_id: alloc.student_id,
          allocation_id: alloc.id,
          owner_id: ownerId || alloc.student.owner_id,
          rent_month: targetMonth,
          amount: amount,
          due_date: new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 10), // Default 10th
          status: "PENDING"
        }
      });

      generated++;
      await eventSystem.trigger("rent_obligation_created", {
        obligationId: obligation.id,
        studentId: alloc.student_id,
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
        ...(ownerId && { student: { owner_id: ownerId } })
      },
      include: { student: true }
    });

    let tenantsToCreate = 0;
    let tenantsAlreadyGenerated = 0;
    let totalAmount = 0;

    for (const alloc of allocations) {
      if (!alloc.student) continue;

      const amount = this.calculateProratedRent(
        Number(alloc.student.monthly_rent),
        alloc.start_date,
        alloc.end_date,
        targetMonth
      );

      if (amount <= 0) continue;

      const existing = await prisma.rentObligation.findFirst({
        where: {
          student_id: alloc.student_id,
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
          student_id: obligation.student_id,
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
        paymentId: res.payment.id,
        obligationId: data.obligationId,
        amount: data.amountPaid
      });
      return res;
    });
  }

  async createPaymentIntent(obligationId: string, amount: number | null, userId: string, studentId?: string) {
    const obligation = await prisma.rentObligation.findUnique({
      where: { id: obligationId },
      include: { student: { include: { profile: true } } }
    });

    if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
    if (studentId && obligation.student_id !== studentId) {
      throw new Error("FORBIDDEN: You can only pay your own obligations");
    }

    const alreadyPaid = await this.getExistingPaidAmount(obligationId);
    const validationAmount = amount || (Number(obligation.amount) - alreadyPaid);

    if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");
    if (validationAmount <= 0) throw new Error("BAD_REQUEST: Obligation is already paid");
    if (validationAmount > (Number(obligation.amount) - alreadyPaid)) {
        throw new Error(`BAD_REQUEST: Payment exceeds balance. Remaining: ${Number(obligation.amount) - alreadyPaid}`);
    }

    // Check for existing pending attempt
    const existingAttempt = await prisma.paymentAttempt.findFirst({
        where: {
            obligation_id: obligationId,
            status: "PENDING",
            expires_at: { gte: new Date() }
        },
        orderBy: { created_at: "desc" }
    });

    if (existingAttempt) return existingAttempt;

    const { provider, config } = await this.getProviderForOwner(obligation.owner_id || "");
    const instance = PaymentProviderFactory.getProvider(provider, config);

    const merchantTxnId = `hms_${obligationId.replace(/-/g, "").substring(0, 12)}_${crypto.randomBytes(4).toString("hex")}`;

    console.info("[payments.createIntent] creating attempt", {
      obligationId,
      userId,
      studentId: studentId || null,
      provider,
      amount: validationAmount,
      merchantTxnId,
    });
    
    const attempt = await prisma.paymentAttempt.create({
        data: {
            obligation_id: obligationId,
            student_id: obligation.student_id,
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
            student_name: obligation.student.profile.name,
            student_email: obligation.student.profile.email,
            student_phone: obligation.student.profile.phone || "",
            metadata: {
                obligation_id: obligationId,
                student_id: obligation.student_id,
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

  async getPaymentAttempt(attemptId: string, userId: string, role: string, studentId?: string) {
    const attempt = await prisma.paymentAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new Error("NOT_FOUND: Payment attempt not found");

    if (role === "STUDENT" && attempt.student_id !== studentId) {
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

    await this.recordPayment({
        obligationId: attempt.obligation_id,
        amountPaid: Number(attempt.amount),
        paymentMethod: "UPI",
        referenceNumber: gatewayTxnId || attempt.merchant_txn_id,
        paymentDate: new Date(),
        userId: attempt.owner_id,
        paymentAttemptId: attempt.id
    });

    return await prisma.paymentAttempt.update({
        where: { id: attemptId },
        data: { status: "SUCCESS", gateway_txn_id: gatewayTxnId, raw_webhook_payload: rawPayload || null, confirmed_at: new Date() }
    });
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
    studentId?: string;
    attemptId?: string;
    merchantTxnId?: string;
    gatewayTxnId?: string;
  }) {
    const { userId, role, studentId, attemptId, merchantTxnId, gatewayTxnId } = params;

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

    if (role === "STUDENT" && attempt.student_id !== studentId) {
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
            ...(status ? { status: status as any } : { status: { not: "PAID" } })
        },
        include: {
            student: { include: { profile: true } },
            allocation: { include: { room: true } }
        },
        orderBy: { rent_month: "desc" }
    });

    return dues.map((d: any) => ({
        obligation_id: d.id,
        student_id: d.student_id,
        student_name: d.student.profile.name,
        student_email: d.student.profile.email,
        student_phone: d.student.profile.phone,
        room_no: d.allocation?.room?.room_no || "N/A",
        rent_month: d.rent_month,
        due_date: d.due_date,
        amount: Number(d.amount),
        status: d.status,
        outstanding: Math.max(0, Number(d.amount) - (d.payments?.reduce((s: number, p: any) => s + Number(p.amount_paid), 0) || 0))
    }));
  }

  async getAllPayments(ownerId: string, limit: number = 50, offset: number = 0) {
    const [payments, total] = await Promise.all([
        prisma.payment.findMany({
            where: { owner_id: ownerId },
            include: {
                student: { include: { profile: true } },
                obligation: true
            },
            orderBy: { payment_date: "desc" },
            take: limit,
            skip: offset
        }),
        prisma.payment.count({ where: { owner_id: ownerId } })
    ]);

    return {
        payments: payments.map((p: any) => ({
            ...p,
            student_name: p.student.profile.name,
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
    // For now, defaulting to PhonePe as requested, using env vars if db config missing
    // In production, we'd fetch this from a table
    const hostel = await prisma.hostel.findFirst({ where: { owner_id: ownerId } });
    
    // Mocking config resolution similar to Python
    return {
        provider: "PHONEPE",
        config: {
            base_url: process.env.PHONEPE_BASE_URL || "https://api.phonepe.com/apis/pg",
            bearer_token: process.env.PHONEPE_BEARER_TOKEN,
            salt_key: process.env.PHONEPE_SALT_KEY,
            salt_index: process.env.PHONEPE_SALT_INDEX,
            merchant_id: hostel?.phonepe_merchant_id || process.env.PHONEPE_MERCHANT_ID,
            redirect_url: process.env.PHONEPE_REDIRECT_URL,
            callback_url: process.env.PHONEPE_CALLBACK_URL,
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

  async getStudentPaymentHistory(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        obligations: {
          orderBy: { due_date: "desc" },
          include: { payments: { orderBy: { payment_date: "desc" } } }
        }
      }
    });

    if (!student) throw new Error("NOT_FOUND: Student not found");

    let totalDue = 0;
    let totalPaid = 0;
    const allPayments: any[] = [];
    const formattedObligations = student.obligations.map((o: any) => {
      const obligationPaid = o.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
      const remainingDue = Math.max(0, Number(o.amount) - obligationPaid);
      
      if (o.status !== "WAIVED") totalDue += Number(o.amount);
      totalPaid += obligationPaid;
      
      o.payments.forEach((p: any) => allPayments.push(p));

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
          method: p.payment_method
        }))
      };
    });

    return {
      student_id: studentId,
      obligations: formattedObligations,
      payments: allPayments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
      total_due: totalDue,
      total_paid: totalPaid,
      outstanding_balance: Math.max(totalDue - totalPaid, 0)
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
