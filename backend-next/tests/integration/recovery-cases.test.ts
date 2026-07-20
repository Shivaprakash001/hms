import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { createTestOwner, createTestHostel } from '../factories/owner-factory';

describe('correction_cases schema', () => {
  it('can insert and read back a minimal row', async () => {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);

    const kase = await prisma.correction_cases.create({
      data: {
        hostel_id: hostel.id,
        domain: 'PAYMENTS',
        case_type: 'SMOKE_TEST',
        tier: 'FINANCIAL_CORRECTION',
        status: 'DRAFT',
        entity_refs: [{ type: 'payment', id: 'placeholder' }],
        reason: 'schema smoke test',
        actor_id: owner.id,
        actor_role: 'OWNER',
        before_snapshot: {},
        case_detail: {},
        idempotency_key: `SMOKE_TEST:${hostel.id}`,
      },
    });

    expect(kase.status).toBe('DRAFT');

    const event = await prisma.correction_case_events.create({
      data: {
        correction_case_id: kase.id,
        event_type: 'CREATED',
        actor_id: owner.id,
        actor_role: 'OWNER',
      },
    });

    expect(event.correction_case_id).toBe(kase.id);
  });
});
