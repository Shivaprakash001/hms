-- Migration: add_payment_attempt_obligations
-- Creates junction table for multi-obligation payments
-- Allows payment attempts to link to multiple obligations

BEGIN;

-- Create junction table
CREATE TABLE IF NOT EXISTS "payment_attempt_obligations" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "payment_attempt_id" UUID NOT NULL REFERENCES "payment_attempts"(id) ON DELETE CASCADE,
    "obligation_id" UUID NOT NULL REFERENCES "rent_obligations"(id),
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ(6) DEFAULT now(),
    UNIQUE("payment_attempt_id", "obligation_id")
);

-- Add index for lookups
CREATE INDEX IF NOT EXISTS "payment_attempt_obligations_attempt_idx" ON "payment_attempt_obligations"("payment_attempt_id");
CREATE INDEX IF NOT EXISTS "payment_attempt_obligations_obligation_idx" ON "payment_attempt_obligations"("obligation_id");

-- Add backfill trigger function if not exists
CREATE OR REPLACE FUNCTION update_payment_attempt_obligation_link()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.obligation_id IS NOT NULL THEN
        INSERT INTO "payment_attempt_obligations" (payment_attempt_id, obligation_id, amount)
        VALUES (NEW.id, NEW.obligation_id, NEW.amount)
        ON CONFLICT ("payment_attempt_id", "obligation_id") DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS "payment_attempt_obligation_link_trg" ON "payment_attempts";

-- Create trigger to maintain linkage
CREATE TRIGGER "payment_attempt_obligation_link_trg"
    AFTER INSERT ON "payment_attempts"
    FOR EACH ROW
    WHEN (NEW.obligation_id IS NOT NULL)
    EXECUTE FUNCTION update_payment_attempt_obligation_link();

COMMIT;