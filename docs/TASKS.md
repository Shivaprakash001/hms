# TASKS.md

> Documented issues and technical debt in the HMS system.
> Last updated: May 2026

---

## 🚨 Active Technical Debt & Drift Issues

| ID | Issue | Severity | Operational Risk | Affected Files |
|----|-------|----------|------------------|----------------|
| **T-100** | **Complaints Table Drift**<br>Prisma schema still defines a `Complaint` model, but the underlying Postgres table was explicitly dropped in `migrations/025_drop_complaints_system.sql`. | HIGH | Any Prisma query against `Complaint` will throw a fatal 500 error at runtime. | `schema.prisma` |
| **T-101** | **Tenant/Student Schema Drift**<br>The DB table was renamed from `students` to `tenants` via manual migration 008. However, migration 043 still references `students` for constraint drops/adds, and migration 045 attempts to add `gender` to `students`. | HIGH | Running Prisma migrations on a fresh DB will crash due to missing tables. Backup scripts also reference `students`. | `migrations/043_*.sql`, `migrations/045_*.sql`, `tenant-service.ts` |
| **T-102** | **Backup Workflow Drift**<br>GitHub Action backup workflows (`.github/workflows/db-backup.yml`) rely on legacy column names (`student_id`, `amount`, `month`, `year`) when dumping finance CSVs. | HIGH | Backups and weekly verifications will silently fail or skip data. | `.github/workflows/db-backup.yml`, `scripts/backup/*.sh` |
| **T-103** | **Python Legacy Naming**<br>If the removed Python codebase is ever resurrected, its routers explicitly query `students`, which no longer exists. | LOW | Negligible, backend deleted. | `backend/` (deleted) |

## ✅ Resolved Issues (Phase 1-4)

- **T-001**: Python Backend Removed.
- **T-002**: Complaints Feature Removed (Frontend & API).
- **T-004**: Auth Refresh Implemented (2-token system).
- **T-005**: Webhook O(1) direct lookup.
- **T-007**: Race Condition Prevention in payments (Row-level locking).
- **T-011**: Reconciliation Cron Job.