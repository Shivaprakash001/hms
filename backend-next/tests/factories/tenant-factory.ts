import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function createTestTenant(ownerId: string, hostelId: string, overrides = {}) {
  const profileId = uuidv4();
  
  // Create profile for tenant
  const profile = await prisma.profile.create({
    data: {
      id: profileId,
      name: `Tenant ${profileId.substring(0, 5)}`,
      email: `tenant-${profileId}@test.com`,
      phone: '1234567890',
      role: 'TENANT',
    },
  });

  const tenant = await prisma.tenants.create({
    data: {
      profile_id: profile.id,
      owner_id: ownerId,
      hostel_id: hostelId,
      status: 'ACTIVE',
      personal_email: profile.email,
      ...overrides,
    },
  });

  return tenant;
}

export async function allocateTestRoom(tenantId: string, roomId: string, overrides = {}) {
  return await prisma.roomAllocation.create({
    data: {
      id: uuidv4(),
      tenant_id: tenantId,
      room_id: roomId,
      hostel_id: overrides.hostel_id,
      start_date: new Date(),
      is_active: true,
      ...overrides,
    },
  });
}
