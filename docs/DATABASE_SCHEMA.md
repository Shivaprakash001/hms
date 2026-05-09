# DATABASE_SCHEMA.md

> Source of truth: `backend-next/prisma/schema.prisma`
> Last updated: May 2026

---

## 1. Domain Boundaries & Core Models

### 1.1 Identity & Access
- `Profile` (`profiles`): The absolute source of truth for users. Contains `role` (ADMIN, OWNER, WARDEN, TENANT) and `owner_id` (self-referential FK indicating ownership scope).
- `Tenant` (`tenants`): Extended details for a tenant profile. Historically named `students`. FK to `Profile`.

### 1.2 Core Hierarchy
- `Hostel`: A physical property. Belongs to an `Owner` (`Profile`).
- `Room`: A room inside a `Hostel`. Has a `base_rent` and `capacity`.
- `RoomAllocation`: Maps a `Tenant` to a `Room` with start/end dates.

### 1.3 Financials
- `RentObligation`: Monthly dues generated for an allocation. Includes `amount`, `late_fee`, `due_date`, and `status`.
- `PaymentAttempt`: Tracks gateway (PhonePe) intents. Statuses: CREATED, PENDING, SUCCESS, FAILED.
- `Payment`: A finalized payment (manual or gateway).
- `TenantAdvanceLedger`: Tracks deposits and refunds.
- `Receipt`: PDF receipt record generated after a successful `Payment`.

### 1.4 SaaS Billing (Owner Scoped)
- `Plan`: Defines platform tier limits (`tenant_limit`, `automation` flag, etc.).
- `Subscription` & `OwnerSubscription`: Tracks the owner's billing lifecycle.
- `UsageTracking` & `OwnerUsageSnapshot`: Tracks tenant counts for overage billing (`OverflowLedger`).

### 1.5 Observability & Audit
- `RentGenerationLog`, `RentGenerationLedger`: Tracks rent cron runs and prevents double execution.
- `ActionLog`, `SystemEventLog`, `ActivityLog`: Assorted audit logs.
- `HostelInvariantCheck`, `MigrationAuditRun`, `FinancialInvariantFailure`: Deep system health monitors.

---

## 2. Drift & Schema Mismatches

### 2.1 The Dead Complaints Table
**DRIFT DETECTED:** The Prisma schema contains a `Complaint` model (`schema.prisma:643-664`).
**TRUTH:** `migrations/025_drop_complaints_system.sql` drops the `complaints` table in raw SQL. Any code calling `prisma.complaint.findMany` will crash in production because the table is missing from Postgres.

### 2.2 The Student vs. Tenant Naming Drift
**DRIFT DETECTED:** The underlying table was renamed from `students` to `tenants` via `migrations_manual/008_student_to_tenant_rename.sql`.
- Migration `043` references `students` (broken if applied after `008`).
- Migration `045` adds `gender` to `students`.
- `tenant-service.ts` explicitly strips `gender` on updates if Postgres complains about a missing column, indicating production drift where Prisma expects `gender` but Postgres lacks it due to bad migration ordering.

### 2.3 Orphaned Payment Columns in Backups
**DRIFT DETECTED:** As documented in `BACKUP_RECOVERY.md`, GitHub action scripts `db-backup.yml` attempt to export CSVs using legacy columns `student_id`, `amount`, `month`, `year` from the `payments` table. These columns do not exist in the current Prisma schema (it uses `tenant_id`, `amount_paid`, `payment_date`).
