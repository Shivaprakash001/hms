import { rentGenerationService } from "../services/rent-generation-service";
import { paymentService } from "../services/payment-service";
import { prisma } from "../db";

/**
 * Strategy for Background Jobs in Next.js (Serverless):
 * 1. For Cron jobs: Use Vercel Cron Jobs (matching /api/cron/* routes).
 * 2. For instant background tasks: Use an external queue like Upstash QStash or Vercel KV.
 * 3. For long-running tasks: Use a dedicated worker or AWS Lambda.
 */

export async function dailyReconciliation() {
  console.log("[Job] Starting daily reconciliation...");
  const result = await paymentService.reconcilePendingAttempts();
  console.log(`[Job] Reconciliation finished: ${result.processed} processed.`);
}

export async function monthlyRentGeneration() {
  console.log("[Job] Starting monthly rent generation...");
  const hostels = await prisma.hostel.findMany({
    where: { is_active: true },
    select: { id: true, owner_id: true },
  });

  let created = 0;
  let skipped = 0;
  let locked = 0;
  for (const hostel of hostels) {
    const result = await rentGenerationService.generateMonthlyRent(undefined, hostel.owner_id, "cron", hostel.id);
    if ("locked" in result) {
      locked++;
      console.warn(`[Job] Rent generation skipped for hostel ${hostel.id}: ${result.error}`);
    } else {
      created += result.created;
      skipped += result.skipped;
    }
  }
  console.log(`[Job] Rent generation finished: ${created} created, ${skipped} skipped, ${locked} locked.`);
}
