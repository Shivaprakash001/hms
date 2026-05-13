# Production Readiness Execution Checklist

**Current Phase**: Testing & Validation (NO NEW FEATURES)  
**Target**: Pass recovery + load tests → Staged rollout  
**Philosophy**: Operational survivability over feature additions

---

## 🔴 BLOCKING ITEMS (Must Complete Before Production)

### **1. Import Recovery Testing** 
**Priority**: CRITICAL  
**Owner**: Backend + QA  
**Deliverable**: All 5 recovery scenarios pass  
**Test Plan**: `/test-plans/IMPORT_RECOVERY_TEST_PLAN.md`

**Scenarios**:
- [ ] **R1**: Mid-import crash recovery (simulate at row 23/50)
  - Verify: Partial state preserved, retry works, no duplicates
- [ ] **R2**: Transaction rollback (invalid data causes atomic failure)
  - Verify: No orphaned records, clear error messages
- [ ] **R3**: Concurrent import collision (two owners, same hostel)
  - Verify: Room capacity not exceeded, isolation works
- [ ] **R4**: Idempotency test (re-import same file)
  - Verify: No duplicates created, batch marked as duplicate
- [ ] **R5**: Partial overlap retry (50 old + 20 new tenants)
  - Verify: Only new rows imported, no duplicates

**Success Criteria**: Can safely recover from interrupted imports without duplicates or corrupted allocations

**Time Estimate**: 2-3 days  
**Blocker Risk**: HIGH (if recovery fails, architecture needs revision)

---

### **2. Dirty Data Testing**
**Priority**: CRITICAL  
**Owner**: QA + Backend  
**Deliverable**: 10 dirty data files tested  
**Test Data**: `/test-data/dirty-import-dataset.md`

**Files to Create & Test**:
- [ ] `clean-50-tenants.xlsx` - Baseline (should pass 100%)
- [ ] `dirty-phones.xlsx` - Malformed phones (normalize or reject)
- [ ] `duplicate-hell.xlsx` - Duplicate phones/rooms/emails
- [ ] `partial-data.xlsx` - Missing required fields
- [ ] `unicode-names.xlsx` - Hindi, Chinese, special chars
- [ ] `room-conflicts.xlsx` - Same room assigned multiple times
- [ ] `date-formats.xlsx` - DD/MM/YYYY, MM/DD/YYYY, ISO, etc.
- [ ] `empty-rows.xlsx` - Blank rows scattered throughout
- [ ] `malicious.xlsx` - Excel formula injection attempts
- [ ] `edge-cases.xlsx` - Single row, all invalid, all duplicates

**Success Criteria**: System handles all formats gracefully, no crashes, clear error messages

**Time Estimate**: 1-2 days  
**Blocker Risk**: MEDIUM (parsing issues likely, but fixable)

---

### **3. 500-Tenant Load Test** 🔴
**Priority**: MANDATORY  
**Owner**: Backend + DevOps  
**Deliverable**: 500-tenant import completes successfully  
**Target**: <60 seconds, <50 MB memory

**Test Steps**:
- [ ] Generate `500-tenants.xlsx` file (~500 KB)
- [ ] Upload to staging environment
- [ ] Monitor: Parse time, memory usage, DB connections
- [ ] Verify: All 500 tenants created with allocations + obligations
- [ ] Check: No timeouts, no memory spikes, no DB deadlocks

**Acceptance Criteria**:
- ✅ Import completes in <60 seconds (Vercel Pro limit)
- ✅ Memory usage <50 MB (serverless limit safety)
- ✅ No database connection pool exhaustion
- ✅ All 500 tenants have valid allocations
- ✅ All 500 tenants have initial obligations

**If Test Fails**: 
- Implement row count limit (500 max)
- Consider chunking (batch of 100 at a time)
- Add streaming parser (future enhancement)

**Time Estimate**: 1 day  
**Blocker Risk**: HIGH (if it times out, need architectural change)

---

### **4. Room Capacity Validation**
**Priority**: CRITICAL  
**Owner**: Backend  
**Deliverable**: Room over-capacity prevented  

**Code Changes Required**:
- [ ] Check current room occupancy before import
- [ ] Detect duplicate room assignments in file
- [ ] Add transaction lock (FOR UPDATE) to prevent races
- [ ] Return clear error: "Room 101 is full (2/2)"

**Test Cases**:
- [ ] Room at capacity → Error
- [ ] Room over-assigned in file → Error
- [ ] Concurrent imports to same room → One wins, one errors
- [ ] Retry after capacity error → Works when room available

**Success Criteria**: Room capacity never exceeded, clear errors, retry works

**Time Estimate**: 0.5 days  
**Blocker Risk**: LOW (implementation straightforward)

---

### **5. Observability Setup**
**Priority**: CRITICAL  
**Owner**: DevOps + Backend  
**Deliverable**: Monitoring dashboard + alerts configured

**Metrics to Track**:
- [ ] Import success rate (target: >90%)
- [ ] Import duration (p50, p95, p99)
- [ ] Memory usage per import
- [ ] Row processing rate (rows/second)
- [ ] Failed row distribution (by error type)
- [ ] Stuck import detection (>5 min in IMPORTING status)

**Alerts to Configure**:
- [ ] Import failure rate >10% (Slack/email)
- [ ] Import duration >60s (warning)
- [ ] Memory usage >40 MB (warning)
- [ ] Stuck imports detected (critical)

**Logging Requirements**:
- [ ] Batch ID in all logs
- [ ] Row numbers in errors
- [ ] Duration timings (parse, validate, import)
- [ ] Error details (no PII - no passwords logged)

**Success Criteria**: Can debug failed imports without SSH access

**Time Estimate**: 1 day  
**Blocker Risk**: MEDIUM (essential for production support)

---

### **6. Staging Environment Validation**
**Priority**: CRITICAL  
**Owner**: Full team  
**Deliverable**: 7 days of stable staging operation

**Setup**:
- [ ] Deploy to staging environment
- [ ] Configure staging database
- [ ] Set up monitoring/alerting
- [ ] Create test owner accounts (3-5 owners)

**Validation Period**: 7 days of real-world simulation
- [ ] Day 1-2: Small imports (5-10 tenants each)
- [ ] Day 3-4: Medium imports (50 tenants each)
- [ ] Day 5-6: Large imports (100-200 tenants)
- [ ] Day 7: 500-tenant stress test

**Daily Checks**:
- [ ] Import success rate
- [ ] Error rate/types
- [ ] Performance metrics
- [ ] Memory/CPU usage
- [ ] Database query performance

**Success Criteria**: 7 days with >90% success rate, no critical bugs

**Time Estimate**: 7 days  
**Blocker Risk**: MEDIUM (issues will be found, must be fixed)

---

## 🟡 IMPORTANT (Should Do Before Production)

### **7. Owner Security Warning UI**
**Priority**: HIGH  
**Owner**: Frontend  
**Deliverable**: Warning banners in upload + success screens  
**Spec**: `/frontend-requirements/OWNER_SECURITY_WARNING.md`

**Components**:
- [ ] Upload screen warning (before file selection)
- [ ] Success screen warning (after import complete)
- [ ] API response includes security reminder
- [ ] Optional: Checkbox "I have deleted the file"

**Success Criteria**: Owner sees clear warning to delete XLSX file

**Time Estimate**: 0.5 days  
**Blocker Risk**: LOW (cosmetic, but important for risk mitigation)

---

### **8. Import Size Limits**
**Priority**: HIGH  
**Owner**: Backend  
**Deliverable**: Hard limit at 500 rows per file

**Code Changes**:
- [ ] Add row count check in validation service
- [ ] Return error if >500 rows: "Maximum 500 tenants per import"
- [ ] Update docs with limit explanation
- [ ] Add to upload UI (show limit before upload)

**Success Criteria**: Files >500 rows rejected with clear message

**Time Estimate**: 0.25 days  
**Blocker Risk**: LOW (simple validation)

---

### **9. Timeout Protection**
**Priority**: HIGH  
**Owner**: Backend  
**Deliverable**: Vercel timeout configured

**Code Changes**:
```typescript
// In /api/bulk-import/[batch_id]/confirm/route.ts
export const maxDuration = 60; // Vercel Pro only
export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
    responseLimit: '8mb'
  }
};
```

**Success Criteria**: Large imports don't timeout

**Time Estimate**: 0.1 days  
**Blocker Risk**: LOW (configuration only)

---

## 🟢 NICE TO HAVE (Defer to Post-Production)

### **10. Automatic Stuck Import Detection**
**Priority**: MEDIUM  
**Owner**: Backend  
**Deliverable**: Cron job to detect + mark stuck imports

**Implementation**:
```typescript
// Run every 10 minutes
async function detectStuckImports() {
  const stuckBatches = await prisma.bulkImportBatch.findMany({
    where: {
      status: 'IMPORTING',
      uploaded_at: { lt: new Date(Date.now() - 10 * 60 * 1000) }
    }
  });
  
  for (const batch of stuckBatches) {
    await prisma.bulkImportBatch.update({
      where: { id: batch.id },
      data: { status: 'FAILED', import_summary: { error: 'Import timeout' } }
    });
  }
}
```

**Time Estimate**: 0.5 days  
**Deploy**: After production validates (1-2 weeks)

---

### **11. Batch Recovery API**
**Priority**: MEDIUM  
**Owner**: Backend  
**Deliverable**: Endpoint to resume failed imports

**Endpoint**: `POST /api/bulk-import/{batch_id}/retry`

**Logic**: Re-import only failed/unprocessed rows

**Time Estimate**: 1 day  
**Deploy**: After observing production failures

---

### **12. Import Analytics Dashboard**
**Priority**: LOW  
**Owner**: Frontend  
**Deliverable**: Owner-facing import history + stats

**Features**:
- Import history table (last 30 days)
- Success/failure breakdown
- Common error types
- Average import size/duration

**Time Estimate**: 2 days  
**Deploy**: After 1 month of production data

---

## 📊 Execution Timeline

### **Week 1: Testing Phase** (May 13-19, 2026)
**Goal**: Pass all recovery + load tests

- **Day 1-2**: Create dirty test files, run dirty data tests
- **Day 3-4**: Run recovery scenarios (R1-R5)
- **Day 5**: Implement room capacity validation
- **Day 6**: 500-tenant load test
- **Day 7**: Fix issues found, re-test failures

**Deliverables**:
- ✅ All dirty data tests pass
- ✅ All recovery scenarios pass
- ✅ 500-tenant load test passes
- ✅ Room capacity validation implemented

---

### **Week 2: Staging Validation** (May 20-26, 2026)
**Goal**: 7 days of stable staging operation

- **Day 1**: Deploy to staging, setup monitoring
- **Day 2-3**: Small imports (5-10 tenants)
- **Day 4-5**: Medium imports (50 tenants)
- **Day 6**: Large imports (100-200 tenants)
- **Day 7**: 500-tenant stress test in staging

**Deliverables**:
- ✅ 7 days uptime
- ✅ >90% import success rate
- ✅ Monitoring alerts working
- ✅ No critical bugs

---

### **Week 3: Limited Production Rollout** (May 27 - June 2, 2026)
**Goal**: 5-10 production owners, monitor closely

- **Day 1**: Production deployment
- **Day 2-7**: Daily metrics review, owner feedback

**Acceptance Criteria**:
- ✅ Import success rate >85% (production data is messier)
- ✅ No data corruption incidents
- ✅ Support tickets <1 per import (mostly self-service)
- ✅ Recovery procedures work

---

### **Week 4+: Scale Gradually** (June 3+, 2026)
**Goal**: Expand to more owners, iterate on feedback

- Monitor metrics daily
- Fix edge cases as found
- Add deferred features (stuck import detection, retry API)
- Plan async processing if needed (3-6 months out)

---

## 🚫 What We Will NOT Do Yet

**Per audit feedback** - avoiding premature complexity:

- ❌ Redis-based rate limiting (in-memory sufficient)
- ❌ Async job queue (BullMQ/Celery)
- ❌ Streaming XLSX parser
- ❌ Secret derivation HMAC
- ❌ Multi-step onboarding wizard
- ❌ Real-time import progress (SSE/WebSocket)
- ❌ AI-powered data cleaning
- ❌ Automatic duplicate merging

**Timeline for deferred features**: 3-6 months after production validation

---

## ✅ Success Definition

**The system is production-ready when**:

1. ✅ All recovery tests pass (R1-R5)
2. ✅ All dirty data tests pass (10 scenarios)
3. ✅ 500-tenant load test passes (<60s, <50 MB)
4. ✅ Room capacity validation implemented
5. ✅ Monitoring + alerts configured
6. ✅ 7 days staging validation complete
7. ✅ Owner security warnings deployed

**Current Progress**: 3/7 complete (architecture, expiration, versioning)

**Remaining Work**: ~2 weeks (1 week testing + 1 week staging)

---

## 📞 Decision Points

**If 500-tenant test FAILS**:
- [ ] Add 500-row hard limit
- [ ] Consider chunking (100 rows at a time)
- [ ] Plan async processing (3 month roadmap item)

**If recovery tests FAIL**:
- [ ] Review transaction boundaries
- [ ] Add explicit locks (FOR UPDATE)
- [ ] Improve duplicate detection logic

**If staging finds critical bugs**:
- [ ] Fix and re-test
- [ ] Delay production rollout
- [ ] Do NOT ship until stable

---

**Status**: Execution plan ready  
**Next Action**: Create test files + run recovery scenarios  
**Blocker**: None (plan is clear, team can execute)
