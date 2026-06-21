import { describe, it, expect, beforeEach } from 'vitest';
import { createTestOwner, createTestHostel } from './factories/owner-factory';
import { createTestTenant, allocateTestRoom } from './factories/tenant-factory';
import { createTestRoom } from './factories/room-factory';
import { prisma } from '@/lib/db';
import { BillingTimelineService } from '@/lib/services/billing-timeline-service';

describe('BillingTimelineService', () => {
  let owner: any;
  let hostel: any;
  let tenant: any;
  let room: any;
  const billingTimelineService = new BillingTimelineService();

  beforeEach(async () => {
    owner = await createTestOwner();
    hostel = await createTestHostel(owner.id);
    room = await createTestRoom(hostel.id);
    tenant = await createTestTenant(owner.id, hostel.id);
    await allocateTestRoom(tenant.id, room.id, { hostel_id: hostel.id });
  });

  it('should compute next rent generation information successfully', async () => {
    // Generate a past rent obligation
    await prisma.rent_obligations.create({
      data: {
        obligation_type: 'RENT',
        amount: 8000,
        total_amount: 8000,
        rent_month: new Date(Date.UTC(2026, 5, 1)), // June 2026
        due_date: new Date(Date.UTC(2026, 5, 5)),
        status: 'PAID',
        billing_period_start: new Date(Date.UTC(2026, 5, 1)),
        billing_period_end: new Date(Date.UTC(2026, 5, 30)),
        hostels: { connect: { id: hostel.id } },
        tenants: { connect: { id: tenant.id } },
      },
    });

    const result = await billingTimelineService.getTenantTimeline(tenant.id, owner.id);

    expect(result).toHaveProperty('next_rent_generation');
    expect(result.next_rent_generation).toHaveProperty('next_rent_month');
    expect(result.next_rent_generation).toHaveProperty('next_rent_generation_date');
    expect(result.next_rent_generation).toHaveProperty('next_installment_due_date');
    expect(result.next_rent_generation).toHaveProperty('next_installment_amount');

    const nextRentMonth = new Date(result.next_rent_generation.next_rent_month);
    expect(nextRentMonth.getUTCMonth()).toBe(6); // July (since latest was June)
    expect(nextRentMonth.getUTCFullYear()).toBe(2026);
  });
});
