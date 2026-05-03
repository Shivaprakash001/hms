-- ============================================================
-- HMS: Apply all pending migrations via Supabase SQL Editor
-- All statements are fully idempotent — safe to re-run.
-- Run the ENTIRE script at once.
-- ============================================================

-- ── SAFETY NET: Drop XOR constraint if still present ────────
-- (add_payment_attempt_obligations migration may not have run)
-- ADVANCE payments have neither obligation_id nor invoice_id,
-- so the constraint must be gone before advance payments work.
ALTER TABLE payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_obligation_invoice_xor_check;

-- ============================================================
-- MIGRATION: 20260503000000_advance_ledger_dob
-- ============================================================

-- 1. Enums (guarded against duplicate)
DO $$ BEGIN
  CREATE TYPE "AdvanceLedgerType" AS ENUM ('CREDIT', 'DEBIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AdvanceLedgerReason" AS ENUM ('DEPOSIT', 'TOPUP', 'ADJUSTMENT', 'DEDUCTION', 'REFUND', 'CORRECTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. date_of_birth column on tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 3. TenantAdvanceLedger table
CREATE TABLE IF NOT EXISTS tenant_advance_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  owner_id       UUID NOT NULL,
  type           "AdvanceLedgerType" NOT NULL,
  reason         "AdvanceLedgerReason" NOT NULL,
  amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  balance_after  NUMERIC(10,2) NOT NULL CHECK (balance_after >= 0),
  notes          TEXT,
  reference_id   UUID,
  reference_type TEXT,
  created_by     UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tal_tenant_id ON tenant_advance_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tal_owner_id  ON tenant_advance_ledger(owner_id);
CREATE INDEX IF NOT EXISTS idx_tal_tenant_ts ON tenant_advance_ledger(tenant_id, created_at);

-- ============================================================
-- MIGRATION: 20260503120000_advance_payment_type_idempotency
-- ============================================================

-- 4. payment_type on payment_attempts
ALTER TABLE payment_attempts
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'RENT';

-- 5. refund_status on tenant_advance_ledger
ALTER TABLE tenant_advance_ledger
  ADD COLUMN IF NOT EXISTS refund_status TEXT;

-- 6. Partial unique index — idempotency guard for webhook retries.
--    Prevents duplicate CREDIT/DEBIT for the same source record.
--    NULL reference_id rows are excluded (manual entries not constrained).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tal_ref_idempotency
  ON tenant_advance_ledger(reference_id, reference_type)
  WHERE reference_id IS NOT NULL;

-- ============================================================
-- Mark these migrations as applied in Prisma's tracking table
-- so `prisma migrate status` stays in sync.
-- ============================================================
INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid(), 'manual_apply', NOW(),
  '20260503000000_advance_ledger_dob', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260503000000_advance_ledger_dob'
);

INSERT INTO "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid(), 'manual_apply', NOW(),
  '20260503120000_advance_payment_type_idempotency', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260503120000_advance_payment_type_idempotency'
);
