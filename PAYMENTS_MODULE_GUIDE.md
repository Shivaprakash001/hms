# 💰 Payments & Billing Module - Technical Reference

## 🎯 Purpose
Implements a strict accounting lifecycle for hostel rent management, separating **Obligations** (what they owe) from **Payments** (what they paid).

---

## 🔧 Setup

### 1. Database Migration
Run `migrations/009_create_payment_tables.sql` in Supabase SQL Editor.

### 2. Required Data
Ensure `students` have a `monthly_rent` set and active `room_allocations`.

---

## 📡 API Endpoints

### Financial Management

| Method | Endpoint | Description | Auth Role |
|--------|----------|-------------|-----------|
| `POST` | `/payments/generate-monthly` | Bulk generate rent for a month | Admin Only |
| `POST` | `/payments/` | Record money received | Admin/Warden |
| `POST` | `/payments/obligations/{id}/waive` | Waive an unpaid rent | Admin Only |

### Reporting & History

| Method | Endpoint | Description | Auth Role |
|--------|----------|-------------|-----------|
| `GET` | `/payments/student/{id}`| Full history & balance | Admin/Warden/Own |
| `GET` | `/payments/dues` | List outstanding debts | Admin/Warden |

---

## 🧠 Core Business Logic

### 1. Obligation-First Accounting
Unlike simple CRUD billing, we first generate a `rent_obligation`. 
- **Duplicates**: Prohibited by `UNIQUE(student_id, rent_month)` constraint.
- **Due Dates**: Default to the 10th of the month.

### 2. Smart Proration 📏
The `generate-monthly` service automatically calculates prorated rent for:
- New students joining mid-month.
- Students leaving mid-month.
- Short stays (joining and leaving in the same month).
*Formula: `rent * (days_occupied / total_days_in_month)`.*

### 3. Payment Integrity
- **Append-Only**: Payments are never modified or deleted. Errors are handled via waivers or reversals.
- **Automatic Status**: Obligation status updates to `PARTIAL` or `PAID` as soon as payments are recorded.
- **Integrity**: Payment cannot exceed the remaining balance of an obligation.

---

## ⚡ Hooks & Events
The module publishes the following events for integration:
- `rent_obligation_created`
- `payment_recorded`
- `rent_waived`

---

## 📁 File Structure
- `backend/app/schamas/payment_schema.py`: Financial Pydantic models.
- `backend/app/services/payment_service.py`: Accounting engine and proration logic.
- `backend/app/api/routes/payment_router.py`: Secured billing API.
- `migrations/009_create_payment_tables.sql`: Financial table schema.

---

## 🧪 Verification Tasks
1. **Proration Test**: Allocate a student on the 15th of the month. Generate rent for that month. Verify amount is ~50% of monthly rent.
2. **Double Generation**: Run `generate-monthly` twice for the same month. Verify the second run skips all students.
3. **Partial Payment**: Record a payment for half the amount. Verify status is `PARTIAL`. Record the other half. Verify status is `PAID`.
