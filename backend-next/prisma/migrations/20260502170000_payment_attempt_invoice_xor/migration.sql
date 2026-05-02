-- Ensure payment_attempts supports invoice-backed SaaS billing attempts
ALTER TABLE payment_attempts
  ADD COLUMN IF NOT EXISTS invoice_id UUID;

ALTER TABLE payment_attempts
  ALTER COLUMN obligation_id DROP NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.owner_invoices') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'payment_attempts_invoice_id_fkey'
    )
  THEN
    ALTER TABLE payment_attempts
      ADD CONSTRAINT payment_attempts_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES owner_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_attempts_obligation_invoice_xor_check'
  ) THEN
    ALTER TABLE payment_attempts
      ADD CONSTRAINT payment_attempts_obligation_invoice_xor_check
      CHECK (((obligation_id IS NOT NULL)::int + (invoice_id IS NOT NULL)::int) = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice_id
  ON payment_attempts(invoice_id);
