import { prisma } from "@/lib/db";
import crypto from "crypto";
import { correctionRegistry } from "../../recovery/correction-registry";
import type {
  CaseDraft,
  CorrectionCaseRecord,
  CorrectionHandler,
  ImpactReport,
  OperationContext,
} from "../../recovery/types";

interface ReferenceEditDetail {
  paymentGroupId: string;
  referenceNumber?: string;
  notes?: string;
}

export const referenceEditHandler: CorrectionHandler<ReferenceEditDetail> = {
  caseType: "PAYMENT_REFERENCE_EDIT",
  domain: "PAYMENTS",
  tier: "FINANCIAL_CORRECTION",

  policy: {
    canPreview: async () => true,
    canExecute: async (kase: CorrectionCaseRecord<ReferenceEditDetail>) => {
      const group = await prisma.payment_groups.findUnique({ where: { id: kase.caseDetail.paymentGroupId } });
      if (!group) return { allowed: false, reason: "Payment group no longer exists" };
      if (group.hostel_id !== kase.hostelId) return { allowed: false, reason: "Payment group belongs to a different hostel" };
      return { allowed: true };
    },
  },

  async createCase(ctx: OperationContext): Promise<CaseDraft<ReferenceEditDetail>> {
    const paymentGroupId = String(ctx.input.paymentGroupId);
    const group = await prisma.payment_groups.findUniqueOrThrow({ where: { id: paymentGroupId } });

    if (group.hostel_id !== ctx.hostelId) {
      throw new Error(`Payment group ${paymentGroupId} does not belong to hostel ${ctx.hostelId}`);
    }

    return {
      domain: "PAYMENTS",
      tier: "FINANCIAL_CORRECTION",
      entityRefs: [{ type: "payment_group", id: group.id }],
      beforeSnapshot: { reference_number: group.reference_number, notes: group.notes },
      caseDetail: {
        paymentGroupId: group.id,
        referenceNumber: ctx.input.referenceNumber as string | undefined,
        notes: ctx.input.notes as string | undefined,
      },
      // Each edit is its own case (unlike Reverse/Transfer, edits aren't one-shot-per-entity),
      // so the idempotency key includes a random component generated once per request —
      // it only dedupes a literal double-submit of the SAME request, not repeat edits over time.
      idempotencyKey: `PAYMENT_REFERENCE_EDIT:${group.id}:${crypto.randomUUID()}`,
    };
  },

  async computeImpact(kase: CorrectionCaseRecord<ReferenceEditDetail>): Promise<ImpactReport> {
    const group = await prisma.payment_groups.findUniqueOrThrow({ where: { id: kase.caseDetail.paymentGroupId } });
    return {
      balanceChanges: [],
      obligationChanges: [],
      ledgerEntries: [],
      affectedReports: ["Owner Dashboard"],
      notifications: [],
      warnings: [],
    };
  },

  async execute(tx: any, kase: CorrectionCaseRecord<ReferenceEditDetail>) {
    const data: Record<string, unknown> = { updated_at: new Date() };
    if (kase.caseDetail.referenceNumber !== undefined) data.reference_number = kase.caseDetail.referenceNumber;
    if (kase.caseDetail.notes !== undefined) data.notes = kase.caseDetail.notes;

    await tx.payment_groups.update({ where: { id: kase.caseDetail.paymentGroupId }, data });

    return { paymentGroupId: kase.caseDetail.paymentGroupId };
  },

  affectedEntities(kase: CorrectionCaseRecord<ReferenceEditDetail>) {
    return kase.entityRefs;
  },
};

correctionRegistry.register(referenceEditHandler);
