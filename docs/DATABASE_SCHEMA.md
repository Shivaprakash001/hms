# DATABASE_SCHEMA.md

> Source of truth: `backend-next/prisma/schema.prisma`
> Last updated: May 2026 (Phase 1 Complete)

> **Note:** Raw SQL migration files have been moved to `migrations/archive/`.
> Prisma schema is now the single source of truth.

---

## 1. Enums

**Current:**
```
Role            = { ADMIN, OWNER, WARDEN, TENANT }
TenantStatus    = { INVITED, ACTIVE, LEFT }
PaymentStatus   = { PENDING, PARTIAL, PAID, WAIVED }
AttemptStatus  = { CREATED, PENDING, SUCCESS, FAILED, EXPIRED, CANCELLED, PENDING_VERIFICATION }
DocumentStatus = { PENDING, APPROVED, REJECTED }
```

**Historical Note:** `TenantStatus` was previously `StudentStatus`, renamed via migration.

**CONFIDENCE:** HIGH

---

## 2. Tables (Prisma models → Postgres tables)

All table names below are Prisma `@@map` targets.

### 2.1 `profiles`  (`Profile`)

Columns: `id UUID PK`, `email UNIQUE`, `name`, `phone?`, `password_hash?`,
`role Role`, `is_active BOOL=false`, `is_profile_completed BOOL=false`,
`address? city? state? pincode?`, `created_at`, `updated_at?`,
`invitation_token? UNIQUE`, `invitation_expires_at?`, `owner_id? UUID`
(self-FK → profiles), `emergency_contact?`.

Relations: self (`OwnerTenant`), `hostels`, `expenses`, `notifications`,
`tenant_details` (1-1 → Tenant).

**SOURCE:** `backend-next/prisma/schema.prisma:13-46`.
**CONFIDENCE:** HIGH

### 2.2 `tenants`  (`Tenant`)

Columns: `id UUID PK`, `profile_id UUID UNIQUE` (FK→profiles),
`profile_type TEXT DEFAULT "STUDENT"`, `monthly_rent DECIMAL(10,2)?`,
`joined_on DATE?`, `status TenantStatus DEFAULT INVITED`,
`owner_id? UUID`, `profile_completed BOOL=false`, `photo_url?`,
`phone_1? phone_2? phone_3?`, `personal_email?`, `college_name?
roll_number? course? year_of_study?(Int) section? branch?`,
`office_name? office_location? job_role?`, `gender?`,
`permanent_address? temporary_address?`, `aadhaar_number? UNIQUE`,
`document_verified BOOL=false`, `created_at`, `updated_at?`.

**SOURCE:** `backend-next/prisma/schema.prisma:48-92`.
**CONFIDENCE:** HIGH

**HISTORY FACT:** The physical table was originally `students`. It was renamed
to `tenants` by
`backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`,
which also renamed `student_id → tenant_id` across `room_allocations`,
`rent_obligations`, `payments`, `payment_attempts`,
`identification_documents`, `reactivation_requests`, `complaints`,
`receipts`, `reminder_logs`, `system_event_logs`.

**CONFIDENCE:** HIGH

### 2.3 `hostels`  (`Hostel`)

Columns: `id`, `owner_id UUID→profiles`, `name`, `phone`, `address`,
`city? state? pincode?`, `upi_id? gst_number?`, `is_active BOOL=true`,
`currency VARCHAR(3)="INR"`, `rent_cycle="MONTHLY"`, `receipt_prefix="HMS"`,
`timezone="UTC"`, `auto_rent_day INT=1`, `phonepe_merchant_id?`,
`logo_url?`, `preferences_config JSON?`, `created_at`, `updated_at?`.

**SOURCE:** `backend-next/prisma/schema.prisma:94-121`.
**CONFIDENCE:** HIGH

### 2.4 `rooms`  (`Room`)

Columns: `id`, `hostel_id→hostels`, `room_no`, `floor?(Int)`, `capacity INT`,
`room_type?`, `is_active BOOL=true`, `base_rent?(Int)`, timestamps.

**SOURCE:** `schema.prisma:123-141`.

### 2.5 `room_activity_logs`  (`RoomActivityLog`)
id, room_id→rooms, owner_id, action, previous_value?, new_value?, created_at.
**SOURCE:** `schema.prisma:143-157`.

### 2.6 `room_allocations`  (`RoomAllocation`)
id, tenant_id, room_id, start_date, end_date?, is_active=true, timestamps.
**SOURCE:** `schema.prisma:159-176`.

### 2.7 `rent_obligations`  (`RentObligation`)
id, tenant_id, allocation_id?, owner_id?, rent_month (DATE),
amount DECIMAL(10,2), late_fee DECIMAL(10,2)?=0, total_amount DECIMAL(10,2),
due_date, status PaymentStatus=PENDING, obligation_type TEXT="RENT".
Unique (`allocation_id`, `rent_month`, `obligation_type`).
**SOURCE:** `schema.prisma:178-202`.

### 2.8 `reminder_logs`  (`ReminderLog`)
id, obligation_id, tenant_id, reminder_type, channel="IN_APP", sent_at.
**SOURCE:** `schema.prisma:204-218`.

### 2.9 `rent_generation_logs`  (`RentGenerationLog`)
id, rent_month, trigger_type, triggered_by?, counts (total_allocations,
obligations_created/skipped/failed), duration_ms?, errors?, created_at.
**SOURCE:** `schema.prisma:220-237`.

### 2.10 `system_locks`  (`SystemLock`)
key PK, locked_at, expires_at.
**SOURCE:** `schema.prisma:239-246`.

### 2.11 `payments`  (`Payment`)
id, obligation_id, tenant_id, owner_id?, amount_paid DECIMAL(10,2),
payment_method, reference_number?, payment_date DATE,
payment_attempt_id?, payment_group_id?, idempotency_key? UNIQUE, created_at.
**SOURCE:** `schema.prisma:248-274`.

### 2.12 `payment_attempts`  (`PaymentAttempt`)
id, obligation_id, tenant_id, owner_id, provider,
merchant_txn_id UNIQUE, gateway_txn_id? UNIQUE, amount DECIMAL(10,2),
status AttemptStatus=CREATED, upi_intent_url?, qr_payload?, expires_at?,
confirmed_at?, raw_create_response JSON?, raw_webhook_payload JSON?,
checkout_url?, timestamps.
**SOURCE:** `schema.prisma:276-301`.

### 2.13 `identification_documents`  (`IdentificationDocument`)
id, tenant_id, doc_type, doc_number?, file_url, is_verified=false,
uploaded_by?, document_status DocumentStatus=PENDING,
file_id? (ImageKit), rejection_reason?, created_at.
**SOURCE:** `schema.prisma:303-321`.

### 2.14 `reactivation_requests`  (`ReactivationRequest`)
id, tenant_id, owner_id, requested_by_profile_id, current_status,
status TEXT DEFAULT "PENDING", notes?, processed_at?, processed_by?,
created_at.
**SOURCE:** `schema.prisma:323-338`.

### 2.15 `notifications`  (`Notification`)
id, profile_id, title, message, type, is_read=false, created_at.
**SOURCE:** `schema.prisma:340-352`.

### 2.16 `token_blacklist`  (`TokenBlacklist`)
id SERIAL, token UNIQUE, expires_at, created_at.
**SOURCE:** `schema.prisma:354-362`.

### 2.17 `activity_logs`  (`ActivityLog`)
id, user_id, owner_id?, action_type, entity_type, entity_id?, metadata JSON?,
timestamp.
**SOURCE:** `schema.prisma:364-376`.

### 2.18 `expenses`  (`Expense`)
id, owner_id, title, amount DECIMAL(10,2), date, category,
status TEXT="paid", created_at.
**SOURCE:** `schema.prisma:378-394`.

### 2.19 `complaints`  (`Complaint`)
id, tenant_id, owner_id, title, description, category, status="PENDING",
priority="MEDIUM", resolved_at?, comment?, timestamps.
**SOURCE:** `schema.prisma:396-413`.
**FLAG:** See section 4.1 (`[SCHEMA MISMATCH DETECTED]`).

### 2.20 `receipts`  (`Receipt`)
id, receipt_number UNIQUE, payment_id UNIQUE→payments,
tenant_id, owner_id?, amount DECIMAL(10,2), payment_method,
transaction_id?, hostel_name?, tenant_name?, rent_month?, issued_at,
invoice_pdf_url?, invoice_template_version?(Int).
**SOURCE:** `schema.prisma:415-435`.

### 2.21 `system_event_logs`  (`SystemEventLog`)
id, event_type, owner_id?, tenant_id?, metadata JSON?, created_at.
**SOURCE:** `schema.prisma:437-450`.

---

## 3. Tables present in SQL migrations but NOT modeled in Prisma

### 3.1 `plans`, `owner_subscriptions`, `owner_invoices`

**FACT:** Created (and seeded with STARTER/PRO/BUSINESS) in
`migrations/031_create_billing_and_plans_tables.sql`. No Prisma model exists
for any of these tables.

**SOURCE:** `migrations/031_create_billing_and_plans_tables.sql` (full file);
`backend-next/prisma/schema.prisma` (absence verified by full read).

**FLAG:** `[SCHEMA MISMATCH DETECTED]` — code that references these tables
(e.g. a proper `BillingService`) cannot rely on Prisma typing; the current
`BillingService` sidesteps this by returning hard-coded data
(`backend-next/lib/services/billing-service.ts:28-42`).

**CONFIDENCE:** HIGH

---

## 4. Schema mismatches & drift

### 4.1 Complaints table — DROPPED by migration 025 but still in schema

**FACT:** `migrations/025_drop_complaints_system.sql` executes
`DROP TABLE IF EXISTS complaints CASCADE` and drops associated enum types
(`complaint_status`, `complaint_priority`, `complaint_category`).
The Prisma `Complaint` model (`schema.prisma:396-413`) still exists, the
route handlers `backend-next/app/api/complaints/route.ts` still use
`prisma.complaint.*`, and the frontend pages `Complaints.jsx`,
`TenantComplaints.jsx` still fetch them.

**FLAG:** `[SCHEMA MISMATCH DETECTED]` — any runtime `prisma.complaint.*` call
will fail with "relation does not exist" on a DB where migration 025 has
been applied.

**SOURCE:** `migrations/025_drop_complaints_system.sql`,
`backend-next/prisma/schema.prisma:396-413`,
`backend-next/app/api/complaints/route.ts`.

**CONFIDENCE:** HIGH

### 4.2 `tenants.gender` — duplicated / conflicting migrations

**FACT:** Three separate migration sources add `gender` to what used to be
`students`:
- `backend-next/prisma/migrations_manual/add_gender.sql` →
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT;`
- `migrations/045_add_gender_to_students.sql` →
  `ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender TEXT;`

After migration 008 (in `migrations_manual/`) the table is renamed
`students → tenants`. The Prisma schema declares `gender String?` on
`Tenant` (= `tenants` table). `migrations/045` targets the old name
`students` and will fail/no-op if applied after 008.

**FLAG:** `[SCHEMA MISMATCH DETECTED]` — application order dependent;
`tenant-service.ts:245-256` contains a runtime fallback that strips `gender`
from the update payload if the error message mentions `tenants.gender`,
confirming the authors have observed this drift in production.

**SOURCE:**
- `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`
- `backend-next/prisma/migrations_manual/add_gender.sql`
- `migrations/045_add_gender_to_students.sql`
- `backend-next/prisma/schema.prisma:71`
- `backend-next/lib/services/tenant-service.ts:245-256`

**CONFIDENCE:** HIGH

### 4.3 Student/Tenant naming dual-track

**FACT:** The Python backend (`backend/app/`) still uses the `students`
nomenclature throughout routers (e.g. `student_router.py`), but the Next.js
backend uses the renamed `tenants` table via Prisma. If both backends hit
the same database concurrently, the Python side will fail because the
`students` table no longer exists after migrations_manual/008.

**SOURCE:** `backend/app/api/routes/student_router.py` (21,708 bytes),
`backend/app/main.py:12`, `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`.

**FLAG:** `[SCHEMA MISMATCH DETECTED]` — between the active Python codebase
and the migrated database.

**CONFIDENCE:** HIGH

### 4.4 Student-status constraint migration 043 references `students`

**FACT:** `migrations/043_tenant_lifecycle_and_reactivation_requests.sql`
issues `ALTER TABLE students DROP CONSTRAINT …` and `ALTER TABLE students ADD
CONSTRAINT … CHECK (status IN ('INVITED','ACTIVE','LEFT'))`, and creates
`reactivation_requests` with `student_id UUID REFERENCES public.students(id)`.

The `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`
renames `students → tenants` and `student_id → tenant_id` on
`reactivation_requests`.

**FLAG:** `[SCHEMA MISMATCH DETECTED]` if 043 is applied AFTER
`migrations_manual/008`, it will fail because `students` no longer exists
and `reactivation_requests.student_id` was renamed to `tenant_id`.

**SOURCE:**
- `migrations/043_tenant_lifecycle_and_reactivation_requests.sql`
- `backend-next/prisma/migrations_manual/008_student_to_tenant_rename.sql`

**CONFIDENCE:** HIGH

---

## 5. Migration directory summary

**FACT:** There are two independent, chronologically overlapping migration
directories with partially conflicting DDL:
- `migrations/` — 51 `.sql` files, numbered `004…045, 999_seed_admin`.
- `backend-next/prisma/migrations_manual/` — 14 `.sql` files, `001_upi_direct_payment` … `014_payment_hardening`, plus `add_gender.sql`.

Ordering semantics (alphabetical vs. timestamp vs. manual) are not declared
in code. `[INSUFFICIENT EVIDENCE]` for the canonical apply order.

**SOURCE:** directory listings of `migrations/` and
`backend-next/prisma/migrations_manual/`.

**CONFIDENCE:** HIGH (existence), LOW (intended order).
