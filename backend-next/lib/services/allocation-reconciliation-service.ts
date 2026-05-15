import { prisma } from "../db";
import { eventLog } from "./event-log-service";
import { getLogger } from "../logger";
import { invalidateHostelDashboardCache } from "../cache/dashboard-cache";

const logger = getLogger("allocation-reconcile");

type ReconcileResult = {
  allocation_id: string;
  tenant_id: string;
  room_id: string;
  checks: string[];
  repairs: string[];
};

/**
 * AllocationReconciliationService
 *
 * Integrity-first reconciliation between:
 * - room_allocations state
 * - tenant lifecycle state
 * - obligation state
 *
 * This service performs conservative automatic repairs only.
 * Unsafe cases are surfaced via logs for manual action.
 */
export class AllocationReconciliationService {
  async reconcileAllocation(allocationId: string): Promise<ReconcileResult> {
    const allocation = await prisma.roomAllocation.findUnique({
      where: { id: allocationId },
      include: {
        tenant: { select: { id: true, status: true, owner_id: true } },
        room: { select: { id: true, capacity: true } },
      },
    });

    if (!allocation) {
      throw new Error("NOT_FOUND: Allocation not found");
    }

    const checks: string[] = [];
    const repairs: string[] = [];
    const now = new Date();

    // 1) Room capacity integrity — only ACTIVE + INVITED hold a real bed
    //    CANCELLED and EXPIRED are non-occupying statuses like LEFT.
    const occupants = await prisma.roomAllocation.count({
      where: {
        room_id: allocation.room_id,
        is_active: true,
        end_date: null,
        tenant: { status: { in: ["ACTIVE", "INVITED"] } },
      },
    });
    checks.push("capacity_checked");

    if (occupants > allocation.room.capacity) {
      const msg = `Room ${allocation.room_id} over capacity: ${occupants}/${allocation.room.capacity}`;
      logger.error("allocation.capacity_violation", {
        allocation_id: allocationId,
        room_id: allocation.room_id,
        occupants,
        capacity: allocation.room.capacity,
      });
      await eventLog.log("ALLOCATION_CAPACITY_VIOLATION", allocation.tenant.owner_id || null, {
        allocation_id: allocationId,
        room_id: allocation.room_id,
        occupants,
        capacity: allocation.room.capacity,
      }, allocation.tenant_id);
      // Conservative: we do not auto-evict.
      throw new Error(`CONFLICT: ${msg}`);
    }

    // 2) Tenant lifecycle vs allocation integrity
    //    CANCELLED and EXPIRED must not hold open allocations.
    if (!['ACTIVE', 'INVITED'].includes(allocation.tenant.status) && allocation.is_active) {
      await prisma.roomAllocation.update({
        where: { id: allocationId },
        data: { is_active: false, end_date: now },
      });
      repairs.push("closed_allocation_for_inactive_tenant");
      await eventLog.log("ALLOCATION_AUTO_CLOSED", allocation.tenant.owner_id || null, {
        allocation_id: allocationId,
        reason: `tenant_status_${allocation.tenant.status}`,
      }, allocation.tenant_id);
    }
    checks.push("tenant_state_checked");

    // 3) Obligation consistency for ended allocations:
    //    waive future unpaid obligations linked to allocations that have ended.
    const fresh = await prisma.roomAllocation.findUnique({
      where: { id: allocationId },
      select: { end_date: true, is_active: true },
    });

    if (fresh?.end_date) {
      const endMonth = new Date(Date.UTC(
        fresh.end_date.getUTCFullYear(),
        fresh.end_date.getUTCMonth(),
        1
      ));

      const dangling = await prisma.rent_obligations.findMany({
        where: {
          allocation_id: allocationId,
          rent_month: { gt: endMonth },
          status: { in: ["PENDING", "PARTIAL"] },
        },
        include: {
          payments: { select: { id: true } },
        },
      });

      for (const ob of dangling) {
        if ((ob.payments || []).length > 0) continue;
        await prisma.rent_obligations.update({
          where: { id: ob.id },
          data: { status: "WAIVED" },
        });
        repairs.push(`waived_future_obligation:${ob.id}`);
      }
    }
    checks.push("obligation_state_checked");

    // 4) Duplicate obligation detection (do not auto-delete financial rows)
    const obligations = await prisma.rent_obligations.findMany({
      where: { allocation_id: allocationId },
      select: { id: true, allocation_id: true, rent_month: true, obligation_type: true },
    });
    const dupes = new Map<string, number>();
    for (const ob of obligations) {
      const key = `${ob.allocation_id}|${ob.rent_month.toISOString()}|${ob.obligation_type}`;
      dupes.set(key, (dupes.get(key) || 0) + 1);
    }
    const dupeGroups = Array.from(dupes.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));

    if (dupeGroups.length > 0) {
      logger.error("allocation.duplicate_obligations_detected", {
        allocation_id: allocationId,
        duplicate_groups: dupeGroups.length,
      });
      await eventLog.log("ALLOCATION_DUPLICATE_OBLIGATIONS_DETECTED", allocation.tenant.owner_id || null, {
        allocation_id: allocationId,
        groups: dupeGroups,
      }, allocation.tenant_id);
    }
    checks.push("duplicate_scan_done");

    return {
      allocation_id: allocationId,
      tenant_id: allocation.tenant_id,
      room_id: allocation.room_id,
      checks,
      repairs,
    };
  }

  async reconcileTenant(tenantId: string) {
    const allocations = await prisma.roomAllocation.findMany({
      where: { tenant_id: tenantId, is_active: true, end_date: null },
      select: { id: true },
      orderBy: { start_date: "desc" },
    });

    const results: ReconcileResult[] = [];
    for (const a of allocations) {
      const res = await this.reconcileAllocation(a.id);
      results.push(res);
    }
    return { tenant_id: tenantId, reconciled_allocations: results.length, results };
  }

  async reconcileRoom(roomId: string) {
    const allocations = await prisma.roomAllocation.findMany({
      where: { room_id: roomId, is_active: true, end_date: null },
      select: { id: true },
    });

    const results: ReconcileResult[] = [];
    for (const a of allocations) {
      const res = await this.reconcileAllocation(a.id);
      results.push(res);
    }
    return { room_id: roomId, reconciled_allocations: results.length, results };
  }

  /**
   * Expire stale invitations and release seats.
   * Rule: tenant INVITED + invitation_expires_at passed => status EXPIRED (not LEFT).
   *
   * IMPORTANT: LEFT is reserved for previously-ACTIVE tenants who departed.
   * A tenant who was never activated goes to EXPIRED, not LEFT.
   */
  async expireStaleInvitations(now: Date = new Date()) {
    const stale = await prisma.tenants.findMany({
      where: {
        status: "INVITED",
        profiles: {
          invitation_expires_at: { lt: now },
        },
      },
      select: {
        id: true,
        owner_id: true,
        hostel_id: true,
        profile_id: true,
        room_allocations: {
          where: { is_active: true, end_date: null },
          select: { id: true },
        },
      },
    });

    let expired = 0;
    for (const t of stale) {
      await prisma.$transaction(async (tx) => {
        await tx.tenants.update({
          where: { id: t.id },
          data: { status: "EXPIRED" as any },
        });
        await tx.roomAllocation.updateMany({
          where: { tenant_id: t.id, is_active: true, end_date: null },
          data: { is_active: false, end_date: now },
        });
        // Waive any future unpaid obligations — never activated tenants
        // should not accumulate financial obligations.
        await tx.rent_obligations.updateMany({
          where: {
            tenant_id: t.id,
            status: { in: ["PENDING", "PARTIAL"] },
          },
          data: { status: "WAIVED" },
        });
      });

      expired++;
      await eventLog.log("INVITATION_EXPIRED_AUTO_RELEASE", t.owner_id || null, {
        tenant_id: t.id,
        new_status: "EXPIRED",
        released_allocations: (t as any).room_allocations.length,
      }, t.id);
      if (t.hostel_id) invalidateHostelDashboardCache(t.hostel_id);
    }

    return { expired_count: expired };
  }
}

export const allocationReconciliationService = new AllocationReconciliationService();
