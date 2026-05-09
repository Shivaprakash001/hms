# BACKUP_RECOVERY.md

> ACTUAL operational recovery procedures and analysis.

---

## 1. Backup Topology & Schedules

**FACT:** Backups rely on GitHub Actions workflows (`.github/workflows/db-backup.yml`).
- **Monthly Permanent Snapshot**: 1st of month. Full `pg_dump` encrypted with GPG, pushed to Supabase Storage (`snapshots/`).
- **Daily Full Dump**: Pushed to GitHub Artifacts and Supabase Storage (GPG encrypted).
- **Daily Finance Dump**: Targets `payments`, `payment_attempts`, `rent_obligations`.

## 2. 🚨 CRITICAL DRIFT RISK IN BACKUPS 🚨

**FACT:** The backup scripts contain severe schema drift that jeopardizes restoration and verification.
1. The `verify-weekly` job explicitly counts the `students` table. The table was renamed to `tenants`. The verification will fail.
2. The CSV export step for financial backups runs:
   `SELECT * FROM payments`
   But legacy comments note it relies on `student_id`, `amount`, `month`, `year`. The current schema uses `tenant_id`, `amount_paid`, `payment_date`. Any script assuming old column names will crash.

**CONFIDENCE:** HIGH. Evidence found in legacy backup docs and schema rename migrations.

## 3. Restore Procedures

### Full Restore
```bash
./scripts/backup/restore-db.sh full backups/full/full_backup_*.dump
```

### Decrypting Supabase Snapshots
Requires the `BACKUP_GPG_PASSPHRASE`.
```bash
gpg --batch --yes --passphrase "$BACKUP_GPG_PASSPHRASE" -o full.sql.gz -d full.sql.gz.gpg
gunzip full.sql.gz
psql "$DIRECT_URL" -f full.sql
```

## 4. Secrets Required
- `DIRECT_URL`: Must point directly to Postgres port 5432 (not a connection pooler), otherwise `pg_dump` will fail.
- `SUPABASE_SERVICE_ROLE_KEY` & `SUPABASE_URL`: For pushing backups to buckets.
- `BACKUP_GPG_PASSPHRASE`: AES256 symmetric key for snapshot encryption.
