-- Migration 054: Tenant Overflow Billing
--
-- Adds infrastructure for overflow billing beyond plan tenant limits:
--   • plans: overflow config columns (enabled, price_per_tenant_paise, hard_cap)
--   • owner_invoices: line_items JSONB for structured invoice breakdown
--   • owner_usage_snapshots: monthly peak usage records
--   • overflow_ledger: immutable overflow billing records (one per owner per month)
--
-- Business rules encoded:
--   STARTER: ₹10/tenant/mo over 100 included, hard cap 150
--   GROWTH:  ₹8/tenant/mo  over 300 included, hard cap 400
--   FREE/BUSINESS/SCALE: overflow_enabled = FALSE (FREE = hard block, others = unlimited)

BEGIN;

-- ── 1. Overflow config on plans ───────────────────────────────────────────────

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS overflow_enabled               BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overflow_price_per_tenant_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overflow_hard_cap              INTEGER  NOT NULL DEFAULT 0;

COMMENT ON COLUMN plans.overflow_enabled IS 'Whether paid overflow tenants are allowed on this plan';
COMMENT ON COLUMN plans.overflow_price_per_tenant_paise IS 'Per-extra-tenant charge per month in paise (1000 = ₹10)';
COMMENT ON COLUMN plans.overflow_hard_cap IS 'Absolute ceiling for active tenants (included + overflow). 0 = no cap.';

UPDATE plans SET
  overflow_enabled                = TRUE,
  overflow_price_per_tenant_paise = 1000,
  overflow_hard_cap               = 150
WHERE id = 'STARTER';

UPDATE plans SET
  overflow_enabled                = TRUE,
  overflow_price_per_tenant_paise = 800,
  overflow_hard_cap               = 400
WHERE id = 'GROWTH';

-- FREE has no overflow (hard block at tenant_limit)
-- BUSINESS/SCALE have tenant_limit = 0 (unlimited) — overflow not applicable

-- ── 2. Structured line items on owner_invoices ────────────────────────────────

ALTER TABLE owner_invoices
  ADD COLUMN IF NOT EXISTS line_items JSONB;

COMMENT ON COLUMN owner_invoices.line_items IS
  'Array of line item objects: [{type, description, quantity, unit_price_paise, amount_paise}]';

-- ── 3. Monthly usage snapshots ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS owner_usage_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID        NOT NULL,
  billing_month         DATE        NOT NULL,
  plan_id               TEXT        NOT NULL,
  active_tenant_count   INTEGER     NOT NULL DEFAULT 0,
  included_limit        INTEGER     NOT NULL DEFAULT 0,
  overflow_tenant_count INTEGER     NOT NULL DEFAULT 0,
  overflow_amount_paise INTEGER     NOT NULL DEFAULT 0,
  peak_tenant_count     INTEGER     NOT NULL DEFAULT 0,
  snapshot_taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT owner_usage_snapshots_owner_month_uniq UNIQUE (owner_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_ous_owner_id      ON owner_usage_snapshots (owner_id);
CREATE INDEX IF NOT EXISTS idx_ous_billing_month ON owner_usage_snapshots (billing_month);

COMMENT ON TABLE owner_usage_snapshots IS
  'Monthly tenant usage snapshots captured at billing time for audit and analytics';

-- ── 4. Overflow ledger (immutable billing records) ───────────────────────────

CREATE TABLE IF NOT EXISTS overflow_ledger (
  id                              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                        UUID        NOT NULL,
  billing_month                   DATE        NOT NULL,
  plan_id                         TEXT        NOT NULL,
  active_tenant_count             INTEGER     NOT NULL,
  included_limit                  INTEGER     NOT NULL,
  overflow_count                  INTEGER     NOT NULL DEFAULT 0,
  overflow_price_per_tenant_paise INTEGER     NOT NULL DEFAULT 0,
  overflow_amount_paise           INTEGER     NOT NULL DEFAULT 0,
  invoice_id                      UUID        REFERENCES owner_invoices(id) ON DELETE SET NULL,
  status                          TEXT        NOT NULL DEFAULT 'PENDING'
                                    CHECK (status IN ('PENDING', 'INVOICED', 'WAIVED', 'ZERO')),
  idempotency_key                 TEXT        NOT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at                    TIMESTAMPTZ,
  CONSTRAINT overflow_ledger_idempotency_uniq   UNIQUE (idempotency_key),
  CONSTRAINT overflow_ledger_owner_month_uniq   UNIQUE (owner_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_ol_owner_id      ON overflow_ledger (owner_id);
CREATE INDEX IF NOT EXISTS idx_ol_billing_month ON overflow_ledger (billing_month);
CREATE INDEX IF NOT EXISTS idx_ol_status        ON overflow_ledger (status);

COMMENT ON TABLE overflow_ledger IS
  'Immutable overflow billing records — one per owner per billing month';
COMMENT ON COLUMN overflow_ledger.idempotency_key IS
  'Format: {owner_id}:{YYYY-MM-01} — prevents double billing on cron retries';
COMMENT ON COLUMN overflow_ledger.status IS
  'PENDING=awaiting, INVOICED=invoice created, WAIVED=manually zeroed, ZERO=no overflow this month';

COMMIT;
