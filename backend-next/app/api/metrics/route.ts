export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/metrics";

export async function GET() {
  const m = getMetrics();
  
  return NextResponse.json({
    webhook_total: m.webhooks.total,
    webhook_success: m.webhooks.success,
    webhook_errors: m.webhooks.errors,
    webhook_success_rate_percent: m.webhook_success_rate.toFixed(2),
    webhook_last_error: m.webhooks.last_error,
    
    payments_created: m.payments.created,
    payments_success: m.payments.success,
    payments_failed: m.payments.failed,
    payments_reconciled: m.payments.reconciled,
    
    auth_login_success: m.auth.login_success,
    auth_login_failed: m.auth.login_failed,
    auth_refresh_success: m.auth.refresh_success,
    auth_refresh_failed: m.auth.refresh_failed,
    auth_token_reuse_detected: m.auth.token_reuse_detected,
    
    last_reset: m.lastReset,
    timestamp: new Date().toISOString(),
  }, { 
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
