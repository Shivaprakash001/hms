# Production Hardening Fixes - Response to Audit

**Date**: May 13, 2026  
**Audit Feedback**: Received detailed production readiness assessment  
**Current Status**: 8/10 architecture → targeting 9/10 production hardening

---

## ✅ CRITICAL FIX #1: Onboarding Password Expiration (IMPLEMENTED)

### **Problem Identified**
> "Tenant imported, never logs in, onboarding password valid forever. Bad."

### **Fix Applied**

**Database Migration** ✅
```sql
ALTER TABLE profiles ADD COLUMN onboarding_expires_at TIMESTAMPTZ(6);
```

**Code Changes** ✅
1. **Tenant Migration Service**: Set expiration to 30 days from import
2. **Auth Service**: Check expiration before allowing login
3. **Password Reset**: Clear expiration after successful reset

**Security Flow**:
```
Import tenant (onboarding_expires_at = NOW() + 30 days)
↓
After 30 days without login → ONBOARDING_EXPIRED error
↓
Tenant must contact owner for manual reset/re-import
```

**Error Handling**:
- **Before expiry**: `PASSWORD_RESET_REQUIRED` (normal flow)
- **After expiry**: `ONBOARDING_EXPIRED` (contact owner)

---

## 🚨 CRITICAL RISK #1: Google Form Password Collection

### **Problem Identified**
> "Google Forms stores raw onboarding passwords. If hostel owner leaks sheet, laptop compromised, Google account compromised, XLSX forwarded accidentally → all onboarding credentials leak instantly."

### **Risk Assessment**
- **Severity**: CRITICAL
- **Impact**: Mass credential exposure
- **Attack Surface**: Google Forms → Google Sheets → XLSX file → Email/WhatsApp sharing
- **Affected**: All imported tenants until password reset

### **Current Mitigation** (Partial)
✅ Forced password reset on first login  
✅ One-time use onboarding password  
✅ 30-day expiration window (NEW)  
⚠️ Still vulnerable during 0-30 day window

### **Recommended Long-Term Solution**

**Option A: Secret Phrase Derivation** (STRONGLY RECOMMENDED)
```
Tenant chooses: "bluebike77" (secret phrase)
↓
Backend derives: HMAC-SHA256(phrase + tenant_phone + salt)
↓
Hashed password stored
↓
Tenant enters same phrase on first login
↓
Backend re-derives and validates
```

**Benefits**:
- Phrase leaked = useless without backend salt
- Reduces password reuse risk
- Same UX (tenant remembers simple phrase)

**Option B: Owner-Generated Random Codes**
```
Backend generates: AB12-XY89 (random 8-char code)
↓
Owner shares via WhatsApp/SMS
↓
Tenant uses code for first login
```

**Benefits**:
- Never stored in Google Forms
- Owner controls distribution channel
- Shorter lifetime (can expire sooner)

### **Action Required**
🔴 **DECISION NEEDED**: Choose Option A or B before production  
🟡 **Interim**: Document risk clearly for owners ("Delete XLSX after import")  
🟡 **Monitoring**: Track time between import and first login (aim for <7 days)

---

## ⚠️ PRIORITY RISK #2: Bulk Import Memory Safety

### **Problem Identified**
> "500 tenant XLSX parsing can spike memory, timeout serverless, freeze requests. Especially on Vercel."

### **Current Implementation**
```typescript
const fileBuffer = Buffer.from(await file.arrayBuffer());
const workbook = XLSX.read(fileBuffer, { type: "buffer" });
```

**Issues**:
- ❌ Entire file loaded into memory
- ❌ No streaming parse
- ❌ No chunking for large files
- ❌ Vercel serverless timeout: 10 seconds (Hobby), 60 seconds (Pro)

### **Risk Matrix**

| Rows | File Size | Memory | Parse Time | Risk |
|------|-----------|--------|------------|------|
| 50   | ~50 KB    | 2 MB   | <1s        | LOW |
| 100  | ~100 KB   | 5 MB   | 1-2s       | LOW |
| 500  | ~500 KB   | 25 MB  | 5-10s      | **MEDIUM** |
| 1000 | ~1 MB     | 50 MB  | 15-30s     | **HIGH** |

### **Immediate Mitigations** (REQUIRED)

**1. Frontend File Size Limit** ✅
```typescript
// Already implemented: 5MB limit
if (file.size > 5 * 1024 * 1024) {
  return error("File too large");
}
```

**2. Row Count Limit** (NEW - REQUIRED)
```typescript
// Add to validation service
if (rows.length > 500) {
  throw new Error("Maximum 500 tenants per import. Please split into multiple files.");
}
```

**3. Add Timeout Protection** (NEW - REQUIRED)
```typescript
// In upload route
export const maxDuration = 60; // Vercel Pro only
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
    responseLimit: '8mb',
  },
};
```

### **Long-Term Solution** (After 3 Months)

**Async Processing with Progress**:
```
Upload file → Store in temporary blob storage
↓
Return job_id immediately
↓
Background worker processes file
↓
Poll /api/bulk-import/status/{job_id} for progress
↓
Notify owner via dashboard/email when complete
```

**Benefits**:
- No timeout risk
- Better UX (progress bar)
- Can handle 1000+ tenants
- Retry failures individually

**Technology**: BullMQ + Redis or Vercel Queue

---

## ⚠️ PRIORITY RISK #3: Room Conflict Chaos

### **Problem Identified**
> "What happens if room already occupied? Capacity exceeded? Duplicate room assignment?"

### **Current Validation** (Partial)
```typescript
// Only checks if room exists
const room = hostelRooms.find(r => r.room_no === row.room_no);
if (!room) {
  errors.push({ field: "room_no", message: "Room not found" });
}
```

**Missing Checks**:
❌ Room capacity vs current occupancy  
❌ Duplicate room assignments within import file  
❌ Room already full before import  
❌ Conflicting join dates

### **Required Enhancements** (BEFORE PRODUCTION)

**1. Check Current Occupancy**
```typescript
// In validation service
const currentOccupancy = await prisma.roomAllocation.count({
  where: {
    room_id: room.id,
    is_active: true,
  },
});

if (currentOccupancy >= room.capacity) {
  errors.push({
    field: "room_no",
    message: `Room ${room.room_no} is full (${currentOccupancy}/${room.capacity})`,
  });
}
```

**2. Check Duplicate Rooms in File**
```typescript
// Build room usage map
const roomUsage = new Map<string, number>();

for (const row of validRows) {
  const count = roomUsage.get(row.room_no) || 0;
  roomUsage.set(row.room_no, count + 1);
}

// Validate capacity
for (const [roomNo, count] of roomUsage) {
  const room = hostelRooms.find(r => r.room_no === roomNo);
  if (count > room.capacity) {
    warnings.push(`Room ${roomNo} assigned to ${count} tenants (capacity: ${room.capacity})`);
  }
}
```

**3. Transaction Conflict Prevention**
```typescript
// In tenant migration service (already atomic, but add explicit lock)
await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${room.id} FOR UPDATE`;

// Then check capacity within transaction
const occupancy = await tx.roomAllocation.count({
  where: { room_id: room.id, is_active: true },
});

if (occupancy >= room.capacity) {
  throw new Error(`Room ${room.room_no} capacity exceeded during import`);
}
```

---

## 🔐 SECURITY IMPROVEMENT #1: Account Lock Escalation

### **Problem Identified**
> "Current: temporary lock. But what about persistent attack attempts? Need escalating cooldowns, suspicious activity flags."

### **Current Rate Limiting**
```
Phone: 5 attempts / 15 min → 30 min lockout
IP: 20 attempts / 15 min → 15 min lockout
```

**Missing**:
- ❌ No escalation for repeat offenders
- ❌ No permanent suspension after X violations
- ❌ No alert to owner for suspicious activity

### **Recommended Escalation Policy**

**Tier 1**: First lockout (5 failed attempts)
- Duration: 30 minutes
- Action: Log attempt

**Tier 2**: Second lockout within 24 hours
- Duration: 2 hours
- Action: Log + increment strike counter

**Tier 3**: Third lockout within 7 days
- Duration: 24 hours
- Action: Log + flag as suspicious

**Tier 4**: Fourth lockout within 30 days
- Duration: Permanent (requires owner/admin unlock)
- Action: **Alert owner** + security review

### **Implementation** (Future Enhancement)

```sql
-- Add to login_attempts table
ALTER TABLE login_attempts ADD COLUMN lockout_tier INTEGER DEFAULT 1;

-- Track lockout history
CREATE TABLE account_lockouts (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  identifier VARCHAR(255),
  lockout_tier INTEGER,
  locked_until TIMESTAMPTZ,
  locked_by VARCHAR(50), -- 'SYSTEM' | 'OWNER' | 'ADMIN'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 TESTING REQUIREMENTS (MANDATORY BEFORE PRODUCTION)

### **Stage 1: Functional Tests** (BLOCKING)

**Small Import (5 Tenants)**
- [ ] Upload valid XLSX
- [ ] All tenants created successfully
- [ ] Onboarding login works
- [ ] Password reset works
- [ ] Room allocations correct
- [ ] Financial obligations created

**Medium Import (50 Tenants)**
- [ ] Validation preview accurate
- [ ] Import completes <10 seconds
- [ ] Partial success handling (some fail)
- [ ] Duplicate detection works
- [ ] Memory usage <50 MB

**Large Import (500 Tenants)** 🔴 **CRITICAL**
- [ ] File parses without timeout
- [ ] Memory spike acceptable
- [ ] Import time <60 seconds
- [ ] Database performance stable
- [ ] No concurrent import conflicts

### **Stage 2: Failure Tests** (BLOCKING)

**Invalid Data**
- [ ] Malformed phone numbers rejected
- [ ] Duplicate phones detected
- [ ] Invalid room numbers rejected
- [ ] Weak passwords rejected
- [ ] Missing required fields rejected

**Edge Cases**
- [ ] Room at capacity → error
- [ ] Duplicate room in file → warning
- [ ] Invalid dates handled
- [ ] Empty file rejected
- [ ] Corrupt XLSX file rejected

**Security Tests**
- [ ] Rate limiting triggers at 6 attempts
- [ ] Expired onboarding password blocked
- [ ] SQL injection attempts fail
- [ ] XSS in name/address sanitized
- [ ] File upload bomb rejected

**Operational Tests**
- [ ] Import batch audit trail accurate
- [ ] Retry after failure idempotent
- [ ] Concurrent imports don't conflict
- [ ] Plan limit enforcement works
- [ ] Subscription checks work

### **Stage 3: Load Tests** (RECOMMENDED)

**Concurrency**
- [ ] 5 owners importing simultaneously
- [ ] Database connection pool handles load
- [ ] No deadlocks or race conditions

**Volume**
- [ ] 10 imports of 100 tenants each = 1000 total
- [ ] Database performance stable
- [ ] Disk space acceptable
- [ ] Query performance <500ms

---

## 📈 OBSERVABILITY REQUIREMENTS

### **Metrics to Track** (BEFORE PRODUCTION)

**Import Health**
```sql
-- Import success rate (target: >95%)
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') * 100.0 / COUNT(*) as success_rate,
  AVG(imported_rows) as avg_imported,
  AVG(failed_rows) as avg_failed,
  MAX(imported_at - uploaded_at) as max_duration
FROM bulk_import_batches
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

**Onboarding Completion**
```sql
-- Time to first login (target: <7 days)
SELECT 
  AVG(EXTRACT(DAY FROM (password_reset_at - created_at))) as avg_days_to_login,
  COUNT(*) FILTER (WHERE password_reset_at IS NULL AND created_at < NOW() - INTERVAL '30 days') as expired_unused
FROM profiles
WHERE is_imported = true;
```

**Security Incidents**
```sql
-- Rate limit violations (alert if >50/day)
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE success = false) as failed_attempts,
  COUNT(DISTINCT identifier) as unique_accounts,
  COUNT(DISTINCT ip_address) as unique_ips
FROM login_attempts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

### **Alerts to Configure**

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| Import failure rate | >10% | HIGH | Investigate validation logic |
| Import duration | >60s | MEDIUM | Consider async processing |
| Expired unused accounts | >20% | MEDIUM | Owner outreach needed |
| Rate limit violations | >50/day | HIGH | Possible attack |
| Room conflict errors | >5/day | MEDIUM | Data quality issue |

---

## 🎯 PRE-PRODUCTION CHECKLIST

### **Code Quality** (CURRENT STATUS)
- [x] Architecture documented ✅
- [x] Security audit complete ✅
- [x] Rate limiting implemented ✅
- [x] Password expiration added ✅
- [ ] Room capacity validation (REQUIRED)
- [ ] Import size limits (REQUIRED)
- [ ] Streaming parse (FUTURE)

### **Testing** (BLOCKING)
- [ ] 5-tenant test ⏳
- [ ] 50-tenant test ⏳
- [ ] **500-tenant test** 🔴 **CRITICAL**
- [ ] Failure scenarios ⏳
- [ ] Security tests ⏳
- [ ] Load tests (RECOMMENDED)

### **Infrastructure** (REQUIRED)
- [ ] Install `xlsx` dependency
- [ ] Run Prisma migration
- [ ] Generate Prisma client
- [ ] Configure monitoring/alerts
- [ ] Set up error tracking (Sentry/etc)

### **Documentation** (COMPLETE)
- [x] Implementation guide ✅
- [x] Setup instructions ✅
- [x] Security audit ✅
- [x] Production hardening ✅
- [ ] Owner training materials (RECOMMENDED)

### **Risk Acceptance** (DECISION REQUIRED)
- [ ] Google Form password risk acknowledged
- [ ] Mitigation strategy chosen (Secret Phrase vs Random Code)
- [ ] Import size limits communicated to owners
- [ ] Monitoring baseline established

---

## 📝 FINAL RECOMMENDATIONS

### **Deploy to Production IF:**
✅ All BLOCKING items complete  
✅ 500-tenant test passes  
✅ Room capacity validation added  
✅ Monitoring configured  
✅ Google Form risk documented for owners

### **DO NOT Deploy IF:**
❌ 500-tenant test fails or times out  
❌ Room capacity checks missing  
❌ No monitoring/alerting  

### **Deploy to Staging First:**
🟡 Test with real hostel data (anonymized)  
🟡 Run for 1 week with limited owner access  
🟡 Monitor metrics daily  
🟡 Fix issues before production rollout  

---

## 🎖️ ACKNOWLEDGMENT

Your audit feedback was **exceptionally valuable**. The distinction between:

> "architecture quality" (8/10) vs "production hardening" (6.5/10)

...is exactly the right lens for evaluating SaaS systems.

**What we did well:**
- Architectural discipline (no rewrites)
- Transaction safety
- Backward compatibility
- Rate limiting foundation

**What we're fixing:**
- Onboarding expiration (DONE)
- Room capacity validation (IN PROGRESS)
- Import size limits (IN PROGRESS)
- Memory safety testing (REQUIRED)

**What we're accepting:**
- Google Form password risk (documented, mitigated via expiration + forced reset)
- Sync processing for MVP (async queue is future enhancement)

**Target**: 8/10 architecture → **9/10 production hardening** after these fixes.

---

**Status**: In Production Hardening Phase  
**Next Milestone**: Complete BLOCKING items + 500-tenant test  
**ETA to Production**: After staging validation (1-2 weeks)
