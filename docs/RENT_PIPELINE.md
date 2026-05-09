# RENT_PIPELINE.md

> Documentation of the `RentGenerationService` (`lib/services/rent-generation-service.ts`).

---

## 1. Trigger Sources
- **Cron**: `/api/cron/generate-rent` triggers on the 1st of every month.
- **Manual**: Owners can trigger generation via `/api/rent/generate` in the dashboard.

## 2. Locking & Concurrency Prevention
**FACT:** Generation uses a global database lock in the `system_locks` table.
- **Key Format**: `rent_gen_<ownerId>_<YYYY-MM>` (or `global` for cron).
- **Mechanism**: Raw SQL `INSERT ... ON CONFLICT DO UPDATE WHERE expires_at < NOW()`.
- **Result**: Completely eliminates overlapping execution for the same owner/month.

## 3. Plan Enforcement & Preferences
- Automatically skips owners if their SaaS plan lacks the `automation` feature (`planEnforcementService.assertFeature`).
- Skips owners if `auto_generate_rent` is `false` in their hostel preferences (unless triggered manually).
- Validates the generation date against `auto_rent_day` timezone-adjusted config.

## 4. Idempotency & The Ledger
**FACT:** The system maintains a `rent_generation_ledgers` table.
- Before generating, the engine checks `rentGenerationLedgerService.hasCompleted`.
- If a run fails mid-flight, the ledger correctly reflects `FAILED` or `SKIPPED`, allowing manual retries.
- The `rent_obligations` table itself has a unique constraint on `(allocation_id, rent_month, obligation_type)` preventing double rows at the schema level.

## 5. Transaction Atomicity
- RENT and MAINTENANCE obligations are computed in memory.
- Written to DB using a single `$transaction` wrapping `createMany`.
- If the batch fails, the transaction rolls back, and the ledger marks the failure.

## 6. Observability
- Emits structured anomaly events (`ZERO_RENT_GENERATED`, `GENERATION_TIMEOUT`, `LOCK_CONTENTION`) to the `eventLog`.
- Logs duration and skipped/failed counts to `RentGenerationLog`.
