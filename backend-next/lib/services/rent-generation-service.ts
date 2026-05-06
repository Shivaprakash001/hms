import { prisma } from "../db";
import { eventSystem } from "../events";
import { invalidateDashboardCache } from "../cache/dashboard-cache";
import { eventLog } from "./event-log-service";
import { resolvePreferences } from "../preferences";
import { getDayInTimezone } from "../timezone";
import { planEnforcementService } from "./plan-enforcement-service";

/**
 * 🏦 Rent Generation Service
 * 
 * Idempotent monthly rent obligation generator.
 * Safe to run multiple times — the DB unique constraint
 * on (allocation_id, rent_month, obligation_type) prevents duplicate rows.
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
      const lastDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getUTCDate();
      const monthEndDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), lastDay, 23, 59, 59, 999));

      // Find allocations that are active AND haven't ended before this month
      const whereClause: any = {
        is_active: true,
        start_date: { lte: monthEndDate },
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
            select: { id: true, monthly_rent: true, owner_id: true, maintenance_charge: true, maintenance_type: true }
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

        // 0️⃣ Enforcement: Check plan allows automation feature
        try {
          await planEnforcementService.assertFeature(ownerId, "automation");
        } catch (err: any) {
          console.warn(`[RENT] Skipping owner ${ownerId} — automation feature not available: ${err?.message}`);
          skipped++;
          continue;
        }

        const prefs: any = prefsMap.get(ownerId);
        const config = resolvePreferences(prefs);

        // 1️⃣ Automation Guard: Skip if owner disabled auto-generation (unless manual trigger)
        if (triggerType === "cron") {
          const autoGen = config.auto_generate_rent ?? true; // Default to true for backward compat
          if (!autoGen) {
            console.info(`[RENT] Skipping owner ${ownerId} — auto_generate_rent disabled`);
            skipped++;
            continue;
          }

          // 1️⃣b Per-owner generation-day guard.
          // The cron runs daily; only process owners whose configured
          // auto_rent_day matches "today" in THEIR timezone.
          const tz = config.timezone || "Asia/Kolkata";
          const expectedDay = Number(config.auto_rent_day ?? 1);
          const localDay = getDayInTimezone(now, tz);

          console.log("[RENT] day-check", {
            ownerId,
            utcNow: now.toISOString(),
            timezone: tz,
            localDay,
            expectedDay,
            willProcess: localDay === expectedDay,
          });

          if (localDay !== expectedDay) {
            skipped++;
            continue;
          }
        }

        // 2️⃣ Dynamic Due Date from preferences
        const dueDay = config.due_day ?? prefs?.due_day ?? 5;
        const tenantDueDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), dueDay));

        // Rent priority: tenant.monthly_rent > room.base_rent > skip
        const rentAmount = Number(alloc.tenant.monthly_rent) || Number(alloc.room.base_rent) || 0;
        if (rentAmount <= 0) {
          console.info(`[RENT] Skipping allocation ${alloc.id} — zero rent`);
          skipped++;
          continue;
        }

        try {
          // ── RENT obligation ──────────────────────────────────────
          const existingRent = await prisma.rentObligation.findFirst({
            where: {
              allocation_id: alloc.id,
              rent_month: rentMonth,
              obligation_type: "RENT"
            }
          });

          if (existingRent) {
            console.info(`[RENT] Already generated for tenant ${alloc.tenant.id}, month ${rentMonth.toISOString()}`);
            skipped++;
          } else {
            await prisma.rentObligation.create({
              data: {
                tenant_id: alloc.tenant.id,
                allocation_id: alloc.id,
                owner_id: alloc.tenant.owner_id,
                rent_month: rentMonth,
                amount: rentAmount,
                total_amount: rentAmount,
                due_date: tenantDueDate,
                status: "PENDING"
              }
            });
            created++;
          }

          // ── MONTHLY MAINTENANCE obligation ───────────────────────
          const maintAmount = Number((alloc.tenant as any).maintenance_charge) || 0;
          const maintType   = (alloc.tenant as any).maintenance_type || "MONTHLY";
          if (maintAmount > 0 && maintType === "MONTHLY") {
            const existingMaint = await prisma.rentObligation.findFirst({
              where: {
                allocation_id: alloc.id,
                rent_month: rentMonth,
                obligation_type: "MAINTENANCE"
              }
            });
            if (!existingMaint) {
              await prisma.rentObligation.create({
                data: {
                  tenant_id: alloc.tenant.id,
                  allocation_id: alloc.id,
                  owner_id: alloc.tenant.owner_id,
                  rent_month: rentMonth,
                  amount: maintAmount,
                  total_amount: maintAmount,
                  due_date: tenantDueDate,
                  status: "PENDING",
                  obligation_type: "MAINTENANCE",
                }
              });
              created++;
            }
          }
        } catch (err: any) {
          if (err?.code === "P2002") {
            console.info(`[RENT] Idempotent skip for allocation ${alloc.id}, month ${rentMonth.toISOString()}`);
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
      // 🔧 FIX M4: Use raw SQL for cleanup to match raw SQL lock acquisition
      // Prevents connection/transaction mismatch between raw SQL INSERT and Prisma ORM DELETE
      await prisma.$executeRaw`DELETE FROM system_locks WHERE key = ${lockKey}`
        .catch((e: any) => console.error("[RENT] Failed to release DB lock:", e));
    }
  }

  /**
   * Preview what would be generated without writing anything.
   * Pure read-only operation.
   */
  async previewMonthlyRent(targetDate?: Date, ownerId?: string) {
    const now = targetDate || new Date();
    const rentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    const lastDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).getUTCDate();
    const monthEndDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), lastDay, 23, 59, 59, 999));

    const whereClause: any = {
      is_active: true,
      start_date: { lte: monthEndDate },
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
      const rentAmount = Number(alloc.tenant.monthly_rent) || Number(alloc.room.base_rent) || 0;
      return {
        allocation_id: alloc.id,
        tenant_name: alloc.tenant.profile?.name || "Unknown",
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
