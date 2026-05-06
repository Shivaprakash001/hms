/**
 * In-memory metrics store for webhook, payment, and observability monitoring.
 * Note: In a multi-instance deployment (e.g., Vercel), counters are per-instance.
 * Values are best-effort for operational visibility, not billing-critical.
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
  // ── PDF Cache observability ────────────────────────────────────────────────
  pdf_cache: {
    receipt_hits:    0,  // Puppeteer bypassed — served from ImageKit cache
    receipt_misses:  0,  // Puppeteer ran — PDF was not cached or version changed
    invoice_hits:    0,  // pdf-lib bypassed — served from ImageKit cache
    invoice_misses:  0,  // pdf-lib ran — PDF was not cached or version changed
  },
  // ── Snapshot observability ─────────────────────────────────────────────────
  snapshot: {
    stats_hits:        0,  // getOwnerStats served from fresh snapshot row
    stats_misses:      0,  // getOwnerStats triggered recompute
    monthly_hits:      0,  // getMonthlyStats served from fresh snapshot row
    monthly_misses:    0,  // getMonthlyStats triggered recompute
    recomputes:        0,  // Total recompute executions (stats + monthly)
    lock_contentions:  0,  // Recompute skipped because lock was held
  },
  // ── PDF Render volume ──────────────────────────────────────────────────────
  pdf_renders: {
    puppeteer: 0,  // Actual Puppeteer renders (costly CPU path)
    invoice:   0,  // Actual pdf-lib renders
  },
  lastReset: new Date().toISOString(),
};

// ── Webhooks ────────────────────────────────────────────────────────────────

export function incrementWebhook(success: boolean) {
  metrics.webhooks.total++;
  if (success) {
    metrics.webhooks.success++;
  } else {
    metrics.webhooks.errors++;
    metrics.webhooks.last_error = new Date().toISOString();
  }
}

// ── Payments ────────────────────────────────────────────────────────────────

export function incrementPayment(type: "created" | "success" | "failed" | "reconciled") {
  metrics.payments[type]++;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function incrementAuth(type: "login_success" | "login_failed" | "refresh_success" | "refresh_failed" | "token_reuse_detected") {
  metrics.auth[type]++;
}

// ── PDF Cache ────────────────────────────────────────────────────────────────

export function incrementPdfCache(type: "receipt_hit" | "receipt_miss" | "invoice_hit" | "invoice_miss") {
  if (type === "receipt_hit")   { metrics.pdf_cache.receipt_hits++;   metrics.pdf_renders.puppeteer += 0; return; }
  if (type === "receipt_miss")  { metrics.pdf_cache.receipt_misses++; metrics.pdf_renders.puppeteer++;    return; }
  if (type === "invoice_hit")   { metrics.pdf_cache.invoice_hits++;                                       return; }
  if (type === "invoice_miss")  { metrics.pdf_cache.invoice_misses++; metrics.pdf_renders.invoice++;      return; }
}

// ── Snapshot ────────────────────────────────────────────────────────────────

export function incrementSnapshot(
  type: "stats_hit" | "stats_miss" | "monthly_hit" | "monthly_miss" | "recompute" | "lock_contention"
) {
  if (type === "stats_hit")        { metrics.snapshot.stats_hits++;        return; }
  if (type === "stats_miss")       { metrics.snapshot.stats_misses++;      metrics.snapshot.recomputes++; return; }
  if (type === "monthly_hit")      { metrics.snapshot.monthly_hits++;      return; }
  if (type === "monthly_miss")     { metrics.snapshot.monthly_misses++;    metrics.snapshot.recomputes++; return; }
  if (type === "recompute")        { metrics.snapshot.recomputes++;        return; }
  if (type === "lock_contention")  { metrics.snapshot.lock_contentions++;  return; }
}

// ── Read ─────────────────────────────────────────────────────────────────────

export function getMetrics() {
  const totalReceiptRequests = metrics.pdf_cache.receipt_hits + metrics.pdf_cache.receipt_misses;
  const totalInvoiceRequests = metrics.pdf_cache.invoice_hits + metrics.pdf_cache.invoice_misses;
  const totalSnapshotStats   = metrics.snapshot.stats_hits   + metrics.snapshot.stats_misses;
  const totalSnapshotMonthly = metrics.snapshot.monthly_hits + metrics.snapshot.monthly_misses;

  return {
    ...metrics,
    webhook_success_rate: metrics.webhooks.total > 0
      ? (metrics.webhooks.success / metrics.webhooks.total) * 100
      : 100,
    // Derived hit-rate percentages
    receipt_pdf_hit_rate_pct: totalReceiptRequests > 0
      ? Math.round((metrics.pdf_cache.receipt_hits / totalReceiptRequests) * 100)
      : null,
    invoice_pdf_hit_rate_pct: totalInvoiceRequests > 0
      ? Math.round((metrics.pdf_cache.invoice_hits / totalInvoiceRequests) * 100)
      : null,
    snapshot_stats_hit_rate_pct: totalSnapshotStats > 0
      ? Math.round((metrics.snapshot.stats_hits / totalSnapshotStats) * 100)
      : null,
    snapshot_monthly_hit_rate_pct: totalSnapshotMonthly > 0
      ? Math.round((metrics.snapshot.monthly_hits / totalSnapshotMonthly) * 100)
      : null,
  };
}

// ── Reset ─────────────────────────────────────────────────────────────────────

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
  metrics.pdf_cache.receipt_hits = 0;
  metrics.pdf_cache.receipt_misses = 0;
  metrics.pdf_cache.invoice_hits = 0;
  metrics.pdf_cache.invoice_misses = 0;
  metrics.snapshot.stats_hits = 0;
  metrics.snapshot.stats_misses = 0;
  metrics.snapshot.monthly_hits = 0;
  metrics.snapshot.monthly_misses = 0;
  metrics.snapshot.recomputes = 0;
  metrics.snapshot.lock_contentions = 0;
  metrics.pdf_renders.puppeteer = 0;
  metrics.pdf_renders.invoice = 0;
  metrics.lastReset = new Date().toISOString();
}

