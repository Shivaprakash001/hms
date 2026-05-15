import { prisma } from "../db";
import { eventLog } from "../services/event-log-service";

export type OperationalScope = {
  owner_id: string;
  hostel_id?: string | null;
};

export function scopedTenantWhere(scope: OperationalScope, extra: Record<string, any> = {}) {
  return {
    owner_id: scope.owner_id,
    ...(scope.hostel_id ? { hostel_id: scope.hostel_id } : {}),
    ...extra,
  };
}

export function scopedRoomWhere(scope: OperationalScope, extra: Record<string, any> = {}) {
  return {
    hostel: { owner_id: scope.owner_id },
    ...(scope.hostel_id ? { hostel_id: scope.hostel_id } : {}),
    ...extra,
  };
}

export function scopedPaymentWhere(scope: OperationalScope, extra: Record<string, any> = {}) {
  return {
    owner_id: scope.owner_id,
    ...(scope.hostel_id ? { hostel_id: scope.hostel_id } : {}),
    ...extra,
  };
}

export function scopedObligationWhere(scope: OperationalScope, extra: Record<string, any> = {}) {
  return {
    owner_id: scope.owner_id,
    ...(scope.hostel_id ? { hostel_id: scope.hostel_id } : {}),
    ...extra,
  };
}

export function scopedExpenseWhere(scope: OperationalScope, extra: Record<string, any> = {}) {
  return {
    owner_id: scope.owner_id,
    ...(scope.hostel_id ? { hostel_id: scope.hostel_id } : {}),
    ...extra,
  };
}

export async function assertHostelBelongsToOwner(ownerId: string, hostelId?: string | null) {
  if (!hostelId) return null;
  const hostel = await prisma.hostels.findFirst({
    where: { id: hostelId, owner_id: ownerId, is_active: true },
    select: { id: true, owner_id: true },
  });
  if (!hostel) {
    await eventLog.log("HOSTEL_SCOPE_VIOLATION", ownerId, { hostel_id: hostelId });
    const err: any = new Error("FORBIDDEN: Hostel is not owned by the authenticated owner");
    err.code = "FORBIDDEN";
    throw err;
  }
  return hostel;
}

export async function requireHostelBelongsToOwner(ownerId: string, hostelId?: string | null) {
  if (!hostelId) {
    const err: any = new Error("HOSTEL_CONTEXT_REQUIRED: hostelId is required for operational requests");
    err.code = "HOSTEL_CONTEXT_REQUIRED";
    throw err;
  }
  return assertHostelBelongsToOwner(ownerId, hostelId);
}

export async function assertTenantBelongsToOwner(tenantId: string, ownerId: string) {
  const tenant = await prisma.tenants.findFirst({
    where: { id: tenantId, owner_id: ownerId },
    select: { id: true, owner_id: true, hostel_id: true },
  });
  if (!tenant) {
    await eventLog.log("OWNER_SCOPE_VIOLATION", ownerId, { entity_type: "Tenant", entity_id: tenantId });
    const err: any = new Error("FORBIDDEN: Tenant is not owned by the authenticated owner");
    err.code = "FORBIDDEN";
    throw err;
  }
  return tenant;
}
