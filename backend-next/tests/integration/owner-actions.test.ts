import { describe, it, expect } from 'vitest';
import { ownerActionRegistry } from '@/src/services/owner-actions/owner-action-registry';
import type { OwnerAction } from '@/src/services/owner-actions/types';

describe('ownerActionRegistry', () => {
  it('registers an action and lists it for a matching entity + role, evaluating availability', () => {
    const action: OwnerAction = {
      actionId: 'TEST_ACTION_ALWAYS_ON',
      entity: 'test-entity',
      category: 'EDIT',
      label: 'Do The Test Thing',
      allowedRoles: ['OWNER'],
      isAvailable: () => true,
    };
    ownerActionRegistry.register(action);

    const list = ownerActionRegistry.listForEntity('test-entity', { tenantStatus: 'ACTIVE', actorRole: 'OWNER' });
    expect(list).toEqual([
      { actionId: 'TEST_ACTION_ALWAYS_ON', entity: 'test-entity', category: 'EDIT', label: 'Do The Test Thing', available: true },
    ]);
  });

  it('omits actions the caller role is not allowed to see', () => {
    const action: OwnerAction = {
      actionId: 'TEST_ACTION_OWNER_ONLY',
      entity: 'test-entity-2',
      category: 'EDIT',
      label: 'Owner Only Thing',
      allowedRoles: ['OWNER'],
      isAvailable: () => true,
    };
    ownerActionRegistry.register(action);

    const list = ownerActionRegistry.listForEntity('test-entity-2', { tenantStatus: 'ACTIVE', actorRole: 'TENANT' });
    expect(list).toEqual([]);
  });

  it('reflects isAvailable(ctx) as the available flag, per-context', () => {
    const action: OwnerAction = {
      actionId: 'TEST_ACTION_ACTIVE_ONLY',
      entity: 'test-entity-3',
      category: 'WORKFLOW',
      label: 'Active-Only Thing',
      allowedRoles: ['OWNER'],
      isAvailable: (ctx) => ctx.tenantStatus === 'ACTIVE',
    };
    ownerActionRegistry.register(action);

    const activeList = ownerActionRegistry.listForEntity('test-entity-3', { tenantStatus: 'ACTIVE', actorRole: 'OWNER' });
    expect(activeList[0].available).toBe(true);

    const invitedList = ownerActionRegistry.listForEntity('test-entity-3', { tenantStatus: 'INVITED', actorRole: 'OWNER' });
    expect(invitedList[0].available).toBe(false);
  });

  it('throws when registering a duplicate actionId', () => {
    const action: OwnerAction = {
      actionId: 'TEST_DUPLICATE',
      entity: 'test-entity-4',
      category: 'EDIT',
      label: 'Dup',
      allowedRoles: ['OWNER'],
      isAvailable: () => true,
    };
    ownerActionRegistry.register(action);
    expect(() => ownerActionRegistry.register(action)).toThrow(/duplicate actionId/);
  });

  it('has() reports whether an actionId is registered', () => {
    expect(ownerActionRegistry.has('TEST_ACTION_ALWAYS_ON')).toBe(true);
    expect(ownerActionRegistry.has('NOT_REGISTERED_ANYWHERE')).toBe(false);
  });
});
