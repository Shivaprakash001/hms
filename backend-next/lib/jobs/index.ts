import { rentGenerationService } from "../services/rent-generation-service";
import { paymentService } from "../services/payment-service";

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
  // 🔧 FIX C1: Use the canonical rent generation service (has lock, P2002 catch, UTC dates, preferences)
  // The old paymentService.generateMonthlyRent was a split-brain duplicate with different rules.
  const result = await rentGenerationService.generateMonthlyRent(undefined, undefined, "cron");
  if ("locked" in result) {
    console.warn(`[Job] Rent generation skipped: ${result.error}`);
  } else {
    console.log(`[Job] Rent generation finished: ${result.created} created, ${result.skipped} skipped.`);
  }
}
