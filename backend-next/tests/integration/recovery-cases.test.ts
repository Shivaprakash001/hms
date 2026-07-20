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

import { correctionRegistry } from '@/src/services/recovery/correction-registry';
import type { CorrectionHandler } from '@/src/services/recovery/types';

describe('correctionRegistry', () => {
  it('registers and resolves a handler by case_type', () => {
    const fakeHandler: CorrectionHandler = {
      caseType: 'TEST_CASE_TYPE',
      domain: 'PAYMENTS',
      tier: 'FINANCIAL_CORRECTION',
      policy: {
        canPreview: async () => true,
        canExecute: async () => ({ allowed: true }),
      },
      createCase: async () => ({ domain: 'PAYMENTS', tier: 'FINANCIAL_CORRECTION', entityRefs: [], beforeSnapshot: {}, caseDetail: {}, idempotencyKey: 'x' }),
      computeImpact: async () => ({ balanceChanges: [], obligationChanges: [], ledgerEntries: [], affectedReports: [], notifications: [], warnings: [] }),
      execute: async () => ({}),
      affectedEntities: () => [],
    };

    correctionRegistry.register(fakeHandler);
    expect(correctionRegistry.resolve('TEST_CASE_TYPE')).toBe(fakeHandler);
  });

  it('throws when registering a duplicate case_type', () => {
    const handler: CorrectionHandler = {
      caseType: 'DUPLICATE_TYPE',
      domain: 'PAYMENTS',
      tier: 'FINANCIAL_CORRECTION',
      policy: { canPreview: async () => true, canExecute: async () => ({ allowed: true }) },
      createCase: async () => ({ domain: 'PAYMENTS', tier: 'FINANCIAL_CORRECTION', entityRefs: [], beforeSnapshot: {}, caseDetail: {}, idempotencyKey: 'y' }),
      computeImpact: async () => ({ balanceChanges: [], obligationChanges: [], ledgerEntries: [], affectedReports: [], notifications: [], warnings: [] }),
      execute: async () => ({}),
      affectedEntities: () => [],
    };
    correctionRegistry.register(handler);
    expect(() => correctionRegistry.register(handler)).toThrow(/duplicate case_type/);
  });

  it('throws a clear error when resolving an unknown case_type', () => {
    expect(() => correctionRegistry.resolve('NOT_REGISTERED')).toThrow(/no handler registered/i);
  });
});
