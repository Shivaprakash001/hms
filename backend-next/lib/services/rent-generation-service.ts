import { prisma } from "../db";
import { eventSystem } from "../events";
import { invalidateDashboardCache } from "../cache/dashboard-cache";
import { eventLog } from "./event-log-service";

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

export class RentGenerationService {

  calculateRent(tenant: any, targetMonth: Date, fallbackRent: number): number {
    const rent = Number(tenant.monthly_rent) || fallbackRent || 0;
    if (!tenant.joined_on) return rent;

    const joined = new Date(tenant.joined_on);
    const target = new Date(targetMonth);

    if (
      joined.getMonth() === target.getMonth() &&
      joined.getFullYear() === target.getFullYear()
    ) {
      const daysInMonth = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0
      ).getDate();
      
      const daysStayed = daysInMonth - joined.getDate() + 1;
      return Math.round((rent / daysInMonth) * daysStayed);
    }
    return rent;
  }

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

    // Persistent Database Lock
    const lockKey = `rent_gen_${rentMonth.toISOString()}_${ownerId || "global"}`;
    const LOCK_TTL_MS = 60_000; // 60 seconds

    try {
      // Atomic Lock Acquisition (Handles fresh insertion + overwriting expired locks inside ONE query window)
      const lockAcquired = await prisma.$executeRaw`
        INSERT INTO system_locks (key, locked_at, expires_at)
        VALUES (${lockKey}, NOW(), NOW() + interval '60 seconds')
        ON CONFLICT (key) DO UPDATE
        SET locked_at = NOW(), expires_at = NOW() + interval '60 seconds'
        WHERE system_locks.expires_at < NOW()
      `;

      if (lockAcquired === 0) {
        // Zero rows affected = constraint fired AND the existing lock has NOT expired
        return {
          rent_month: rentMonth.toISOString(),
          error: "Rent generation already in progress. Please wait.",
          locked: true
        };
      }
    } catch (e: any) {
      console.error("[RENT] Critical DB lock failure:", e);
      return {
        rent_month: rentMonth.toISOString(),
        error: "Failed to acquire generation lock.",
        locked: true
      };
    }

    try {
      // Find allocations that are active AND haven't ended before this month
      const whereClause: any = {
        is_active: true,
        start_date: { lte: rentMonth },
        tenant: { status: "ACTIVE" },
        OR: [
          { end_date: null },
          { end_date: { gte: rentMonth } }
        ]
      };
      if (ownerId) {
        whereClause.tenant.owner_id = ownerId;
      }

      const allocations = await prisma.roomAllocation.findMany({
        where: whereClause,
        include: {
          tenant: {
            select: { id: true, monthly_rent: true, owner_id: true, joined_on: true }
          },
          room: {
            select: { base_rent: true }
          }
        }
      });

      // Optimization: Batch fetch owner preferences to avoid N+1 queries in large systems
      const ownerIds = Array.from(new Set(allocations.map(a => a.tenant.owner_id).filter(Boolean))) as string[];
      const hostelPrefs: any[] = await prisma.hostel.findMany({
        where: { owner_id: { in: ownerIds }, is_active: true },
      });
      const prefsMap = new Map(hostelPrefs.map((p: any) => [p.owner_id, p]));

      let created = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const alloc of allocations) {
        // Runaway generation timeout guard
        if (Date.now() - startTime > 30_000) {
          console.warn("[RENT] Runaway generation detected — safety aborting at 30,000ms");
          errors.push("TIMEOUT: Generation exceeded Vercel 30s limit");
          break;
        }

        const ownerId = alloc.tenant.owner_id;
        if (!ownerId) {
          console.warn(`[RENT] Skipping allocation ${alloc.id} — missing owner_id`);
          skipped++;
          continue;
        }

        const prefs: any = prefsMap.get(ownerId);
        const config = (prefs?.preferences_config as any) || {};

        // 1️⃣ Automation Guard: Skip if owner disabled auto-generation (unless manual trigger)
        if (triggerType === "cron") {
          const autoGen = config.auto_generate_rent ?? true; // Default to true for backward compat
          if (!autoGen) {
            console.info(`[RENT] Skipping owner ${alloc.tenant.owner_id} — auto_generate_rent disabled`);
            skipped++;
            continue;
          }
        }

        // 2️⃣ Dynamic Due Date from preferences
        const dueDay = config.due_day || prefs?.due_day || 5;
        const tenantDueDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), dueDay));

        // Rent priority: tenant.monthly_rent > room.base_rent > skip
        const baseRent = Number(alloc.tenant.monthly_rent) || Number(alloc.room.base_rent) || 0;
        const rentAmount = this.calculateRent(alloc.tenant, rentMonth, baseRent);
        
        if (rentAmount <= 0) {
          console.info(`[RENT] Skipping allocation ${alloc.id} — zero rent`);
          skipped++;
          continue;
        }

        try {
          await prisma.rentObligation.create({
            data: {
              tenant_id: alloc.tenant.id,
              allocation_id: alloc.id,
              owner_id: alloc.tenant.owner_id,
              rent_month: rentMonth,
              amount: rentAmount,
              due_date: tenantDueDate,
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
          const ownerIds = Array.from(new Set(allocations.map(a => a.tenant.owner_id).filter(Boolean)));
          ownerIds.forEach(id => {
            if (id) invalidateDashboardCache(id);
          });
        }
      }

      // Write structured audit event
      await eventLog.log("RENT_GENERATED", ownerId || null, {
        rent_month: rentMonth.toISOString(),
        trigger_type: triggerType,
        created, skipped, failed, duration_ms: durationMs
      });

      console.log(`[RENT] Generation complete: ${created} created, ${skipped} skipped, ${failed} failed (${durationMs}ms)`);
      return summary;

    } finally {
      await prisma.systemLock.deleteMany({
        where: { key: lockKey }
      }).catch(e => console.error("[RENT] Failed to release DB lock:", e));
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
      tenant: { status: "ACTIVE" },
      OR: [
        { end_date: null },
        { end_date: { gte: rentMonth } }
      ]
    };
    if (ownerId) {
      whereClause.tenant.owner_id = ownerId;
    }

    const allocations = await prisma.roomAllocation.findMany({
      where: whereClause,
      include: {
        tenant: {
          select: { id: true, monthly_rent: true, owner_id: true, joined_on: true, profile: { select: { name: true } } }
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
      const baseRent = Number(alloc.tenant.monthly_rent) || Number(alloc.room.base_rent) || 0;
      const rentAmount = this.calculateRent(alloc.tenant, rentMonth, baseRent);
      
      return {
        allocation_id: alloc.id,
        tenant_name: alloc.tenant.profile?.name || "Unknown",
        room_no: alloc.room.room_no,
        rent_amount: rentAmount,
        already_generated: existingSet.has(alloc.id),
        will_skip: rentAmount <= 0 || existingSet.has(alloc.id)
      };
    });

    const totalAmount = preview.filter(p => !p.will_skip && !p.already_generated).reduce((sum, p) => sum + p.rent_amount, 0);

    return {
      rent_month: rentMonth.toISOString(),
      tenants: preview.length,
      tenants_to_create: preview.filter(p => !p.will_skip && !p.already_generated).length,
      tenants_already_generated: preview.filter(p => p.already_generated).length,
      total_amount: totalAmount,
      items: preview
    };
  }
}

export const rentGenerationService = new RentGenerationService();
