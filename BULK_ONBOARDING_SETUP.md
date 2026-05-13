# Bulk Onboarding System - Setup Instructions

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Existing HMS system running

## Installation Steps

### 1. Install Dependencies

```bash
cd backend-next

# Install XLSX parsing library
npm install xlsx

# Install type definitions
npm install --save-dev @types/node
```

### 2. Apply Database Migration

```bash
# Apply the migration
npx prisma migrate deploy

# Generate Prisma client with new models
npx prisma generate

# Verify migration applied
npx prisma migrate status
```

### 3. Verify Environment Variables

Ensure these are set in `.env`:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NODE_ENV="production"
```

### 4. Build and Deploy

```bash
# Rebuild with new Prisma types
npm run build

# Or restart dev server
npm run dev
```

### 5. Verify Installation

Test each endpoint:

```bash
# 1. Test file upload (should require auth)
curl -X POST http://localhost:3000/api/bulk-import/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.xlsx" \
  -F "hostel_id=<hostel-uuid>"

# 2. Test onboarding login
curl -X POST http://localhost:3000/api/auth/onboarding-login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "password": "test123"}'

# 3. Test password reset
curl -X POST http://localhost:3000/api/auth/reset-onboarding-password \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "current_password": "test123",
    "new_password": "newSecure123",
    "confirm_password": "newSecure123"
  }'
```

## Database Schema Verification

After migration, verify new tables exist:

```sql
-- Check profiles has new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('password_reset_required', 'password_reset_at', 'is_imported', 'import_batch_id');

-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('login_attempts', 'bulk_import_batches');
```

Expected output:
```
password_reset_required | boolean | NO | false
password_reset_at       | timestamp with time zone | YES | NULL
is_imported            | boolean | NO | false
import_batch_id        | uuid | YES | NULL

login_attempts
bulk_import_batches
```

## TypeScript Errors Resolution

The lint errors you see are expected before running `npx prisma generate`. They will be resolved automatically when Prisma generates the new client types.

### Before Prisma Generate:
```
❌ Property 'bulkImportBatch' does not exist on type 'PrismaClient'
❌ Property 'password_reset_required' does not exist on type 'Profile'
❌ Cannot find module 'xlsx'
```

### After Prisma Generate + npm install:
```
✅ All types resolved
✅ IntelliSense working
✅ No compilation errors
```

## Sample Excel Template

Create a template file for owners:

### Required Columns:
- `name` - Tenant name (required)
- `phone` - Phone number (required, 10 digits)
- `room_no` - Room number (required, must exist in hostel)
- `monthly_rent` - Monthly rent amount (required, >0)
- `onboarding_password` - Password for first login (required, 6+ chars, letter+number)

### Optional Columns:
- `email` - Email address (optional but recommended)
- `advance_deposit` - Advance deposit amount
- `maintenance_charge` - Maintenance charge
- `maintenance_type` - MONTHLY, ONE_TIME, or NONE
- `joining_date` - Join date (YYYY-MM-DD or DD/MM/YYYY)
- `emergency_contact` - Emergency contact number
- `gender` - Male, Female, Other
- `profile_type` - STUDENT, WORKING, OTHER

### Example Excel Template:

| name | phone | email | room_no | monthly_rent | onboarding_password | advance_deposit | maintenance_type | joining_date |
|------|-------|-------|---------|--------------|---------------------|-----------------|------------------|--------------|
| John Doe | 9876543210 | john@example.com | 101 | 5000 | john123 | 10000 | MONTHLY | 2026-06-01 |
| Jane Smith | 9876543211 | jane@example.com | 102 | 5500 | jane456 | 10000 | MONTHLY | 2026-06-01 |

## Testing Checklist

### Functional Tests

- [ ] **File Upload**
  - [ ] Upload valid XLSX file
  - [ ] Upload valid CSV file
  - [ ] Reject invalid file type (PDF, DOCX)
  - [ ] Reject file > 5MB
  - [ ] Validate owner owns hostel

- [ ] **Validation**
  - [ ] Detect missing required fields
  - [ ] Detect invalid phone numbers
  - [ ] Detect duplicate phones (in file)
  - [ ] Detect duplicate phones (in system)
  - [ ] Detect invalid room numbers
  - [ ] Detect weak passwords
  - [ ] Show valid/invalid/duplicate preview

- [ ] **Import Confirmation**
  - [ ] Import valid rows only
  - [ ] Skip duplicates automatically
  - [ ] Create Profile + Tenant + Allocation atomically
  - [ ] Set password_reset_required = true
  - [ ] Hash passwords correctly
  - [ ] Record batch in database

- [ ] **Onboarding Login**
  - [ ] Login with phone + onboarding password
  - [ ] Reject invalid credentials
  - [ ] Return 403 if password_reset_required = true
  - [ ] Set JWT token in cookie
  - [ ] Return tenant details

- [ ] **Password Reset**
  - [ ] Validate current password
  - [ ] Enforce password strength (8+ chars, letter+number)
  - [ ] Confirm password match
  - [ ] Set password_reset_required = false
  - [ ] Update password_reset_at timestamp

- [ ] **Rate Limiting**
  - [ ] Block after 5 failed phone attempts
  - [ ] Block after 20 failed IP attempts
  - [ ] Show lockout duration
  - [ ] Log attempts in database

### Security Tests

- [ ] Passwords hashed in database (never plaintext)
- [ ] Rate limiting works (attempt 6 failed logins)
- [ ] Onboarding password can't be used after reset
- [ ] SQL injection attempts fail (test with `' OR '1'='1`)
- [ ] XSS attempts sanitized
- [ ] File upload bombs rejected (5MB limit)

### Edge Cases

- [ ] Import with 0 valid rows (all invalid)
- [ ] Import with all duplicates
- [ ] Phone number without +91 prefix (auto-added)
- [ ] Email column missing (uses phone@system.local)
- [ ] Room at capacity (validation error)
- [ ] Tenant limit exceeded (402 error)
- [ ] Subscription inactive (403 error)

## Rollback Procedure

If issues are found in production:

### 1. Stop New Imports
```sql
-- Temporarily disable bulk import
-- (Application-level - remove route or add feature flag)
```

### 2. Rollback Database
```bash
# Revert migration
npx prisma migrate resolve --rolled-back 20260513170000_bulk_onboarding_system

# Apply rollback SQL
psql $DATABASE_URL < rollback.sql
```

**rollback.sql**:
```sql
BEGIN;

-- Allow existing imported tenants to login
-- (Don't drop columns immediately - gives time to transition)
UPDATE profiles 
SET password_reset_required = false 
WHERE is_imported = true AND password_reset_required = true;

-- Drop new tables (loses audit trail)
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS bulk_import_batches CASCADE;

-- Remove new columns (optional - can keep for future use)
-- ALTER TABLE profiles DROP COLUMN password_reset_required;
-- ALTER TABLE profiles DROP COLUMN password_reset_at;
-- ALTER TABLE profiles DROP COLUMN is_imported;
-- ALTER TABLE profiles DROP COLUMN import_batch_id;

COMMIT;
```

### 3. Revert Code
```bash
git revert <commit-hash>
npm run build
```

### 4. Regenerate Prisma
```bash
npx prisma generate
```

## Monitoring

### Key Metrics to Track

1. **Import Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'COMPLETED') * 100.0 / COUNT(*) as success_rate,
     AVG(imported_rows) as avg_imported,
     AVG(failed_rows) as avg_failed
   FROM bulk_import_batches
   WHERE created_at > NOW() - INTERVAL '7 days';
   ```

2. **Rate Limit Violations**
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) FILTER (WHERE success = false) as failed_attempts,
     COUNT(DISTINCT identifier) as unique_users
   FROM login_attempts
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

3. **Password Reset Completion Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE password_reset_at IS NOT NULL) * 100.0 / 
     COUNT(*) as reset_completion_rate
   FROM profiles
   WHERE is_imported = true;
   ```

### Alerts to Set Up

- Import failure rate > 10%
- Rate limit lockouts > 50/day
- Password reset failures > 20%
- Import processing time > 5 minutes

## Troubleshooting

### Issue: "Cannot find module 'xlsx'"
**Solution**: Run `npm install xlsx`

### Issue: "Property 'bulkImportBatch' does not exist"
**Solution**: Run `npx prisma generate`

### Issue: Rate limit false positives (shared WiFi)
**Solution**: Increase IP limit or add IP whitelist for hostel

### Issue: Imported tenant can't login
**Check**:
1. Phone number format matches (+91XXXXXXXXXX)
2. Account is_active = true
3. Tenant status = ACTIVE
4. Password was hashed correctly

### Issue: Password reset fails
**Check**:
1. password_reset_required = true
2. Current password is correct
3. New password meets strength requirements (8+ chars, letter+number)

### Issue: Import timeout
**Solution**: 
- Reduce batch size (max 100 tenants per file)
- Check database connection pool settings
- Consider async processing (future enhancement)

## Support

For issues or questions:
1. Check logs: `tail -f logs/app.log | grep bulk-import`
2. Check database: `SELECT * FROM bulk_import_batches ORDER BY created_at DESC LIMIT 10;`
3. Review this documentation
4. Contact development team

---

**System Ready**: After completing all steps above, the bulk onboarding system is production-ready.
