# 🛡️ HMS Database Backup & Recovery Guide

## Architecture Overview

```
Supabase DB (Primary)
     │
     ├── Layer 1: GitHub Action Daily pg_dump ──→ GitHub Artifacts (30 days)
     │
     ├── Layer 2: Supabase Storage Bucket ──→ db-backups/ (30 days)
     │
     ├── Layer 3: Local Backup Scripts ──→ backups/ directory
     │
     ├── Layer 4: Financial Tables Backup ──→ payments, rent_obligations (90 days)
     │
     └── Layer 5: Storage Files Backup ──→ documents, receipts, logos
```

---

## Quick Start

### 1. One-Time Setup

```bash
# Make all scripts executable
chmod +x scripts/backup/*.sh

# Create Supabase Storage buckets for backups
./scripts/backup/setup-storage-bucket.sh

# Add GitHub secrets (required for automated backups)
# Go to: https://github.com/Shivaprakash001/hms/settings/secrets/actions
# Add these secrets:
#   DIRECT_URL          → Your Supabase direct connection URL (port 5432)
#   SUPABASE_URL        → Your Supabase project URL
#   SUPABASE_SERVICE_ROLE_KEY → Your Supabase service role key
```

### 2. Run a Local Backup Now

```bash
# Full backup (database + finance + schema)
./scripts/backup/local-backup.sh all

# Only financial tables
./scripts/backup/local-backup.sh finance

# Only full database
./scripts/backup/local-backup.sh full

# Only schema
./scripts/backup/local-backup.sh schema
```

### 3. Upload to Supabase Storage

```bash
# Upload a specific backup file
./scripts/backup/upload-to-storage.sh backups/full/full_backup_2026-04-30_14-30-00.dump
```

### 4. Backup Storage Files (Documents, Receipts)

```bash
./scripts/backup/backup-storage-files.sh
```

---

## Backup Layers Explained

### Layer 1: GitHub Action Daily Backup (Automated)

**File:** `.github/workflows/db-backup.yml`

- Runs daily at 2:00 AM UTC (7:30 AM IST)
- Can be triggered manually from GitHub Actions tab
- Creates:
  - Full database dump (`.dump` + `.sql.gz`)
  - Financial tables dump
  - Payments CSV ledger
  - Rent obligations CSV
- Stored as GitHub Artifacts (30 day retention for full, 90 days for finance)
- Also uploads to Supabase Storage bucket

**To trigger manually:**
1. Go to https://github.com/Shivaprakash001/hms/actions
2. Click "Daily DB Backup"
3. Click "Run workflow"

### Layer 2: Supabase Storage Backup

**Bucket structure:**
```
db-backups/
   ├── 2026-04-30/
   │   └── full_backup.sql.gz
   ├── 2026-04-29/
   │   └── full_backup.sql.gz
   └── ...
```

### Layer 3: Local Backup Scripts

**Script:** `scripts/backup/local-backup.sh`

Creates backups in the `backups/` directory:
```
backups/
   ├── full/
   │   ├── full_backup_2026-04-30_14-30-00.dump    (custom format, best for restore)
   │   └── full_backup_2026-04-30_14-30-00.sql.gz  (SQL format, human readable)
   │
   ├── finance/
   │   ├── finance_backup_2026-04-30_14-30-00.sql
   │   ├── payments_ledger_2026-04-30.csv
   │   ├── rent_obligations_2026-04-30.csv
   │   ├── payment_attempts_2026-04-30.csv
   │   └── finance_bundle_2026-04-30_14-30-00.tar.gz
   │
   └── schema/
       └── schema_2026-04-30_14-30-00.sql
```

### Layer 4: Financial Tables Backup (Critical for Payments)

Backs up only these critical tables:
- `payments` — All payment records
- `payment_attempts` — Payment gateway attempts
- `payment_webhook_events` — Webhook event logs
- `rent_obligations` — Rent due records

Also exports CSV ledger files for financial auditing.

### Layer 5: Storage Files Backup

**Script:** `scripts/backup/backup-storage-files.sh`

Downloads all files from Supabase Storage buckets:
- Tenant documents (ID proofs, agreements)
- Receipts / payment screenshots
- Hostel logos

---

## Recovery Procedures

### Full Database Restore

```bash
# From custom dump (recommended - fastest, most reliable)
./scripts/backup/restore-db.sh full backups/full/full_backup_2026-04-30_14-30-00.dump

# From compressed SQL
./scripts/backup/restore-db.sh full backups/full/full_backup_2026-04-30_14-30-00.sql.gz

# From plain SQL
./scripts/backup/restore-db.sh full backups/full/full_backup_2026-04-30_14-30-00.sql
```

### Financial Tables Only Restore

```bash
# Restore only payments, payment_attempts, rent_obligations
./scripts/backup/restore-db.sh finance backups/finance/finance_backup_2026-04-30_14-30-00.sql

# From compressed bundle
./scripts/backup/restore-db.sh finance backups/finance/finance_bundle_2026-04-30_14-30-00.tar.gz
```

### Restore from GitHub Artifacts

```bash
# 1. Download from GitHub UI
#    Go to: https://github.com/Shivaprakash001/hms/actions
#    Click latest "Daily DB Backup" run → Download artifact

# 2. Or use GitHub CLI
gh run download <run-id> -n db-full-backup-<run-id>

# 3. Extract and restore
unzip db-full-backup-*.zip
./scripts/backup/restore-db.sh full full_backup_2026-04-30.dump
```

### Verify After Restore

```bash
./scripts/backup/restore-db.sh verify
```

This checks:
- Table row counts
- Critical tables existence (payments, profiles, rooms, students, hostels)

### List Available Backups

```bash
./scripts/backup/restore-db.sh list
```

---

## GitHub Secrets Required

Add these to your repository: https://github.com/Shivaprakash001/hms/settings/secrets/actions

| Secret | Description | Example |
|--------|-------------|---------|
| `DIRECT_URL` | Supabase direct connection (port 5432, NOT pooler) | `postgresql://postgres.xxx:pass@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access) | `eyJhbGciOiJIUzI1NiIs...` |

> ⚠️ **Important:** Use the DIRECT_URL (port 5432), not the pooled connection (port 6543). pg_dump doesn't work with PgBouncer pooling.

---

## Cron Schedule Reference

| Backup | Schedule | Retention |
|--------|----------|-----------|
| GitHub Action - Full DB | Daily 2:00 AM UTC | 30 days |
| GitHub Action - Finance | Daily 2:00 AM UTC | 90 days |
| Supabase Storage Upload | Daily (after GitHub Action) | 30 days |
| Local backup | Manual / Weekly recommended | 30 days (auto-cleanup) |

### Recommended Manual Schedule

```bash
# Weekly full backup (Sunday night)
./scripts/backup/local-backup.sh all

# Upload to Supabase Storage
./scripts/backup/upload-to-storage.sh backups/full/full_backup_*.dump

# Monthly storage files backup
./scripts/backup/backup-storage-files.sh
```

---

## Disaster Recovery Scenarios

### Scenario 1: Accidental Data Deletion

```bash
# 1. Get latest backup
./scripts/backup/restore-db.sh list

# 2. If only payments affected
./scripts/backup/restore-db.sh finance backups/finance/finance_backup_LATEST.sql

# 3. If full DB affected
./scripts/backup/restore-db.sh full backups/full/full_backup_LATEST.dump

# 4. Verify
./scripts/backup/restore-db.sh verify
```

### Scenario 2: Database Corruption

```bash
# 1. Download latest GitHub Action backup
gh run list --workflow=db-backup.yml --limit=5
gh run download <latest-run-id> -n db-full-backup-<run-id>

# 2. Restore
./scripts/backup/restore-db.sh full full_backup_*.dump

# 3. Run Prisma migrations if needed
cd backend-next && npx prisma migrate deploy
```

### Scenario 3: Supabase Goes Down

If you have a replica database (Neon/Railway/AWS RDS):

```bash
# 1. Update DATABASE_URL in .env to point to replica
# 2. Deploy with new connection string
# 3. When Supabase recovers, sync back
```

### Scenario 4: Need to Audit Financial Data

```bash
# CSV exports are in the finance backups
ls backups/finance/payments_ledger_*.csv
ls backups/finance/rent_obligations_*.csv

# Or download from GitHub Actions artifacts
```

---

## File Structure

```
hms/
├── .github/
│   └── workflows/
│       └── db-backup.yml           # Automated daily backups
│
├── scripts/
│   └── backup/
│       ├── local-backup.sh         # Local backup (full/finance/schema)
│       ├── restore-db.sh           # Restore database
│       ├── setup-storage-bucket.sh # One-time Supabase bucket setup
│       ├── upload-to-storage.sh    # Upload backup to Supabase Storage
│       └── backup-storage-files.sh # Backup Supabase Storage files
│
├── backups/                        # Local backups (gitignored)
│   ├── full/
│   ├── finance/
│   ├── schema/
│   └── storage/
│
└── docs/
    └── BACKUP_RECOVERY.md          # This file
```

---

## Monitoring & Alerts

### Check if GitHub Action ran successfully

1. Go to https://github.com/Shivaprakash001/hms/actions
2. Look for "Daily DB Backup" workflow
3. Green ✓ = success, Red ✗ = failed

### Setup email notifications for failures

In GitHub repository settings:
1. Go to Settings → Notifications
2. Enable "Failed workflows" notifications

---

## Best Practices

1. **Test restores regularly** — A backup is only good if you can restore from it
2. **Keep finance backups longer** — 90 days minimum for payment data
3. **Export CSVs monthly** — For financial auditing and compliance
4. **Backup before major deployments** — Run `./scripts/backup/local-backup.sh all` before any migration
5. **Store backups in multiple locations** — GitHub + Supabase Storage + Local
6. **Never commit backups to git** — They contain sensitive data (already gitignored)
7. **Rotate credentials** — If backup scripts are compromised, rotate Supabase keys immediately

---

## Troubleshooting

### pg_dump fails with "connection refused"

- Use `DIRECT_URL` (port 5432), not `DATABASE_URL` (port 6543)
- PgBouncer pooling (port 6543) doesn't support pg_dump

### "bucket not found" error

```bash
./scripts/backup/setup-storage-bucket.sh
```

### GitHub Action fails

- Check if secrets are set: Repository → Settings → Secrets → Actions
- Ensure `DIRECT_URL` uses port 5432

### Restore shows errors but completes

- This is normal — `--clean --if-exists` flags will show DROP errors for non-existent objects
- Verify with: `./scripts/backup/restore-db.sh verify`

### Large backup files

- Custom format (`.dump`) is already compressed
- SQL dumps are auto-compressed with gzip
- Finance bundles are tar.gz compressed
