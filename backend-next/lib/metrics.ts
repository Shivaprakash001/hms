/**
 * In-memory metrics store for webhook and payment monitoring.
 * Note: In a multi-instance deployment (e.g., Vercel), use Redis/Postgres.
 */
const metrics = {
  webhooks: {
    total: 0,
    success: 0,
    errors: 0,
    last_error: null as string | null,
  },
  payments: {
    created: 0,
    success: 0,
    failed: 0,
    reconciled: 0,
  },
  auth: {
    login_success: 0,
    login_failed: 0,
    refresh_success: 0,
    refresh_failed: 0,
    token_reuse_detected: 0,
  },
  lastReset: new Date().toISOString(),
};

export function incrementWebhook(success: boolean) {
  metrics.webhooks.total++;
  if (success) {
    metrics.webhooks.success++;
  } else {
    metrics.webhooks.errors++;
    metrics.webhooks.last_error = new Date().toISOString();
  }
}

export function incrementPayment(type: "created" | "success" | "failed" | "reconciled") {
  metrics.payments[type]++;
}

export function incrementAuth(type: "login_success" | "login_failed" | "refresh_success" | "refresh_failed" | "token_reuse_detected") {
  metrics.auth[type]++;
}

export function getMetrics() {
  return {
    ...metrics,
    webhook_success_rate: metrics.webhooks.total > 0 
      ? (metrics.webhooks.success / metrics.webhooks.total) * 100 
      : 100,
  };
}

export function resetMetrics() {
  metrics.webhooks.total = 0;
  metrics.webhooks.success = 0;
  metrics.webhooks.errors = 0;
  metrics.webhooks.last_error = null;
  metrics.payments.created = 0;
  metrics.payments.success = 0;
  metrics.payments.failed = 0;
  metrics.payments.reconciled = 0;
  metrics.auth.login_success = 0;
  metrics.auth.login_failed = 0;
  metrics.auth.refresh_success = 0;
  metrics.auth.refresh_failed = 0;
  metrics.auth.token_reuse_detected = 0;
  metrics.lastReset = new Date().toISOString();
}
