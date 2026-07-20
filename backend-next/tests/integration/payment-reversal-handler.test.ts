import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { createTestOwner, createTestHostel } from '../factories/owner-factory';
import { createTestTenant } from '../factories/tenant-factory';
import { createTestObligation, createTestPayment } from '../factories/payment-factory';
import { reverseObligationPayment } from '@/src/services/payments/corrections/payment-correction-shared';

describe('reverseObligationPayment', () => {
  it('writes a negative reversal payment row and restores obligation outstanding, without mutating the original payment', async () => {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);
    const tenant = await createTestTenant(owner.id, hostel.id);
    const obligation = await createTestObligation(tenant.id, owner.id, hostel.id, { amount: 10000 });
    const payment = await createTestPayment(obligation.id, 10000);

    const result = await prisma.$transaction(async (tx) => {
      return reverseObligationPayment(tx, {
        hostelId: hostel.id,
        payment,
        correctionCaseId: '11111111-1111-4111-8111-111111111111',
        actorId: owner.id,
        reason: 'wrong tenant',
      });
    });

    expect(result.newSettlementStatus).toBe('UNPAID');

    const originalUnchanged = await prisma.payments.findUniqueOrThrow({ where: { id: payment.id } });
    expect(Number(originalUnchanged.amount_paid)).toBe(10000);

    const reversalRow = await prisma.payments.findUniqueOrThrow({ where: { id: result.reversalPaymentId } });
    expect(Number(reversalRow.amount_paid)).toBe(-10000);
    expect(reversalRow.obligation_id).toBe(obligation.id);

    const updatedObligation = await prisma.rent_obligations.findUniqueOrThrow({ where: { id: obligation.id } });
    expect(updatedObligation.settlement_status).toBe('UNPAID');

    const ledgerEntry = await prisma.tenant_financial_ledger.findUniqueOrThrow({ where: { id: result.ledgerEntryId! } });
    expect(ledgerEntry.reason).toBe('LEDGER_CORRECTION');
    expect(Number(ledgerEntry.amount)).toBe(10000);
  });

  it('is safe to call twice with the same correctionCaseId (idempotent retry)', async () => {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);
    const tenant = await createTestTenant(owner.id, hostel.id);
    const obligation = await createTestObligation(tenant.id, owner.id, hostel.id, { amount: 5000 });
    const payment = await createTestPayment(obligation.id, 5000);

    const params = { hostelId: hostel.id, payment, correctionCaseId: '22222222-2222-4222-8222-222222222222', actorId: owner.id, reason: 'retry test' };

    const first = await prisma.$transaction(async (tx) => reverseObligationPayment(tx, params));
    const second = await prisma.$transaction(async (tx) => reverseObligationPayment(tx, params));

    expect(second.reversalPaymentId).toBe(first.reversalPaymentId);

    const reversalRows = await prisma.payments.findMany({ where: { obligation_id: obligation.id, amount_paid: { lt: 0 } } });
    expect(reversalRows).toHaveLength(1);
  });
});
