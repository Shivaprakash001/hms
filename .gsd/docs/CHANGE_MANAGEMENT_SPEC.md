# Change Management — Product Specification

> **Status:** Draft Specification  
> **Author:** Product / Architecture  
> **Date:** 2026-07-07  
> **Scope:** Core platform capability for governed data changes across tenant profiles, agreements, financials, and room operations.

---

## 1. Core Principle

> Financial or contractual changes require consent.  
> Operational corrections do not.  
> Nothing is ever silently overwritten.

Every important entity in HMS — tenant profile, agreement, room assignment, financial contract, and move-out settlement — supports controlled change requests, approvals where appropriate, version history, and a complete audit trail.

---

## 2. Data Classification — Four Approval Levels

### Level 0 — System Automated (No Approval)

Actions performed by the system on schedule or in response to events.

| Examples |
|----------|
| Monthly rent obligation generation |
| Payment reminder dispatch |
| Auto-apply future rent credit to new obligations |
| Late fee generation |
| Agreement expiry notifications |

### Level 1 — Owner Controlled (No Tenant Approval)

Administrative details the owner can edit unilaterally. Tenant receives an informational notification but approval is not required.

| Field | Notification |
|-------|-------------|
| Room Allocation / Bed Number | "Your room has been changed to Room 401." |
| Internal Notes | None |
| Reminder Settings | None |
| KYC Verification Status | None |
| Hostel Branch | "You have been transferred to Branch X." |
| Tenant Tags | None |
| Payment Reminder Preferences | None |

### Level 2 — Shared Data (Owner Proposes → Tenant Approves)

Details that affect both parties. Owner creates a draft; tenant receives a change request with a diff view.

| Field |
|-------|
| Name |
| Phone Number |
| Email |
| Guardian Details |
| Address |
| Aadhaar / ID Number |
| College / Course |
| Emergency Contact |

**Workflow:**

```
Owner edits field
  → Draft change request created
  → Tenant receives notification
  → Tenant views diff (current vs proposed)
  → Accept → DB updated, audit logged
  → Reject → Owner notified, draft discarded
```

Until approval, both `current_value` and `pending_value` are visible in the UI.

### Level 3 — Financial / Contract Agreement (Mutual Consent)

Legal and financial records. Never allow direct editing — always create a **Change Request** or **Contract Amendment**.

| Field |
|-------|
| Monthly Rent |
| Security Deposit |
| Agreement Start / End Dates |
| Installment Schedule |
| Due Dates |
| Deposit Amount |
| Refund Amount |
| Payment Allocation |
| Maintenance Charges |
| Payment Frequency |

**Workflow:**

```
Owner clicks "Propose Contract Amendment"
  → Enters new values + mandatory reason
  → System creates Amendment Request
  → Tenant receives structured diff:
      ┌─────────────────────────────────┐
      │  Monthly Rent                   │
      │  Current: ₹8,000               │
      │  Proposed: ₹8,500              │
      │  Effective: 1 August 2026      │
      │  Reason: "Annual rent revision" │
      │  [Accept]  [Decline]           │
      └─────────────────────────────────┘
  → Accept → Agreement V2 created, new obligations generated
  → Decline → Owner notified, can re-propose
```

---

## 3. Expiration Policy

No change request remains pending forever.

```
Day 0   → Request created
Day 7   → Reminder to tenant
Day 14  → Second reminder
Day 30  → Request expires automatically
```

After expiration:
- Owner receives notification: "Your proposed change expired."
- Owner can resend or modify the proposal.
- No data is changed.

---

## 4. Administrative Corrections

For genuine data-entry mistakes (not policy changes), a separate workflow:

### Correction Window Rules

| Condition | Behavior |
|-----------|----------|
| No payments recorded against the data | Owner can correct immediately |
| Payments exist but correction is non-financial (e.g., name typo) | Owner can correct immediately |
| Financial data has payment history | Routes to Level 3 approval flow |
| Historical financial records | Requires reversal entry (see §5) |

### Correction Workflow

```
Owner submits correction
  → Mandatory reason field
  → System evaluates correction window
  → If within window: Apply immediately, notify tenant
  → If outside window: Route to approval flow
  → Always: Record in audit log (who, when, why, what changed)
  → Always: Tenant can view correction history
```

---

## 5. Financial Safety Rules — Reversal Over Mutation

Some records must never be directly edited. Instead, they require reversal entries.

| ❌ Never Allow | ✅ Instead |
|---------------|-----------|
| Edit payment amount (₹8,000 → ₹7,000) | Reverse payment → Record correct payment |
| Delete obligation | Waive obligation (with reason) |
| Modify settled obligation amount | Create corrective obligation |
| Change historical agreement terms | Create Agreement V2 |

This preserves accounting integrity and creates an immutable audit trail.

---

## 6. Versioning Model

Never overwrite important records. Create versions.

### Agreement Versioning

```
Agreement V1:  Apr → Jul 2026  |  ₹8,000/mo  |  Status: SUPERSEDED
Agreement V2:  Apr → Aug 2026  |  ₹8,500/mo  |  Status: ACTIVE
                                               |  Reason: "Annual revision"
                                               |  Approved: 2026-07-15
```

V1 remains permanently accessible for audit and dispute resolution.

### Obligation Versioning

Obligations use `is_superseded` flag (already implemented). Superseded obligations retain full history.

---

## 7. Database Design

### New Tables

```
change_requests
├── id                    UUID PK
├── entity_type           ENUM (tenant_profile, agreement, obligation, room_allocation)
├── entity_id             UUID
├── change_type           ENUM (amendment, correction, administrative)
├── approval_level        INT (0-3)
├── status                ENUM (pending, approved, rejected, expired, applied)
├── proposed_by           UUID → profile.id (owner)
├── approved_by           UUID → profile.id (tenant, nullable)
├── reason                TEXT NOT NULL
├── current_snapshot      JSONB  — frozen state before change
├── proposed_changes      JSONB  — diff of fields to change
├── applied_at            TIMESTAMP
├── expires_at            TIMESTAMP
├── reminder_sent_at      TIMESTAMP[]
├── created_at            TIMESTAMP
├── updated_at            TIMESTAMP
├── owner_id              UUID
├── hostel_id             UUID
└── tenant_id             UUID

change_request_audit_log
├── id                    UUID PK
├── change_request_id     UUID → change_requests.id
├── action                ENUM (created, reminded, approved, rejected, expired, applied, cancelled)
├── actor_id              UUID → profile.id
├── actor_role            ENUM (owner, tenant, system)
├── metadata              JSONB
└── created_at            TIMESTAMP
```

### Relationship to Existing Tables

```
change_requests ──→ tenants
change_requests ──→ agreement
change_requests ──→ rent_obligations
change_requests ──→ profile (proposed_by)
change_requests ──→ profile (approved_by)
```

---

## 8. UI Flows

### Owner: Propose Change

```
Tenant Profile → Edit
  → System shows field classification badge (L1/L2/L3)
  → L1 fields: Edit directly, save
  → L2 fields: "Submit for Tenant Approval"
  → L3 fields: "Propose Contract Amendment"
  → Reason field appears for L2/L3
  → Submit → Status badge: "Waiting for Tenant Approval"
```

### Tenant: Review Change

```
Notification: "Hostel requested changes to your profile"
  → Opens diff view:
      ┌────────────────────────────────────────┐
      │  Phone Number                          │
      │  Current:  +91 98765 43210             │
      │  Proposed: +91 98765 43211             │
      │  Reason:   "Corrected last digit"      │
      │  Requested by: Owner on 7 Jul 2026     │
      │                                        │
      │  [Accept]  [Reject]                    │
      └────────────────────────────────────────┘
```

### Owner: View Pending Changes

```
Dashboard → Change Requests (badge count)
  → List of pending/expired/applied changes
  → Filter by status, tenant, type
  → Resend expired requests
```

---

## 9. Implementation Phases (Recommended)

### Phase 1 — Foundation
- `change_requests` + `change_request_audit_log` tables
- Field classification registry (L0-L3 mapping)
- Administrative correction workflow (for immediate needs)

### Phase 2 — Level 1 + Level 2
- Owner-controlled edits with notifications
- Shared data approval flow (propose → approve → apply)
- Diff view component
- Expiration cron job

### Phase 3 — Level 3 (Financial)
- Contract amendment workflow
- Agreement versioning (V1 → V2)
- Financial correction with reversal entries
- Integration with settlement planner

### Phase 4 — Polish
- Dashboard: pending changes widget
- Audit trail viewer
- Bulk change requests
- Change request analytics

---

## 10. Competitive Differentiator

> Most hostel management systems allow direct edits.  
> HMS provides **traceable, mutually acknowledged changes** for sensitive data.

This positions HMS for:
- Multi-hostel operators who need audit compliance
- Dispute resolution (both parties agreed to terms)
- Regulatory readiness (financial record integrity)
- Reduced developer intervention for owner mistakes
