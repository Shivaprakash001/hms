import { prisma } from "../db";
import { eventSystem } from "../events";
import { invalidateDashboardCache } from "../cache/dashboard-cache";

/**
 * 🏦 Rent Generation Service
 * 
 * Idempotent monthly rent obligation generator.
 * Safe to run multiple times — the DB unique constraint
 * on (allocation_id, rent_month) prevents duplicate rows.
 * 
 * Safety features:
 * - Deterministic UTC month keys (YYYY-MM-01T00:00:00Z)
 * - end_date filter prevents billing ex-tenants
 * - Zero-rent skip before insert
 * - P2002 catch with debug logging
 * - Rate-limit lock prevents concurrent runs
 * - Full audit trail via RentGenerationLog
 */

// In-memory lock to prevent concurrent generation runs
const generationLocks = new Map<string, number>();
const LOCK_TTL_MS = 30_000; // 30 seconds

function acquireLock(key: string): boolean {
  const existing = generationLocks.get(key);
  if (existing && Date.now() - existing < LOCK_TTL_MS) {
    return false; // Lock is held
  }
  generationLocks.set(key, Date.now());
  return true;
}

function releaseLock(key: string) {
  generationLocks.delete(key);
}

export class RentGenerationService {

  /**
   * Generate rent obligations for a specific month.
   * 
   * @param targetDate - defaults to current month's 1st day
   * @param ownerId - optional, scope to a single owner (manual trigger)
   * @param triggerType - "cron" or "manual"
   * @returns Summary of what was generated
   */
  async generateMonthlyRent(
    targetDate?: Date,
    ownerId?: string,
    triggerType: "cron" | "manual" = "manual"
  ) {
    const startTime = Date.now();
    const now = targetDate || new Date();
    // Deterministic month key — always UTC midnight on 1st
    const rentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    // Due date = 5th of the month
    const dueDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 5));

    // Rate-limit lock
    const lockKey = ownerId || "global";
    if (!acquireLock(lockKey)) {
      return {
        rent_month: rentMonth.toISOString(),
        error: "Rent generation already in progress. Please wait.",
        locked: true
      };
    }

    try {
      // Find allocations that are active AND haven't ended before this month
      const whereClause: any = {
        is_active: true,
        start_date: { lte: rentMonth },
        student: { status: "ACTIVE" },
        OR: [
          { end_date: null },
          { end_date: { gte: rentMonth } }
        ]
      };
      if (ownerId) {
        whereClause.student.owner_id = ownerId;
      }

      const allocations = await prisma.roomAllocation.findMany({
        where: whereClause,
        include: {
          student: {
            select: { id: true, monthly_rent: true, owner_id: true }
          },
          room: {
            select: { base_rent: true }
          }
        }
      });

      let created = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const alloc of allocations) {
        // Rent priority: student.monthly_rent > room.base_rent > skip
        const rentAmount = Number(alloc.student.monthly_rent) || Number(alloc.room.base_rent) || 0;
        if (rentAmount <= 0) {
          console.info(`[RENT] Skipping allocation ${alloc.id} — zero rent`);
          skipped++;
          continue;
        }

        try {
          await prisma.rentObligation.create({
            data: {
              student_id: alloc.student.id,
              allocation_id: alloc.id,
              owner_id: alloc.student.owner_id,
              rent_month: rentMonth,
              amount: rentAmount,
              due_date: dueDate,
              status: "PENDING"
            }
          });
          created++;
        } catch (err: any) {
          if (err?.code === "P2002") {
            // Unique constraint — already generated, idempotent skip
            console.info(`[RENT] Already generated for allocation ${alloc.id}, month ${rentMonth.toISOString()}`);
            skipped++;
          } else {
            console.error(`[RENT] Failed for allocation ${alloc.id}:`, err.message);
            failed++;
            errors.push(`Allocation ${alloc.id}: ${err.message}`);
          }
        }
      }

      const durationMs = Date.now() - startTime;

      const summary = {
        rent_month: rentMonth.toISOString(),
        total_allocations: allocations.length,
        created,
        skipped,
        failed,
        duration_ms: durationMs,
        errors: errors.length > 0 ? errors : undefined
      };

      // Write audit log
      await prisma.rentGenerationLog.create({
        data: {
          rent_month: rentMonth,
          trigger_type: triggerType,
          triggered_by: ownerId || null,
          total_allocations: allocations.length,
          obligations_created: created,
          obligations_skipped: skipped,
          obligations_failed: failed,
          duration_ms: durationMs,
          errors: errors.length > 0 ? JSON.stringify(errors) : null
        }
      }).catch(logErr => {
        console.error("[RENT] Failed to write generation log:", logErr);
      });

      // Broadcast structured SSE events
      if (created > 0) {
        await eventSystem.trigger("rent_generated", {
          month: rentMonth.toISOString(),
          count: created,
          ownerId: ownerId || "all"
        });
        await eventSystem.trigger("dashboard_updated", {
          reason: "rent_generated",
          ownerId: ownerId || "all"
        });

        // Invalidate dashboard caches for affected owners
        if (ownerId) {
          invalidateDashboardCache(ownerId);
        } else {
          // For cron runs, get distinct owner IDs
          const ownerIds = Array.from(new Set(allocations.map(a => a.student.owner_id).filter(Boolean)));
          ownerIds.forEach(id => {
            if (id) invalidateDashboardCache(id);
          });
        }
      }

      console.log(`[RENT] Generation complete: ${created} created, ${skipped} skipped, ${failed} failed (${durationMs}ms)`);
      return summary;

    } finally {
      releaseLock(lockKey);
    }
  }

  /**
   * Preview what would be generated without writing anything.
   * Pure read-only operation.
   */
  async previewMonthlyRent(targetDate?: Date, ownerId?: string) {
    const now = targetDate || new Date();
    const rentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    const whereClause: any = {
      is_active: true,
      start_date: { lte: rentMonth },
      student: { status: "ACTIVE" },
      OR: [
        { end_date: null },
        { end_date: { gte: rentMonth } }
      ]
    };
    if (ownerId) {
      whereClause.student.owner_id = ownerId;
    }

    const allocations = await prisma.roomAllocation.findMany({
      where: whereClause,
      include: {
        student: {
          select: { id: true, monthly_rent: true, owner_id: true, profile: { select: { name: true } } }
        },
        room: {
          select: { room_no: true, base_rent: true }
        }
      }
    });

    // Check which already have obligations for this month
    const existingObligations = await prisma.rentObligation.findMany({
      where: {
        allocation_id: { in: allocations.map(a => a.id) },
        rent_month: rentMonth
      },
      select: { allocation_id: true }
    });

    const existingSet = new Set(existingObligations.map(o => o.allocation_id));

    const preview = allocations.map(alloc => {
      const rentAmount = Number(alloc.student.monthly_rent) || Number(alloc.room.base_rent) || 0;
      return {
        allocation_id: alloc.id,
        student_name: alloc.student.profile?.name || "Unknown",
        room_no: alloc.room.room_no,
        rent_amount: rentAmount,
        already_generated: existingSet.has(alloc.id),
        will_skip: rentAmount <= 0 || existingSet.has(alloc.id)
      };
    });

    return {
      rent_month: rentMonth.toISOString(),
      total: preview.length,
      will_create: preview.filter(p => !p.will_skip).length,
      will_skip: preview.filter(p => p.will_skip).length,
      items: preview
    };
  }
}

export const rentGenerationService = new RentGenerationService();
