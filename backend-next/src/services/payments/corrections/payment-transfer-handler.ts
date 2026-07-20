import { prisma } from "@/lib/db";
import { correctionRegistry } from "../../recovery/correction-registry";
import { reverseObligationPayment } from "./payment-correction-shared";
import { buildSettlementPlan, toObligationSnapshot } from "../settlement-planner";
import { executePlanInTx } from "../settlement-engine";
import type {
  CaseDraft,
  CorrectionCaseRecord,
  CorrectionHandler,
  ImpactReport,
  OperationContext,
} from "../../recovery/types";

interface PaymentTransferDetail {
  paymentId: string;
  toTenantId: string;
}

async function loadPayment(paymentId: string) {
  return prisma.payments.findUniqueOrThrow({
    where: { id: paymentId },
    include: { obligation: true, tenants: true },
  });
}

async function buildForwardPlan(toTenantId: string, amountRupees: number) {
  const openObligations = await prisma.rent_obligations.findMany({
    where: { tenant_id: toTenantId, lifecycle_status: "ACTIVE" },
    include: { payments: { select: { amount_paid: true } } },
  });
  const snapshots = openObligations.map((ob) =>
    toObligationSnapshot({
      id: ob.id,
      obligation_type: ob.obligation_type,
      amount: ob.amount,
      due_date: ob.due_date,
      rent_month: ob.rent_month,
      owner_id: ob.owner_id ?? "",
      payments: ob.payments,
      status: ob.status,
    })
  );
  return buildSettlementPlan(snapshots, amountRupees, { allow_partial: true, minimum_amount: 0 });
}

export const paymentTransferHandler: CorrectionHandler<PaymentTransferDetail> = {
  caseType: "PAYMENT_TRANSFER",
  domain: "PAYMENTS",
  tier: "FINANCIAL_CORRECTION",

  policy: {
    canPreview: async () => true,
    canExecute: async (kase: CorrectionCaseRecord<PaymentTransferDetail>) => {
      const payment = await prisma.payments.findUnique({ where: { id: kase.caseDetail.paymentId } });
      if (!payment) return { allowed: false, reason: "Payment no longer exists" };
      if (payment.hostel_id !== kase.hostelId) {
        return { allowed: false, reason: "Source payment does not belong to this hostel" };
      }

      const toTenant = await prisma.tenants.findUnique({ where: { id: kase.caseDetail.toTenantId } });
      if (!toTenant) return { allowed: false, reason: "Target tenant no longer exists" };
      if (toTenant.hostel_id !== kase.hostelId) {
        return { allowed: false, reason: "Target tenant belongs to a different hostel" };
      }

      const plan = await buildForwardPlan(kase.caseDetail.toTenantId, Number(payment.amount_paid));
      if (!plan.payment_accepted) {
        return { allowed: false, reason: `Target tenant cannot accept this amount: ${plan.rejection_reason}` };
      }
      return { allowed: true };
    },
  },

  async createCase(ctx: OperationContext): Promise<CaseDraft<PaymentTransferDetail>> {
    const paymentId = String(ctx.input.paymentId);
    const toTenantId = String(ctx.input.toTenantId);
    const payment = await loadPayment(paymentId);

    if (payment.hostel_id !== ctx.hostelId) {
      throw new Error(`Payment ${paymentId} does not belong to hostel ${ctx.hostelId}`);
    }

    return {
      domain: "PAYMENTS",
      tier: "FINANCIAL_CORRECTION",
      entityRefs: [
        { type: "payment", id: payment.id },
        { type: "tenant", id: payment.tenant_id },
        { type: "tenant", id: toTenantId },
      ],
      beforeSnapshot: {
        payment: { id: payment.id, amount_paid: Number(payment.amount_paid) },
        fromTenantId: payment.tenant_id,
        fromObligationId: payment.obligation_id,
      },
      caseDetail: { paymentId: payment.id, toTenantId },
      idempotencyKey: `PAYMENT_TRANSFER:${payment.id}`,
    };
  },

  async computeImpact(kase: CorrectionCaseRecord<PaymentTransferDetail>): Promise<ImpactReport> {
    const payment = await loadPayment(kase.caseDetail.paymentId);
    const plan = await buildForwardPlan(kase.caseDetail.toTenantId, Number(payment.amount_paid));

    return {
      balanceChanges: [
        { entityType: "obligation", entityId: payment.obligation_id, before: { restored: false }, after: { restored: true } },
        ...plan.allocations
          .filter((a) => a.allocated > 0)
          .map((a) => ({ entityType: "obligation", entityId: a.obligation_id, before: { allocated: 0 }, after: { allocated: a.allocated } })),
      ],
      obligationChanges: [],
      ledgerEntries: [
        { direction: "DEBIT", reason: "LEDGER_CORRECTION", amount: Number(payment.amount_paid), tenantId: payment.tenant_id },
      ],
      affectedReports: ["Owner Dashboard", "Tenant Statement"],
      notifications: [],
      warnings: plan.payment_accepted ? [] : [String(plan.rejection_reason)],
    };
  },

  async execute(tx: any, kase: CorrectionCaseRecord<PaymentTransferDetail>, actor) {
    const payment = await tx.payments.findUniqueOrThrow({ where: { id: kase.caseDetail.paymentId } });

    const reversal = await reverseObligationPayment(tx, {
      hostelId: kase.hostelId,
      payment,
      correctionCaseId: kase.id,
      actorId: actor.actorId,
      reason: kase.reason,
    });

    const openObligations = await tx.rent_obligations.findMany({
      where: { tenant_id: kase.caseDetail.toTenantId, lifecycle_status: "ACTIVE" },
      include: { payments: { select: { amount_paid: true } } },
    });
    const snapshots = openObligations.map((ob: any) =>
      toObligationSnapshot({
        id: ob.id, obligation_type: ob.obligation_type, amount: ob.amount, due_date: ob.due_date,
        rent_month: ob.rent_month, owner_id: ob.owner_id ?? "", payments: ob.payments, status: ob.status,
      })
    );
    const plan = buildSettlementPlan(snapshots, Number(payment.amount_paid), { allow_partial: true, minimum_amount: 0 });

    const settlement = await executePlanInTx(tx, plan as any, {
      hostelId: kase.hostelId,
      tenantId: kase.caseDetail.toTenantId,
      amountPaid: Number(payment.amount_paid),
      paymentMethod: payment.payment_method,
      referenceNumber: `TRANSFER:${payment.id}`,
      paymentDate: new Date(),
      idempotencyKey: `correction:${kase.id}:forward`,
      userId: actor.actorId,
      fundingSource: "NEW_PAYMENT",
    });

    return {
      reversalPaymentId: reversal.reversalPaymentId,
      forwardPaymentGroupId: settlement.paymentGroupId,
      forwardObligationIds: settlement.updatedObligationIds,
      fromObligationId: payment.obligation_id,
    };
  },

  affectedEntities(kase: CorrectionCaseRecord<PaymentTransferDetail>) {
    return kase.entityRefs;
  },
};

correctionRegistry.register(paymentTransferHandler);
