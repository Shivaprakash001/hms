ALTER TABLE "public"."plans"
ADD COLUMN IF NOT EXISTS "can_generate_receipts" BOOLEAN NOT NULL DEFAULT false;

UPDATE "public"."plans"
SET "can_generate_receipts" = true
WHERE UPPER("id") IN ('GROWTH', 'BUSINESS', 'SCALE')
   OR LOWER("name") IN ('growth', 'business', 'scale');
