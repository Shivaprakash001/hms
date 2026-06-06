import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
  supabase: {},
}));

import { AdmissionsService } from '@/services/admissions/admissions-service';

describe('AdmissionsService analytical boundaries', () => {
  it('instantiates correctly and defines expected public methods', () => {
    const service = new AdmissionsService();
    expect(service).toBeDefined();
    expect(service.analytics).toBeDefined();
    expect(service.createDirect).toBeDefined();
    expect(service.updateStatus).toBeDefined();
  });
});
