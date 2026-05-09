import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveHostelId, setActiveHostelId } from '../../src/lib/hostel/activeHostel';

const ownerA = { id: 'owner-a', owner_id: 'owner-a', role: 'owner' };
const ownerB = { id: 'owner-b', owner_id: 'owner-b', role: 'owner' };

describe('active hostel context scoping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('partitions active hostel by owner', () => {
    setActiveHostelId(ownerA, 'hostel-a');
    setActiveHostelId(ownerB, 'hostel-b');

    expect(getActiveHostelId(ownerA)).toBe('hostel-a');
    expect(getActiveHostelId(ownerB)).toBe('hostel-b');
  });

  it('falls back to session hostel id when no explicit selection exists', () => {
    expect(getActiveHostelId({ ...ownerA, hostel_id: 'session-hostel' })).toBe('session-hostel');
  });
});
