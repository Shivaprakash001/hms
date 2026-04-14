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
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const result = await paymentService.generateMonthlyRent(nextMonth);
  console.log(`[Job] Rent generation finished: ${result.generated} created.`);
}
