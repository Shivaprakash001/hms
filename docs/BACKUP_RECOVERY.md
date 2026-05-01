# Database Backup & Recovery

Runbook for the HMS Supabase Postgres database. Anchored in
`.github/workflows/db-backup.yml` and `scripts/backup/*.sh`.

> ⚠️ **Known drift:** The workflow's weekly-verify job and CSV export step
> still reference the pre-rename `students` table and legacy `payments`
> columns (`student_id`, `amount`, `status`, `month`, `year`). These will
> cause failures on the current schema. See `docs/TASKS.md:T-020`.

---

## Layers

| # | Mechanism | Schedule | Retention |
|---|---|---|---|
| 0 | **Monthly permanent snapshot** (`monthly-snapshot` job) — full `pg_dump` encrypted with GPG, uploaded to Supabase Storage at `snapshots/<YYYY-MM>/full.sql.gz.gpg`, and attached to the run as a permanent GitHub Artifact. | 1st of each month, 02:30 UTC | 10,000 days (GitHub max) |
| 1 | **Daily full DB dump** (`full-backup` job) — custom-format `.dump` + `.sql.gz`, uploaded as a GitHub Artifact. | Daily 02:00 UTC | 30 days |
| 2 | **Daily finance dump** (`finance-backup` job) — `pg_dump -t payments -t payment_attempts -t payment_webhook_events -t rent_obligations` + CSV exports, bundled as `.tar.gz`. | Daily 02:00 UTC | 90 days |
| 3 | **Supabase Storage upload** (`upload-to-storage` job) — encrypts the daily full dump with GPG and `PUT`s to `db-backups/<YYYY-MM-DD>/full.sql.gz.gpg`. | Daily 02:00 UTC | Bucket policy |
| 4 | **Weekly restore verification** (`verify-weekly` job) — restores the daily dump into an ephemeral Postgres 15 service container and compares row counts against the source for critical tables. Only runs on Sundays. | Sunday 03:00 UTC | n/a |
| 5 | **Storage cleanup** (`cleanup-old-backups` job) — lists objects older than 30 days in `db-backups` and logs them. (Cleanup is declarative; actual deletion is expected to be handled via Supabase retention policies — see `db-backup.yml:467-480`.) | Daily | n/a |
| 6 | **Local scripts** (`scripts/backup/*.sh`) — on-demand dumps + upload + storage-files backup. | Manual | Local |

---

## GitHub Secrets required

Configure at **Settings → Secrets → Actions**:

| Secret | Purpose |
|---|---|
| `DIRECT_URL` | Non-pooler Supabase connection (port **5432**). Validation step fails the workflow if `:5432` is missing or if the URL contains `pooler`. |
| `SUPABASE_URL` | Project URL for Storage REST uploads. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for Storage uploads. |
| `BACKUP_GPG_PASSPHRASE` | Symmetric passphrase for `gpg -c --cipher-algo AES256` encryption of daily + monthly dumps. |

---

## Trigger manually

GitHub UI: **Actions → Daily DB Backup → Run workflow**.
Or with `gh`:

```bash
gh workflow run db-backup.yml
```

---

## Local backups (on-demand)

Scripts under `scripts/backup/`:

```bash
./scripts/backup/local-backup.sh all        # full + finance + schema
./scripts/backup/local-backup.sh full       # full DB only
./scripts/backup/local-backup.sh finance    # payments/obligations only
./scripts/backup/local-backup.sh schema     # schema only
./scripts/backup/backup-storage-files.sh    # Supabase Storage files
```

Output tree:

```
backups/
├── full/      full_backup_YYYY-MM-DD_HH-MM-SS.{dump,sql.gz}
├── finance/   finance_backup_*.sql, *_ledger_*.csv, finance_bundle_*.tar.gz
└── schema/    schema_*.sql
```

Upload a specific file to Supabase Storage:

```bash
./scripts/backup/upload-to-storage.sh backups/full/full_backup_*.dump
```

---

## Recovery

### Full restore

```bash
# From custom-format dump (recommended)
./scripts/backup/restore-db.sh full backups/full/full_backup_*.dump

# From compressed SQL
./scripts/backup/restore-db.sh full backups/full/full_backup_*.sql.gz

# From plain SQL
./scripts/backup/restore-db.sh full backups/full/full_backup_*.sql
```

### Finance-only restore

```bash
./scripts/backup/restore-db.sh finance backups/finance/finance_backup_*.sql
./scripts/backup/restore-db.sh finance backups/finance/finance_bundle_*.tar.gz
```

### Restore from a GitHub Actions artifact

```bash
gh run list --workflow=db-backup.yml -L 5
gh run download <run-id> -n db-full-backup-<run-id>
./scripts/backup/restore-db.sh full full_backup_*.dump
```

### Decrypt a Supabase Storage / monthly snapshot

```bash
gpg --batch --yes --passphrase "$BACKUP_GPG_PASSPHRASE" \
    -o full.sql.gz -d full.sql.gz.gpg
gunzip full.sql.gz
psql "$DIRECT_URL" -f full.sql
```

### Verify after restore

```bash
./scripts/backup/restore-db.sh verify
./scripts/backup/restore-db.sh list
```

> The `verify` helper currently probes a list of tables. If it reports
> `students` missing, the message is expected — the current schema uses
> `tenants` (see `docs/DATABASE_SCHEMA.md §2.2`). The helper should be
> updated in a follow-up.

---

## Disaster scenarios

### Accidental deletion

1. `./scripts/backup/restore-db.sh list`
2. If payments-only damage: `restore-db.sh finance <latest-finance>.sql`
3. If broader: `restore-db.sh full <latest-full>.dump`
4. `./scripts/backup/restore-db.sh verify`

### DB corruption

```bash
gh run list --workflow=db-backup.yml -L 5
gh run download <run-id> -n db-full-backup-<run-id>
./scripts/backup/restore-db.sh full full_backup_*.dump
cd backend-next && npx prisma migrate deploy   # if schema skew suspected
```

### Financial audit

Daily CSV exports (payments ledger + rent_obligations) are included in the
finance artifact. The CSV `SELECT` in the workflow is out of date
(`docs/TASKS.md:T-020`) — for a reliable export run:

```bash
psql "$DIRECT_URL" -c "\COPY (SELECT * FROM payments ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER" \
  > payments_$(date +%F).csv
psql "$DIRECT_URL" -c "\COPY (SELECT * FROM rent_obligations ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER" \
  > obligations_$(date +%F).csv
```

---

## Best practices

1. Test restores regularly — a backup is only as good as its last successful restore. The weekly `verify-weekly` job covers this automatically on Sundays.
2. Keep finance artifacts for ≥ 90 days for audit/compliance.
3. Snapshot before major migrations: `./scripts/backup/local-backup.sh all`.
4. Keep multiple locations: GitHub Artifacts + Supabase Storage + local.
5. Rotate `SUPABASE_SERVICE_ROLE_KEY` and `BACKUP_GPG_PASSPHRASE` if backup machines are compromised.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pg_dump: connection refused` | Ensure `DIRECT_URL` uses port **5432**, not 6543 (PgBouncer). |
| `bucket not found` on upload | Run `./scripts/backup/setup-storage-bucket.sh` (creates `db-backups`). |
| GitHub Action fails at "Validate DIRECT_URL" | URL is missing port 5432 or contains `pooler`. |
| Restore logs many `DROP … does not exist` lines | Expected with `--clean --if-exists`; use `restore-db.sh verify` to confirm. |
| `verify-weekly` fails counting `students` or `payments.amount` | Schema drift — see `docs/TASKS.md:T-020`. |

---

## Files

```
.github/workflows/db-backup.yml    Automated daily / monthly / weekly jobs
scripts/backup/
  local-backup.sh                  Manual full/finance/schema dumps
  restore-db.sh                    Restore + verify + list
  upload-to-storage.sh             Push a local file to Supabase Storage
  backup-storage-files.sh          Mirror Supabase Storage buckets locally
docs/BACKUP_RECOVERY.md            This document
```
