# Tenant Data Architecture

This document defines the canonical source of truth for tenant identity and profile data in HMS.

## Core Rule

Every field must have exactly one canonical owner table/relation.
Read APIs and UI must use that canonical source directly, not fall back to duplicated fields.

## Source of Truth Matrix

| Field | Source of Truth | Notes |
| --- | --- | --- |
| `full_name` | `profiles.name` | Tenant identity field used across auth and profile. |
| `email` | `profiles.email` | Login/identity email. |
| `phone` | `profiles.phone` | Primary personal phone. |
| `emergency_contact` | `profiles.emergency_contact` | Canonical emergency contact. Do not mirror to tenant phone fields. |
| `personal_email` | `tenants.personal_email` | Optional alternate email for tenant record. |
| `gender` | `tenants.gender` | Tenant demographic field. |
| `date_of_birth` | `tenants.date_of_birth` | Tenant demographic field. |
| `profile_type` | `tenants.profile_type` | Canonical enum values only: `STUDENT`, `WORKING_PROFESSIONAL`. |
| `college_name` | `tenants.college_name` | Student profile fields. |
| `roll_number` | `tenants.roll_number` | Student profile fields. |
| `course` | `tenants.course` | Student profile fields. |
| `branch` | `tenants.branch` | Student profile fields. |
| `year_of_study` | `tenants.year_of_study` | Student profile fields. |
| `section` | `tenants.section` | Student profile fields. |
| `office_name` | `tenants.office_name` | Working professional profile fields. |
| `office_location` | `tenants.office_location` | Working professional profile fields. |
| `job_role` | `tenants.job_role` | Working professional profile fields. |
| `temporary_address` | `tenants.temporary_address` | Tenant address fields. |
| `permanent_address` | `tenants.permanent_address` | Tenant address fields. |
| `room_assignment` | `room_allocations` relation (`is_active=true`, `end_date IS NULL`) + joined `rooms` | Never read room assignment from cached/profile fields. |
| `profile_completed` | `tenants.profile_completed` + `profiles.is_profile_completed` | Must be updated atomically in one transaction. |

## Onboarding Persistence Contract

The onboarding endpoint (`POST /api/tenants/me/complete-profile`) must persist tenant profile completion data in **one transaction**:

1. Update `profiles` canonical identity/contact fields.
2. Update `tenants` canonical tenant/profile fields.
3. Create onboarding document records (when provided).
4. Mark completion flags.

If any step fails, all onboarding writes rollback.

## Room Assignment Contract

Tenant profile APIs must derive room state from active allocation relation only:

- `tenant.allocations` filtered by `is_active = true` and `end_date = null`
- ordered by `start_date desc`
- take latest active allocation
- join `room` for `room_no` and `floor`

No fallback to cached room fields in frontend state.

## Enum Contract

`profile_type` storage values are restricted to:

- `STUDENT`
- `WORKING_PROFESSIONAL`

Frontend may map to display labels:

- `STUDENT` -> `Student`
- `WORKING_PROFESSIONAL` -> `Working Professional`

UI labels must never be persisted to DB.

## Anti-Patterns (Do Not Reintroduce)

- Dual-write the same semantic field into multiple columns.
- Use frontend fallback chains that mask backend persistence bugs.
- Derive canonical room state from stale user cache/session fields.
- Write onboarding data across separate non-transactional DB operations.
