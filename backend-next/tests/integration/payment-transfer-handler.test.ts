import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { createTestOwner, createTestHostel } from '../factories/owner-factory';
import { createTestTenant } from '../factories/tenant-factory';
import { createTestObligation, createTestPayment } from '../factories/payment-factory';
import { recoveryService } from '@/src/services/recovery/recovery-service';
import { correctionRegistry } from '@/src/services/recovery/correction-registry';
import '@/src/services/payments/corrections/payment-transfer-handler'; // registers itself

describe('paymentTransferHandler (end to end via recoveryService)', () => {
  it('reverses the payment on tenant A and allocates a new forward payment to tenant B', async () => {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);
    const tenantA = await createTestTenant(owner.id, hostel.id);
    const tenantB = await createTestTenant(owner.id, hostel.id);

    const obligationA = await createTestObligation(tenantA.id, owner.id, hostel.id, { amount: 5000 });
    const payment = await createTestPayment(obligationA.id, 5000);
    const obligationB = await createTestObligation(tenantB.id, owner.id, hostel.id, { amount: 5000 });

    expect(correctionRegistry.has('PAYMENT_TRANSFER')).toBe(true);

    const kase = await recoveryService.createCase('PAYMENT_TRANSFER', {
      hostelId: hostel.id,
      actor: { actorId: owner.id, actorRole: 'OWNER' },
      reason: 'recorded against wrong tenant',
      input: { paymentId: payment.id, toTenantId: tenantB.id },
    });

    const impact = await recoveryService.preview(kase.id);
    expect(impact.ledgerEntries[0].tenantId).toBe(tenantA.id);

    await recoveryService.validate(kase.id);
    const executed = await recoveryService.execute(kase.id, { actorId: owner.id, actorRole: 'OWNER' });
    expect(executed.status).toBe('COMPLETED');

    const reversalOnA = await prisma.payments.findMany({ where: { obligation_id: obligationA.id, amount_paid: { lt: 0 } } });
    expect(reversalOnA).toHaveLength(1);

    const forwardOnB = await prisma.payments.findMany({ where: { obligation_id: obligationB.id, amount_paid: { gt: 0 } } });
    expect(forwardOnB.length).toBeGreaterThan(0);
    const totalOnB = forwardOnB.reduce((sum, p) => sum + Number(p.amount_paid), 0);
    expect(totalOnB).toBe(5000);
  });

  it('policy refuses a transfer to a tenant in a different hostel', async () => {
    const owner = await createTestOwner();
    const hostelA = await createTestHostel(owner.id);
    const hostelB = await createTestHostel(owner.id);
    const tenantA = await createTestTenant(owner.id, hostelA.id);
    const tenantB = await createTestTenant(owner.id, hostelB.id);

    const obligationA = await createTestObligation(tenantA.id, owner.id, hostelA.id, { amount: 2000 });
    const payment = await createTestPayment(obligationA.id, 2000);

    const kase = await recoveryService.createCase('PAYMENT_TRANSFER', {
      hostelId: hostelA.id,
      actor: { actorId: owner.id, actorRole: 'OWNER' },
      reason: 'cross-hostel attempt',
      input: { paymentId: payment.id, toTenantId: tenantB.id },
    });
    await recoveryService.preview(kase.id);

    const validation = await recoveryService.validate(kase.id);
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toMatch(/hostel/i);
  });

  it('createCase throws when the source payment does not belong to the claimed hostel', async () => {
    const owner = await createTestOwner();
    const hostelA = await createTestHostel(owner.id);
    const hostelB = await createTestHostel(owner.id);
    const tenantA = await createTestTenant(owner.id, hostelA.id);
    const tenantC = await createTestTenant(owner.id, hostelA.id);

    const obligationA = await createTestObligation(tenantA.id, owner.id, hostelA.id, { amount: 3000 });
    const payment = await createTestPayment(obligationA.id, 3000);

    // Case is created claiming hostelB, but the payment actually belongs to hostelA.
    await expect(
      recoveryService.createCase('PAYMENT_TRANSFER', {
        hostelId: hostelB.id,
        actor: { actorId: owner.id, actorRole: 'OWNER' },
        reason: 'wrong hostel claimed for source payment',
        input: { paymentId: payment.id, toTenantId: tenantC.id },
      })
    ).rejects.toThrow(/hostel/i);
  });

  it('policy.canExecute rejects a transfer when the source payment does not belong to the case hostel', async () => {
    const owner = await createTestOwner();
    const hostelA = await createTestHostel(owner.id);
    const hostelB = await createTestHostel(owner.id);
    const tenantA = await createTestTenant(owner.id, hostelA.id);
    const tenantC = await createTestTenant(owner.id, hostelA.id);

    const obligationA = await createTestObligation(tenantA.id, owner.id, hostelA.id, { amount: 1500 });
    const payment = await createTestPayment(obligationA.id, 1500);

    // Create a legitimate case first (claiming the payment's real hostel, hostelA),
    // then mutate the persisted case row to claim hostelB — simulating a case whose
    // hostelId no longer matches its source payment's actual hostel (e.g. drift/bug),
    // to exercise the canExecute guard directly rather than only via createCase.
    const kase = await recoveryService.createCase('PAYMENT_TRANSFER', {
      hostelId: hostelA.id,
      actor: { actorId: owner.id, actorRole: 'OWNER' },
      reason: 'setup for canExecute hostel-mismatch test',
      input: { paymentId: payment.id, toTenantId: tenantC.id },
    });

    await prisma.correction_cases.update({
      where: { id: kase.id },
      data: { hostel_id: hostelB.id },
    });

    await recoveryService.preview(kase.id);
    const validation = await recoveryService.validate(kase.id);
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toMatch(/hostel/i);
  });
});
