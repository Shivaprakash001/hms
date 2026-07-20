import { tenantFinancialLedgerService } from "../tenant-financial-ledger-service";

export interface ReverseObligationPaymentParams {
  hostelId: string;
  payment: {
    id: string;
    obligation_id: string;
    tenant_id: string;
    owner_id: string | null;
    amount_paid: any; // Prisma Decimal
    payment_method: string;
  };
  correctionCaseId: string;
  actorId: string;
  reason: string;
}

export interface ReverseObligationPaymentResult {
  reversalPaymentId: string;
  ledgerEntryId: string | null;
  newSettlementStatus: string;
}

/**
 * Reverses one payment's effect on its obligation without ever touching the
 * original `payments` row. Used by both the Reverse Payment and Transfer
 * Payment correction handlers. Idempotent: calling twice with the same
 * `correctionCaseId` returns the existing reversal row instead of creating
 * a second one (see idempotency_key on the reversal payment row).
 */
export async function reverseObligationPayment(
  tx: any,
  params: ReverseObligationPaymentParams
): Promise<ReverseObligationPaymentResult> {
  const { hostelId, payment, correctionCaseId, actorId, reason } = params;
  const reversalIdempotencyKey = `correction:${correctionCaseId}:reversal`;

  // Lock the obligation row before any read-modify-write on it. This must run
  // on both the create-new-reversal path and the idempotent-retry path,
  // since both paths read `obligation` and write settlement_status/status
  // based on a fresh summation of payments below.
  await tx.$queryRaw`SELECT id FROM rent_obligations WHERE id = ${payment.obligation_id}::uuid FOR UPDATE`;

  const existingReversal = await tx.payments.findUnique({
    where: { idempotency_key: reversalIdempotencyKey },
  });

  let reversalPaymentId: string;
  if (existingReversal) {
    reversalPaymentId = existingReversal.id;
  } else {
    const reversal = await tx.payments.create({
      data: {
        obligation_id: payment.obligation_id,
        tenant_id: payment.tenant_id,
        owner_id: payment.owner_id,
        amount_paid: Number(payment.amount_paid) * -1,
        payment_method: payment.payment_method,
        reference_number: `REVERSAL:${payment.id}`,
        payment_date: new Date(),
        idempotency_key: reversalIdempotencyKey,
        hostel_id: hostelId,
      },
    });
    reversalPaymentId = reversal.id;
  }

  const obligation = await tx.rent_obligations.findUniqueOrThrow({ where: { id: payment.obligation_id } });
  const allPayments = await tx.payments.findMany({
    where: { obligation_id: payment.obligation_id },
    select: { amount_paid: true },
  });
  const totalPaid = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
  const totalDue = Number(obligation.amount);
  const newSettlementStatus = totalPaid <= 0 ? "UNPAID" : totalPaid < totalDue ? "PARTIAL" : "PAID";
  const newLegacyStatus = newSettlementStatus === "UNPAID" ? "PENDING" : newSettlementStatus;

  await tx.rent_obligations.update({
    where: { id: payment.obligation_id },
    data: {
      settlement_status: newSettlementStatus,
      status: newLegacyStatus,
      updated_at: new Date(),
    },
  });

  let ledgerEntryId: string | null = null;
  if (!existingReversal) {
    const debitResult = await tenantFinancialLedgerService.debitInTx(tx, {
      tenantId: payment.tenant_id,
      ownerId: payment.owner_id ?? "",
      createdBy: actorId,
      reason: "LEDGER_CORRECTION",
      amount: Number(payment.amount_paid),
      referenceId: correctionCaseId,
      referenceType: "CORRECTION_CASE",
      notes: reason,
    });
    ledgerEntryId = debitResult?.entry?.id ?? null;
  }

  return { reversalPaymentId, ledgerEntryId, newSettlementStatus };
}
