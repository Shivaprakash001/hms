import { prisma } from "../db";
import { eventSystem } from "../events";
import { invalidateDashboardCache } from "../cache/dashboard-cache";
import { eventLog } from "./event-log-service";
import { resolvePreferences } from "../preferences";
import { getDayInTimezone } from "../timezone";
import { planEnforcementService } from "./plan-enforcement-service";
import { rentGenerationLedgerService } from "./rent-generation-ledger-service";
import {
  validateBillingPreferences,
  computeDueDate,
  type BillingValidationError,
} from "./billing-validation";
import { abandonmentService } from "./abandonment-service";

/**
 * 🏦 Rent Generation Service — Phases 1-7
 *
 * Idempotent monthly rent obligation generator.
 * Safe to run multiple times — the DB unique constraint
 * on (allocation_id, rent_month, obligation_type) prevents duplicate rows.
 *
 * Safety features:
 * Phase 1: Catch-up generation, ledger idempotency
 * Phase 2: Hostel-scoped preferences, multi-hostel independence
 * Phase 3: Atomic transaction (rent + maintenance in one TX)
 * Phase 4: Billing preference validation before any rows are queued
 * Phase 5: Unified owner-scoped DB lock prevents cron/manual overlap
 * Phase 7: Anomaly events for zero generation, timeouts, lock contention
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

    // Phase 5: Unified owner-scoped lock key.
    // Format: rent_gen_<ownerId|global>_<YYYY-MM>
    // Scoped to owner+month so cron and manual triggers for the SAME owner+month
    // cannot overlap, while different owners run concurrently without blocking each other.
    const monthKey = `${rentMonth.getUTCFullYear()}-${String(rentMonth.getUTCMonth() + 1).padStart(2, "0")}`;
    const lockKey = `rent_gen_${ownerId || "global"}_${monthKey}`;

    try {
      // Atomic Lock Acquisition: INSERT with ON CONFLICT DO UPDATE WHERE expires_at < NOW()
      // Zero rows affected means the lock is held by another process and not yet expired.
      const lockAcquired = await prisma.$executeRaw`
        INSERT INTO system_locks (key, locked_at, expires_at)
        VALUES (${lockKey}, NOW(), NOW() + interval '60 seconds')
        ON CONFLICT (key) DO UPDATE
        SET locked_at = NOW(), expires_at = NOW() + interval '60 seconds'
        WHERE system_locks.expires_at < NOW()
      `;

      if (lockAcquired === 0) {
        // Phase 7: Structured lock contention event
        console.warn("[RENT] Lock contention — generation already in progress", {
          lock_key: lockKey, trigger_type: triggerType, owner_id: ownerId,
        });
        await eventLog.log("LOCK_CONTENTION", ownerId || null, {
          lock_key: lockKey,
          rent_month: rentMonth.toISOString(),
          trigger_type: triggerType,
        }).catch(() => {});
        return {
          rent_month: rentMonth.toISOString(),
          error: "Rent generation already in progress. Please wait.",
          locked: true,
        };
      }

      console.log("[RENT] Lock acquired", { lock_key: lockKey, trigger_type: triggerType });
    } catch (e: any) {
      console.error("[RENT] Critical DB lock failure:", e);
      await eventLog.log("LOCK_CONTENTION", ownerId || null, {
        lock_key: lockKey,
        rent_month: rentMonth.toISOString(),
        trigger_type: triggerType,
        error: e?.message,
        cause: "LOCK_ACQUIRE_FAILED",
      }).catch(() => {});
      return {
        rent_month: rentMonth.toISOString(),
        error: "Failed to acquire generation lock.",
        locked: true,
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
            select: { base_rent: true, hostel_id: true }
          }
        }
      });

      // Phase 2: preferences are scoped to the allocation's actual hostel.
      // This keeps multi-hostel owners from leaking one hostel's billing config into another.
      const hostelIds = Array.from(new Set(allocations.map(a => (a.room as any).hostel_id).filter(Boolean))) as string[];
      const hostelPrefs: any[] = await prisma.hostel.findMany({
        where: { id: { in: hostelIds }, is_active: true },
      });
      const prefsMap = new Map(hostelPrefs.map((p: any) => [p.id, p]));

      let created = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      // ── BATCH obligation generation (replaces N×2 per-allocation queries) ──
      // 1. One round-trip to fetch all existing obligations this rentMonth
      const allocationIds = allocations.map(a => a.id);
      const existingObligations = await prisma.rentObligation.findMany({
        where: { allocation_id: { in: allocationIds }, rent_month: rentMonth },
        select: { allocation_id: true, obligation_type: true },
      });
      // O(1) lookup set: "allocId:obligationType"
      const existingSet = new Set(
        existingObligations.map(o => `${o.allocation_id}:${o.obligation_type ?? 'RENT'}`)
      );

      const rentRows:  any[] = [];
      const maintRows: any[] = [];
      const ledgerStats = new Map<string, {
        ownerId: string;
        hostelId: string;
        obligationType: string;
        created: number;
        skipped: number;
      }>();

      const ledgerKey = (ownerId: string, hostelId: string, obligationType: string) =>
        `${ownerId}:${hostelId}:${obligationType}`;

      const ensureLedgerStat = (ownerId: string, hostelId: string, obligationType: string) => {
        const key = ledgerKey(ownerId, hostelId, obligationType);
        const current = ledgerStats.get(key);
        if (current) return current;
        const next = { ownerId, hostelId, obligationType, created: 0, skipped: 0 };
        ledgerStats.set(key, next);
        return next;
      };

      const logGenerationDecision = (payload: Record<string, any>) => {
        console.log("[RENT] generation-decision", payload);
      };

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

        const hostelId = (alloc.room as any).hostel_id;
        if (!hostelId) {
          console.warn(`[RENT] Skipping allocation ${alloc.id} — missing hostel_id`);
          skipped++;
          continue;
        }

        const prefs: any = prefsMap.get(hostelId);
        if (!prefs) {
          console.warn(`[RENT] Skipping allocation ${alloc.id} — missing active hostel preferences for ${hostelId}`);
          skipped++;
          await rentGenerationLedgerService.skip({
            ownerId, hostelId, rentMonth, obligationType: "RENT",
            skippedCount: 1, reason: "ACTIVE_HOSTEL_NOT_FOUND"
          }).catch((ledgerErr: any) => console.error("[RENT] Failed to write ledger skip:", ledgerErr));
          logGenerationDecision({
            owner_id: ownerId, hostel_id: hostelId, rent_month: rentMonth.toISOString(),
            obligation_type: "RENT", created: 0, skipped: 1,
            reason: "ACTIVE_HOSTEL_NOT_FOUND", trigger_type: triggerType
          });
          continue;
        }

        // Enforcement: Check plan allows automation feature
        try {
          await planEnforcementService.assertFeature(ownerId, "automation");
        } catch (err: any) {
          console.warn(`[RENT] Skipping owner ${ownerId} — automation not available: ${err?.message}`);
          await rentGenerationLedgerService.skip({
            ownerId, hostelId, rentMonth, obligationType: "RENT",
            skippedCount: 1, reason: "PLAN_AUTOMATION_UNAVAILABLE"
          }).catch((ledgerErr: any) => console.error("[RENT] Failed to write ledger skip:", ledgerErr));
          logGenerationDecision({
            owner_id: ownerId, hostel_id: hostelId, rent_month: rentMonth.toISOString(),
            obligation_type: "RENT", created: 0, skipped: 1,
            reason: "PLAN_AUTOMATION_UNAVAILABLE", trigger_type: triggerType
          });
          skipped++;
          continue;
        }

        const config = resolvePreferences(prefs);

        // Phase 4: Validate billing preferences before queuing any rows.
        // Invalid configs produce a structured error and skip this hostel's generation.
        const prefValidation = validateBillingPreferences({
          hostel_id: hostelId,
          owner_id: ownerId,
          auto_rent_day: Number(config.auto_rent_day ?? 1),
          due_day: Number(config.due_day ?? 5),
          timezone: config.timezone || "Asia/Kolkata",
          rent_cycle: config.rent_cycle || "MONTHLY",
        });
        if (!prefValidation.valid) {
          const errorCodes = prefValidation.errors.map((e) => e.code).join(",");
          console.warn(`[RENT] Skipping hostel ${hostelId} — invalid billing config: ${errorCodes}`, prefValidation.errors);
          skipped++;
          await rentGenerationLedgerService.skip({
            ownerId, hostelId, rentMonth, obligationType: "RENT",
            skippedCount: 1, reason: `INVALID_BILLING_CONFIG:${errorCodes}`,
          }).catch((ledgerErr: any) => console.error("[RENT] Failed to write ledger skip:", ledgerErr));
          logGenerationDecision({
            owner_id: ownerId, hostel_id: hostelId, rent_month: rentMonth.toISOString(),
            obligation_type: "RENT", created: 0, skipped: 1,
            reason: "INVALID_BILLING_CONFIG", validation_errors: prefValidation.errors,
            trigger_type: triggerType,
          });
          continue;
        }
        // Log any warnings (e.g. DUE_DAY_BEFORE_RENT_DAY_SHIFTED) without aborting
        const prefWarnings = prefValidation.errors.filter((e: BillingValidationError) => e.severity === "WARNING");
        if (prefWarnings.length > 0) {
          console.warn(`[RENT] Billing config warnings for hostel ${hostelId}`, prefWarnings);
        }

        // Automation Guard: Skip if owner disabled auto-generation (unless manual trigger)
        if (triggerType === "cron") {
          const autoGen = config.auto_generate_rent ?? true;
          if (!autoGen) {
            console.info(`[RENT] Skipping owner ${ownerId} — auto_generate_rent disabled`);
            await rentGenerationLedgerService.skip({
              ownerId, hostelId, rentMonth, obligationType: "RENT",
              skippedCount: 1, reason: "AUTO_GENERATE_DISABLED"
            }).catch((ledgerErr: any) => console.error("[RENT] Failed to write ledger skip:", ledgerErr));
            logGenerationDecision({
              owner_id: ownerId, hostel_id: hostelId, rent_month: rentMonth.toISOString(),
              obligation_type: "RENT", created: 0, skipped: 1,
              reason: "AUTO_GENERATE_DISABLED", trigger_type: triggerType
            });
            skipped++;
            continue;
          }

          // Per-owner generation-day guard
          const tz = config.timezone || "Asia/Kolkata";
          const expectedDay = Number(config.auto_rent_day ?? 1);
          const localDay = getDayInTimezone(now, tz);

          console.log("[RENT] day-check", {
            ownerId, hostelId, utcNow: now.toISOString(), timezone: tz,
            localDay, expectedDay, willProcess: localDay >= expectedDay,
          });

          if (localDay < expectedDay) {
            await rentGenerationLedgerService.skip({
              ownerId, hostelId, rentMonth, obligationType: "RENT",
              skippedCount: 1, reason: "BEFORE_GENERATION_DAY"
            }).catch((ledgerErr: any) => console.error("[RENT] Failed to write ledger skip:", ledgerErr));
            logGenerationDecision({
              owner_id: ownerId, hostel_id: hostelId, rent_month: rentMonth.toISOString(),
              obligation_type: "RENT", created: 0, skipped: 1,
              reason: "BEFORE_GENERATION_DAY", trigger_type: triggerType,
              local_day: localDay, expected_day: expectedDay
            });
            skipped++;
            continue;
          }
        }

        // Phase 4: Use computeDueDate which applies the shift policy when due_day < auto_rent_day
        const autoRentDayVal = Number(config.auto_rent_day ?? 1);
        const dueDayVal = Number(config.due_day ?? 5);
        const tenantDueDate = computeDueDate(rentMonth, autoRentDayVal, dueDayVal);

        const rentAmount = Number(alloc.tenant.monthly_rent) || Number(alloc.room.base_rent) || 0;
        if (rentAmount <= 0) {
          console.info(`[RENT] Skipping allocation ${alloc.id} — zero rent`);
          skipped++;
          continue;
        }

        // Collect RENT row if not already present
        const rentCompleted = await rentGenerationLedgerService.hasCompleted(ownerId, hostelId, rentMonth, "RENT");
        if (rentCompleted) {
          skipped++;
          await rentGenerationLedgerService.skip({
            ownerId, hostelId, rentMonth, obligationType: "RENT",
            skippedCount: 1, reason: "ALREADY_COMPLETED"
          }).catch((ledgerErr: any) => console.error("[RENT] Failed to write ledger skip:", ledgerErr));
          logGenerationDecision({
            owner_id: ownerId, hostel_id: hostelId, rent_month: rentMonth.toISOString(),
            obligation_type: "RENT", created: 0, skipped: 1,
            reason: "ALREADY_COMPLETED", trigger_type: triggerType
          });
        } else {
          await rentGenerationLedgerService.startOrReuse({
            ownerId, hostelId, rentMonth, obligationType: "RENT",
            triggerType, generatedBy: triggerType === "manual" ? ownerId : null
          });
          const stat = ensureLedgerStat(ownerId, hostelId, "RENT");
          if (!existingSet.has(`${alloc.id}:RENT`)) {
            rentRows.push({
              tenant_id: alloc.tenant.id, allocation_id: alloc.id,
              owner_id: alloc.tenant.owner_id, rent_month: rentMonth,
              amount: rentAmount, total_amount: rentAmount,
              due_date: tenantDueDate, status: "PENDING", obligation_type: "RENT",
              hostel_id: hostelId, // Phase 2: immutable hostel context at generation time
            });
            stat.created++;
          } else {
            stat.skipped++;
            skipped++;
          }
        }

        // Collect MAINTENANCE row if applicable and not already present
        const maintAmount = Number((alloc.tenant as any).maintenance_charge) || 0;
        const maintType   = (alloc.tenant as any).maintenance_type || "MONTHLY";
        if (maintAmount > 0 && maintType === "MONTHLY") {
          const maintCompleted = await rentGenerationLedgerService.hasCompleted(ownerId, hostelId, rentMonth, "MAINTENANCE");
          if (maintCompleted) {
            skipped++;
            await rentGenerationLedgerService.skip({
              ownerId, hostelId, rentMonth, obligationType: "MAINTENANCE",
              skippedCount: 1, reason: "ALREADY_COMPLETED"
            }).catch((ledgerErr: any) => console.error("[RENT] Failed to write ledger skip:", ledgerErr));
            logGenerationDecision({
              owner_id: ownerId, hostel_id: hostelId, rent_month: rentMonth.toISOString(),
              obligation_type: "MAINTENANCE", created: 0, skipped: 1,
              reason: "ALREADY_COMPLETED", trigger_type: triggerType
            });
          } else {
            await rentGenerationLedgerService.startOrReuse({
              ownerId, hostelId, rentMonth, obligationType: "MAINTENANCE",
              triggerType, generatedBy: triggerType === "manual" ? ownerId : null
            });
            const stat = ensureLedgerStat(ownerId, hostelId, "MAINTENANCE");
            if (!existingSet.has(`${alloc.id}:MAINTENANCE`)) {
              maintRows.push({
                tenant_id: alloc.tenant.id, allocation_id: alloc.id,
                owner_id: alloc.tenant.owner_id, rent_month: rentMonth,
                amount: maintAmount, total_amount: maintAmount,
                due_date: tenantDueDate, status: "PENDING", obligation_type: "MAINTENANCE",
                hostel_id: hostelId, // Phase 2: immutable hostel context at generation time
              });
              stat.created++;
            } else {
              stat.skipped++;
              skipped++;
            }
          }

        }
      }

      // 2. Atomic bulk insert — both rent and maintenance rows go in a single transaction.
      //    If either insert fails the entire transaction rolls back, preventing partial generation.
      //    skipDuplicates is still set so concurrent cron/manual triggers that race past the
      //    ledger check are handled gracefully inside the transaction window.
      let txRolledBack = false;
      try {
        const txResults = await prisma.$transaction(async (tx) => {
          let rentCount = 0;
          let maintCount = 0;
          if (rentRows.length > 0) {
            const result = await tx.rentObligation.createMany({ data: rentRows, skipDuplicates: true });
            rentCount = result.count;
          }
          if (maintRows.length > 0) {
            const result = await tx.rentObligation.createMany({ data: maintRows, skipDuplicates: true });
            maintCount = result.count;
          }
          return { rentCount, maintCount };
        });
        created += txResults.rentCount + txResults.maintCount;
      } catch (insertErr: any) {
        txRolledBack = true;
        failed += ledgerStats.size || 1;

        // Classify the failure reason for structured audit trails
        const failureReason = insertErr?.code === "P2002"
          ? "DUPLICATE_KEY_CONFLICT"
          : insertErr?.message?.includes("timeout")
            ? "TRANSACTION_TIMEOUT"
            : "TRANSACTION_ROLLED_BACK";

        console.error("[RENT] Transaction rolled back — no obligations written", {
          rent_month: rentMonth.toISOString(),
          reason: failureReason,
          error: insertErr?.message,
          rent_rows_pending: rentRows.length,
          maint_rows_pending: maintRows.length,
        });

        errors.push(`${failureReason}: ${insertErr?.message || "unknown"}`);

        // Mark every affected ledger entry as FAILED.
        // These writes happen OUTSIDE the rolled-back transaction so the control-plane
        // accurately records the failure and unblocks safe retries.
        for (const stat of Array.from(ledgerStats.values())) {
          await rentGenerationLedgerService.fail({
            ownerId: stat.ownerId,
            hostelId: stat.hostelId,
            rentMonth,
            obligationType: stat.obligationType,
            createdCount: 0,
            skippedCount: stat.skipped,
            reason: failureReason,
          }).catch((ledgerErr: any) => console.error("[RENT] Failed to mark ledger failed:", ledgerErr));
        }
        throw insertErr;
      }

      for (const stat of Array.from(ledgerStats.values())) {
        await rentGenerationLedgerService.complete({
          ownerId: stat.ownerId,
          hostelId: stat.hostelId,
          rentMonth,
          obligationType: stat.obligationType,
          createdCount: stat.created,
          skippedCount: stat.skipped,
        }).catch((ledgerErr: any) => {
          console.error("[RENT] Failed to complete ledger:", ledgerErr);
          errors.push(`LEDGER_COMPLETE_FAILED: ${ledgerErr?.message || ledgerErr}`);
        });
        logGenerationDecision({
          owner_id: stat.ownerId,
          hostel_id: stat.hostelId,
          rent_month: rentMonth.toISOString(),
          obligation_type: stat.obligationType,
          created: stat.created,
          skipped: stat.skipped,
          reason: "COMPLETED",
          trigger_type: triggerType,
        });
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

      // Phase 7: Anomaly detection — emit ZERO_RENT_GENERATED when we had eligible
      // allocations but created nothing. This is a financial signal, not an error per se,
      // but it must be surfaced for operational visibility.
      if (created === 0 && allocations.length > 0 && failed === 0) {
        await eventLog.log("ZERO_RENT_GENERATED", ownerId || null, {
          rent_month: rentMonth.toISOString(),
          trigger_type: triggerType,
          total_allocations: allocations.length,
          skipped,
          hint: "All eligible allocations were skipped. Verify ledger state and hostel config.",
        }).catch(() => {});
      }

      // Phase 7: Emit GENERATION_TIMEOUT anomaly if we hit the safety abort
      if (errors.some((e) => e.startsWith("TIMEOUT:"))) {
        await eventLog.log("GENERATION_TIMEOUT", ownerId || null, {
          rent_month: rentMonth.toISOString(),
          trigger_type: triggerType,
          duration_ms: durationMs,
          created,
          skipped,
          failed,
        }).catch(() => {});
      }

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

      // 🎉 First-rent milestone: fire once when the owner's very first rent cycle succeeds.
      // Non-blocking — never lets a notification failure affect the generation result.
      if (created > 0 && ownerId) {
        abandonmentService
          .sendFirstSuccessNotification(ownerId, "FIRST_RENT")
          .catch((e: any) => console.warn("[RENT] First-rent milestone notification failed:", e?.message));
      }

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
