import { describe, expect, it, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createTestOwner, createTestHostel } from './factories/owner-factory';
import { createTestTenant } from './factories/tenant-factory';
import { createTestObligation } from './factories/payment-factory';
import { paymentService } from '@/src/services/payments/payment-service';

describe('createMultiObligationPaymentIntent FIFO Enforcement', () => {
  let owner: any;
  let hostel: any;
  let tenant: any;
  let obligationJune: any;
  let obligationJuly: any;

  beforeAll(async () => {
    owner = await createTestOwner();
    // Create hostel with partial payments enabled to allow single installment selection
    hostel = await createTestHostel(owner.id, {
      preferences_config: {
        billing: {
          partial_payments: {
            enabled: true,
            minimum_amount: 100,
          }
        }
      }
    });
    tenant = await createTestTenant(owner.id, hostel.id);

    // Create two test obligations: June and July rent
    obligationJune = await createTestObligation(tenant.id, owner.id, hostel.id, {
      due_date: new Date('2026-06-05'),
      rent_month: new Date('2026-06-01'),
      amount: 8500,
      total_amount: 8500,
    });

    obligationJuly = await createTestObligation(tenant.id, owner.id, hostel.id, {
      due_date: new Date('2026-07-05'),
      rent_month: new Date('2026-07-01'),
      amount: 8500,
      total_amount: 8500,
    });
  });

  it('should allow payment intent for July dues even if June is unpaid (relaxed FIFO)', async () => {
    const attempt = await paymentService.createMultiObligationPaymentIntent(
      [obligationJuly.id],
      tenant.id,
      tenant.id
    );
    expect(attempt).toBeDefined();
    expect(attempt.status).toBe('PENDING');
  });

  it('should allow payment intent for only June dues', async () => {
    const attempt = await paymentService.createMultiObligationPaymentIntent(
      [obligationJune.id],
      tenant.id,
      tenant.id
    );
    expect(attempt).toBeDefined();
    expect(attempt.status).toBe('PENDING');
  });

  it('should allow payment intent for both June and July dues simultaneously', async () => {
    const attempt = await paymentService.createMultiObligationPaymentIntent(
      [obligationJune.id, obligationJuly.id],
      tenant.id,
      tenant.id
    );
    expect(attempt).toBeDefined();
    expect(attempt.status).toBe('PENDING');
  });
});
