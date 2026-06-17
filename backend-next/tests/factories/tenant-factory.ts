import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function createTestTenant(ownerId: string, hostelId: string, overrides: any = {}) {
  const profileId = uuidv4();
  
  const { name, email, phone, role, ...tenantOverrides } = overrides;

  // Create profile for tenant
  const profile = await prisma.profile.create({
    data: {
      id: profileId,
      name: name || `Tenant ${profileId.substring(0, 5)}`,
      email: email || `tenant-${profileId}@test.com`,
      phone: phone || Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      role: role || 'TENANT',
    },
  });

  const tenant = await prisma.tenants.create({
    data: {
      profile_id: profile.id,
      owner_id: ownerId,
      hostel_id: hostelId,
      status: 'ACTIVE',
      personal_email: profile.email,
      ...tenantOverrides,
    },
  });

  return tenant;
}

export async function allocateTestRoom(tenantId: string, roomId: string, overrides: any = {}) {
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
