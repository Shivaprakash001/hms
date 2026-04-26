import { prisma } from "../db";
import { eventSystem } from "../events";

/**
 * 🏦 Rent Generation Service
 * 
 * Idempotent monthly rent obligation generator.
 * Safe to run multiple times — the DB unique constraint
 * on (allocation_id, rent_month) prevents duplicate rows.
 */
export class RentGenerationService {

  /**
   * Generate rent obligations for a specific month.
   * Targets all active allocations that started on or before the target month.
   * 
   * @param targetDate - defaults to current month's 1st day
   * @param ownerId - optional, scope to a single owner (useful for manual trigger)
   * @returns Summary of what was generated
   */
  async generateMonthlyRent(targetDate?: Date, ownerId?: string) {
    const now = targetDate || new Date();
    const rentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    // Due date = 5th of the month (configurable later)
    const dueDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 5));

    // Find all active allocations that existed before this month
    const whereClause: any = {
      is_active: true,
      end_date: null,
      start_date: { lte: rentMonth },
      student: { status: "ACTIVE" }
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
      // Rent priority: student.monthly_rent > room.base_rent > 0
      const rentAmount = Number(alloc.student.monthly_rent) || Number(alloc.room.base_rent) || 0;
      if (rentAmount <= 0) {
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
        // P2002 = unique constraint violation → already generated, skip silently
        if (err?.code === "P2002") {
          skipped++;
        } else {
          failed++;
          errors.push(`Allocation ${alloc.id}: ${err.message}`);
        }
      }
    }

    const summary = {
      rent_month: rentMonth.toISOString(),
      total_allocations: allocations.length,
      created,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined
    };

    // Broadcast event so dashboards refresh
    if (created > 0) {
      await eventSystem.trigger("rent_generated", {
        month: rentMonth.toISOString(),
        count: created,
        ownerId: ownerId || "all"
      });
    }

    return summary;
  }

  /**
   * Preview what would be generated without actually creating rows.
   * Useful for owner confirmation before manual trigger.
   */
  async previewMonthlyRent(targetDate?: Date, ownerId?: string) {
    const now = targetDate || new Date();
    const rentMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

    const whereClause: any = {
      is_active: true,
      end_date: null,
      start_date: { lte: rentMonth },
      student: { status: "ACTIVE" }
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
