import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createTestOwner, createTestHostel } from '../factories/owner-factory';
import { createTestTenant } from '../factories/tenant-factory';
import { createTestObligation } from '../factories/payment-factory';

// NOTE: mockImplementation must return a plain `function` (not an arrow
// function) — provider-factory.ts calls `new RazorpayProvider(config)`, and
// `new` on an arrow-function implementation throws "is not a constructor".
//
// gateway_txn_id is unique across payment_attempts (prisma/schema.prisma),
// so each createIntent() call must return a distinct value — otherwise the
// second test in this file collides with the first against the real test DB.
let mockGatewayTxnCounter = 0;
vi.mock('@/src/services/payments/providers/razorpay', () => ({
  RazorpayProvider: vi.fn().mockImplementation(function RazorpayProvider() {
    return {
      createIntent: vi.fn().mockImplementation(async () => {
        const gatewayTxnId = `order_test${++mockGatewayTxnCounter}`;
        return {
          provider: 'RAZORPAY',
          merchant_txn_id: 'test-txn',
          checkout_url: null,
          upi_intent_url: null,
          qr_payload: null,
          expires_at: null,
          gateway_txn_id: gatewayTxnId,
          provider_order_id: gatewayTxnId,
          provider_transaction_id: null,
          provider_reference_id: gatewayTxnId,
          raw_response: { id: gatewayTxnId, key_id: 'rzp_test_key' },
        };
      }),
    };
  }),
}));

import { paymentService } from '@/src/services/payments/payment-service';

describe('paymentService.createAmountPaymentIntent', () => {
  it('allocates a FIFO plan across obligations and links only the ones with allocated > 0', async () => {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);
    const tenant = await createTestTenant(owner.id, hostel.id);

    const obligation1 = await createTestObligation(tenant.id, owner.id, hostel.id, {
      amount: 8000,
      status: 'PENDING',
      billing_period_start: new Date(Date.UTC(2027, 0, 1)),
      due_date: new Date(Date.UTC(2027, 0, 5)),
      rent_month: new Date(Date.UTC(2027, 0, 1)),
    });
    const obligation2 = await createTestObligation(tenant.id, owner.id, hostel.id, {
      amount: 8000,
      status: 'PENDING',
      billing_period_start: new Date(Date.UTC(2027, 1, 1)),
      due_date: new Date(Date.UTC(2027, 1, 5)),
      rent_month: new Date(Date.UTC(2027, 1, 1)),
    });

    // Pay 10,000: fully covers obligation1 (8,000), partially covers obligation2 (2,000)
    const attempt = await paymentService.createAmountPaymentIntent(
      10000,
      owner.id,
      tenant.id,
      hostel.id,
      { bypassCollectionPolicy: true, source: 'PAYMENT_LINK' }
    );

    expect(Number((attempt as any).amount)).toBe(10000);

    const links = await prisma.payment_attempt_obligations.findMany({
      where: { payment_attempt_id: (attempt as any).id },
    });
    expect(links.length).toBe(2);
    const byObligation = Object.fromEntries(links.map((l) => [l.obligation_id, Number(l.amount)]));
    expect(byObligation[obligation1.id]).toBe(8000);
    expect(byObligation[obligation2.id]).toBe(2000);
  });

  it('creates a pure future-credit intent (no linked obligations) when the tenant owes nothing', async () => {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);
    const tenant = await createTestTenant(owner.id, hostel.id);
    // No obligations at all.

    const attempt = await paymentService.createAmountPaymentIntent(
      5000,
      owner.id,
      tenant.id,
      hostel.id,
      { bypassCollectionPolicy: true, source: 'PAYMENT_LINK' }
    );

    expect(Number((attempt as any).amount)).toBe(5000);

    const links = await prisma.payment_attempt_obligations.findMany({
      where: { payment_attempt_id: (attempt as any).id },
    });
    expect(links.length).toBe(0);

    const raw = (attempt as any).raw_create_response as any;
    expect(Array.isArray(raw?.allowed_obligation_ids)).toBe(true);
    expect(raw.allowed_obligation_ids.length).toBe(0);
  });

  it('rejects a zero or negative amount', async () => {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);
    const tenant = await createTestTenant(owner.id, hostel.id);

    await expect(
      paymentService.createAmountPaymentIntent(0, owner.id, tenant.id, hostel.id, { source: 'PAYMENT_LINK' })
    ).rejects.toThrow(/greater than zero/i);
  });
});
