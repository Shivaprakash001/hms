# Billing & Subscription System Architecture

## Overview

The HMS billing system implements a multi-tier, subscription-based model with:
- **Plan enforcement** at API layer
- **Subscription lifecycle** (TRIAL → ACTIVE → GRACE → EXPIRED | LIMITED)
- **Autopay with grace period** and retry schedule
- **Message pack add-on** system with atomic quota deduction
- **Trial-to-downgrade transitions** based on usage

---

## Plans Configuration

All plans are stored in the `plans` table (seeded on migration):

| Plan | Price | Tenants | Hostels | Automation | Messaging | Multi-Hostel | Analytics |
|------|-------|---------|---------|-----------|-----------|-------------|-----------|
| FREE | ₹0 | 20 | 1 | ✗ | ✗ | ✗ | ✗ |
| STARTER | ₹799 | 60 | 1 | ✓ | ✓ | ✗ | ✗ |
| GROWTH | ₹1499 | 150 | 2 | ✓ | ✓ | ✓ | ✗ |
| BUSINESS | ₹2499 | 400 | 4 | ✓ | ✓ | ✓ | ✓ |
| SCALE | Custom | ∞ | ∞ | ✓ | ✓ | ✓ | ✓ |

---

## Subscription States & Transitions

### TRIAL (0-3 days)
- Full STARTER access
- `trial_ends_at` set to now + 3 days
- On expiration:
  - If usage ≤ FREE limits → downgrade to FREE, status = ACTIVE
  - If usage > FREE limits → status = LIMITED (no new tenants/hostels)

### ACTIVE
- Full plan access
- Autopay enabled by default
- `next_billing_at` scheduled monthly

### GRACE (7 days)
- Full plan access maintained
- Retry attempts: day 0 (immediate), day 3, day 7
- On success at any retry → return to ACTIVE
- On failure at day 7 → transition to EXPIRED

### EXPIRED
- **Read-only mode enforced at API layer**
- Cannot create tenants, hostels, generate rent
- Can view dashboard and historical data
- Owner must upgrade to restore write access

### LIMITED
- Entered when trial ends and usage exceeds FREE limits
- Cannot create new tenants or hostels
- Existing data readable
- Automation disabled
- Show upgrade banner on UI

---

## Enforcement Layer (`plan-enforcement-service.ts`)

All business actions call one or more of these methods:

### `assertSubscriptionActive(ownerId)`
- Throws if status = EXPIRED or LIMITED
- Allows: TRIAL, ACTIVE, GRACE

**Called by:**
- Invite tenant
- Create hostel
- Dashboard access

### `assertTenantLimit(ownerId)`
- Throws if active tenants ≥ plan.tenant_limit
- SCALE plans have no hard limit

**Called by:**
- Invite tenant

### `assertHostelLimit(ownerId)`
- Throws if active hostels ≥ plan.hostel_limit
- SCALE plans have no hard limit

**Called by:**
- Create hostel

### `assertFeature(ownerId, feature)`
- Throws if plan doesn't have feature enabled
- Features: `automation`, `messaging`, `multi_hostel`, `analytics`

**Called by:**
- Rent generation (automation)
- Message sending (messaging)
- Dashboard analytics (analytics)

### `assertMessageQuota(ownerId)`
- Throws if message credits = 0
- Logs warning if credits < 20% of purchased

**Called by:**
- Message send via WhatsApp/SMS

---

## Message Pack System

### Purchase Flow
- **POST /api/billing/message-quota**
- Available packs:
  - ₹99 → 200 messages
  - ₹199 → 500 messages
- Packs stored in `message_packs` table
- Quota carries forward (no expiry)

### Send Flow (Atomic)
1. Check total credits available
2. **Transaction:**
   - Deduct 1 from oldest pack(s)
   - Create `message_logs` entry
3. Simulate provider send (WhatsApp/Twilio)
4. Return remaining credits

### Key Rules
- Deduction happens ONLY on successful send
- Multiple packs: deduct from oldest first
- Zero quota blocks all sends
- Warning at <20% threshold

---

## Autopay Lifecycle (`autopay-service.ts`)

### Initial Charge
- Called when subscription transitions to ACTIVE
- Simulates PhonePe charge (80% success in demo)
- On success: extend `next_billing_at` by 1 month

### Grace Period (on payment failure)
1. Enter GRACE status
2. Set `grace_started_at`, `grace_ends_at` (now + 7 days)
3. Retry schedule:
   - Day 0: Immediate retry on enter
   - Day 3: Cron-triggered retry
   - Day 7: Cron-triggered retry (final)

### Cron Job
- **POST /api/cron/process-autopay-retries**
- Runs daily (Vercel Cron)
- Checks for GRACE subscriptions, triggers day 3 and day 7 retries
- On final failure: mark EXPIRED

### Expiration Flow
- Status → EXPIRED
- Send owner email notification
- Broadcast `subscription_expired` event
- Enforcement layer blocks all writes

---

## API Integration Points

### 1. Invitation Service
```typescript
// Before creating tenant:
await planEnforcementService.assertSubscriptionActive(ownerId);
await planEnforcementService.assertTenantLimit(ownerId);
```

### 2. Property Service (Hostel Creation)
```typescript
// Before creating new hostel:
await planEnforcementService.assertSubscriptionActive(userId);
await planEnforcementService.assertHostelLimit(userId);
```

### 3. Rent Generation Service
```typescript
// Per-owner, per-month before generating rent:
await planEnforcementService.assertFeature(ownerId, "automation");
```

### 4. Reminder Service (WhatsApp)
```typescript
// Attempt WhatsApp send:
await messageService.sendMessage(ownerId, "WHATSAPP", phone, template, body);
// Throws if quota = 0; deducts 1 on success
```

---

## Database Schema

### Plans
```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT,
  price_inr INTEGER,
  tenant_limit INTEGER,
  hostel_limit INTEGER,
  automation BOOLEAN,
  messaging BOOLEAN,
  multi_hostel BOOLEAN,
  analytics BOOLEAN,
  is_custom BOOLEAN
);
```

### Subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  owner_id UUID UNIQUE,
  plan_id TEXT REFERENCES plans(id),
  status TEXT, -- TRIAL, ACTIVE, GRACE, EXPIRED, LIMITED
  trial_ends_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  autopay_enabled BOOLEAN DEFAULT true,
  grace_started_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Message Packs
```sql
CREATE TABLE message_packs (
  id UUID PRIMARY KEY,
  owner_id UUID,
  messages_total INTEGER,
  messages_remaining INTEGER,
  price_inr INTEGER,
  purchased_at TIMESTAMPTZ DEFAULT now()
);
```

### Message Logs
```sql
CREATE TABLE message_logs (
  id UUID PRIMARY KEY,
  owner_id UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  channel TEXT,
  template TEXT,
  recipient TEXT,
  success BOOLEAN,
  deduction INTEGER
);
```

### Autopay Attempts
```sql
CREATE TABLE autopay_attempts (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  attempt_at TIMESTAMPTZ DEFAULT now(),
  result TEXT,
  provider_response TEXT
);
```

---

## Deployment Checklist

### 1. Database
- [ ] Run migration `050_subscription_billing.sql`
- [ ] Seed default plans
- [ ] Create subscriptions for all existing owners (fallback to FREE/ACTIVE)

### 2. Services
- [ ] `plan-enforcement-service.ts` deployed
- [ ] `message-service.ts` deployed
- [ ] `autopay-service.ts` deployed

### 3. API Endpoints
- [ ] GET /api/billing/plans
- [ ] GET/POST /api/billing/message-quota
- [ ] POST /api/cron/process-autopay-retries

### 4. Integration
- [ ] `invitation-service.ts` calls enforcement checks
- [ ] `property-service.ts` calls enforcement checks
- [ ] `rent-generation-service.ts` calls automation feature check
- [ ] `reminder-service.ts` calls message quota checks

### 5. Environment
- [ ] `CRON_SECRET` set for /api/cron/* endpoints
- [ ] Vercel Cron configured for daily retry processing

---

## Testing & Validation

### Unit Tests
- Plan enforcement assertions
- Trial → transition logic
- Message pack deduction (atomicity)
- Autopay retry schedule

### Integration Tests
- Full subscription flow: signup → trial → active → grace → expired
- Tenant/hostel limits enforcement
- Feature flag blocking
- Message quota blocking

### Manual Testing
1. Create new owner → gets TRIAL subscription
2. Create 21 tenants → should fail (exceeds STARTER 60 after trial downgrade)
3. Purchase 200-message pack → should allow WhatsApp sends
4. Send 201 messages → should block on 201st
5. Disable autopay → subscription should go to GRACE after month
6. Grace period → retries on day 3, day 7

---

## Edge Cases & Resolutions

| Issue | Resolution |
|-------|-----------|
| Subscription missing | Service auto-creates FREE/ACTIVE fallback |
| Duplicate message deduction | Transaction-level atomicity + unique pack IDs |
| Grace period retry failure | Cron logs warning, owner gets email on EXPIRED |
| Trial end while creating tenant | `getEffectiveSubscription()` calls trial transition |
| Quota zero but no packs | Blocked by assertMessageQuota |
| SCALE custom limits | `is_custom=true` bypasses hard limits |

---

## Operations & Admin

### Check Owner Subscription Status
```sql
SELECT s.id, s.owner_id, s.status, s.plan_id, p.name
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.owner_id = $1;
```

### Extend Trial for Owner
```sql
UPDATE subscriptions
SET trial_ends_at = NOW() + INTERVAL '3 days'
WHERE owner_id = $1;
```

### Add Message Credits (Admin Override)
```sql
INSERT INTO message_packs (id, owner_id, messages_total, messages_remaining, price_inr)
VALUES (gen_random_uuid(), $1, 100, 100, 0);
```

### Force Expiration
```sql
UPDATE subscriptions
SET status = 'EXPIRED', updated_at = NOW()
WHERE owner_id = $1;
```

---

## References

- Migration: [migrations/050_subscription_billing.sql](../migrations/050_subscription_billing.sql)
- Service: [lib/services/plan-enforcement-service.ts](../lib/services/plan-enforcement-service.ts)
- Service: [lib/services/message-service.ts](../lib/services/message-service.ts)
- Service: [lib/services/autopay-service.ts](../lib/services/autopay-service.ts)
- APIs: [app/api/billing/](../app/api/billing/)
