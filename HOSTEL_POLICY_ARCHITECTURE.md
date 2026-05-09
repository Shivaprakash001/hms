# HMS Hostel Policy Architecture

Date: 2026-05-09
Phase: 1 - Hostel Preferences Architecture

## Objective

Design the unified, hostel-scoped policy architecture that will evolve HMS from scattered preference flags into a configurable multi-hostel operating system.

This phase is intentionally architecture-first. It does not rewrite runtime behavior. It maps the existing preference surface, identifies deterministic policy boundaries, and defines the migration-safe target shape for later implementation phases.

## Core Rule

All operational customization is hostel-scoped.

Correct resolution paths:

```text
explicit hostel context -> hostel.preferences_config -> policy domain
entity -> allocation/payment/obligation -> room/hostel -> policy domain
```

Forbidden paths:

```text
owner -> first hostel -> preferences
owner -> global preferences -> operational behavior
hostels[0] -> settings
cached owner preference -> tenant/payment/reminder behavior
```

## What Was Inspected

- `backend-next/lib/preferences.ts`
- `backend-next/lib/services/property-service.ts`
- `backend-next/lib/services/hostel-billing-preferences-service.ts`
- `backend-next/lib/services/billing-validation.ts`
- `backend-next/lib/services/rent-generation-service.ts`
- `backend-next/lib/services/reminder-service.ts`
- `backend-next/lib/services/receipt-service.ts`
- `backend-next/app/api/owner/me/preferences/route.ts`
- `backend-next/app/api/hostels/[id]/billing-defaults/route.ts`
- `backend-next/app/api/rooms/[id]/invite-defaults/route.ts`
- `frontend/src/pages/owner/OwnerProfile.jsx`
- `frontend/src/pages/onboarding/OnboardingBilling.jsx`
- `frontend/src/components/owner/TenantInvitationForm.jsx`
- Frontend owner preference cache and query-key behavior from Phase 1 hardening

## Current State

HMS currently has a single typed preference resolver in `backend-next/lib/preferences.ts`, which is good. The weakness is shape and context, not the existence of a resolver.

Current preference data is spread across:

- Typed `hostels` columns such as `currency`, `rent_cycle`, `receipt_prefix`, `timezone`, `auto_rent_day`, `upi_id`, `phonepe_merchant_id`, `gst_number`, and `logo_url`.
- Flat `hostels.preferences_config` keys such as `due_day`, `late_fee_rules`, `auto_generate_rent`, `reminder_day_1`, `receipt_footer`, and `require_doc_approval`.
- A newer nested `preferences_config.billing_defaults` object used by tenant invitation defaults.
- Legacy owner profile/preference APIs that still choose the first active hostel for backward compatibility.

## Risks Discovered

### HIGH - Flat Preference Shape Encourages Policy Drift

Existing keys mix billing, reminders, tenant rules, receipts, security, localization, and automation in one flat object. This makes it too easy for future features to add another unstructured flag without knowing its operational domain.

Risk:

- hard-to-audit behavior
- accidental cross-domain coupling
- inconsistent validation
- weak versioning and rollback semantics

### HIGH - Legacy Owner Preference Route Remains Hostel-Ambiguous

`property-service.ts` still resolves owner preferences through the first active hostel. This is owner-isolated but not hostel-deterministic.

Risk:

- multi-hostel owners can edit settings for an unintended hostel
- onboarding and profile settings may appear to work while targeting the wrong property

### HIGH - Financial Policy Requires Versioning

Billing, late fees, partial payments, maintenance, deposits, and receipt behavior affect financial records. Preference changes must be auditable and historically attributable.

Risk:

- future policy changes may be confused with historical policy application
- finance support cannot answer which rules were active when an obligation was generated

### MEDIUM - Reminder Configuration Is Too Coarse

Current reminder preferences are booleans for day 1/day 5/day 10 and channels. The future product vision needs configurable before-due schedules, after-due schedules, escalation, tone, templates, and credit-aware channel fallback.

Risk:

- code changes required for every reminder strategy
- no clear separation between collection policy and notification delivery policy

### MEDIUM - Dashboard And Room Policies Are Underdefined

Dashboard preferences and room rules do not yet have a formal policy domain. They are likely to be added piecemeal unless reserved now.

Risk:

- future hostel switcher and portfolio dashboard work may reintroduce owner-global assumptions

## Target Policy Shape

`hostels.preferences_config` should remain the rollout-safe storage location initially. The target shape is a versioned policy document grouped by operational domains.

```json
{
  "policy_version": 1,
  "schema_version": "2026-05-09",
  "billing": {
    "rent_cycle": "MONTHLY",
    "auto_rent_day": 1,
    "due_day": 5,
    "grace_days": 0,
    "late_fee": {
      "enabled": false,
      "rules": [],
      "max_amount": 500
    },
    "deposit": {
      "enabled": false,
      "default_amount": 0,
      "refundable": true
    },
    "maintenance": {
      "type": "MONTHLY",
      "amount": 0
    },
    "invite_defaults": {
      "auto_fill_room_rent": true,
      "allow_override": true
    },
    "partial_payments": {
      "enabled": false,
      "minimum_amount": 500
    },
    "advance_adjustments": {
      "enabled": false
    },
    "overflow": {
      "enabled": true,
      "strategy": "CARRY_FORWARD"
    }
  },
  "payments": {
    "upi_id": null,
    "phonepe_merchant_id": null,
    "payment_instructions": null
  },
  "reminders": {
    "enabled": true,
    "channels": {
      "email": true,
      "in_app": true,
      "whatsapp": false,
      "sms": false
    },
    "schedule": {
      "before_due_days": [],
      "after_due_days": [1, 5, 10]
    },
    "escalation": {
      "enabled": false,
      "after_days": [],
      "tone": "STANDARD"
    },
    "auto_stop_after_payment": true,
    "late_fee_notifications": true,
    "owner_daily_summary": false
  },
  "receipts": {
    "prefix": "HMS",
    "format": "PREFIX-YEAR-SEQ",
    "auto_email": false,
    "footer": "",
    "invoice_notes": null,
    "legal_disclaimer": null
  },
  "branding": {
    "logo_url": null,
    "primary_color": null,
    "accent_color": null,
    "support_contact": null,
    "legal_name": null,
    "gst_number": null
  },
  "tenant_rules": {
    "allow_profile_edits": true,
    "profile_photo_required": false,
    "emergency_contact_required": false,
    "required_profile_fields": [],
    "invite_expiry_hours": 48,
    "verification_workflow": "OWNER_REVIEW",
    "tenant_segment": "MIXED"
  },
  "documents": {
    "approval_required": false,
    "aadhaar_required": false,
    "required_types": []
  },
  "room_rules": {
    "capacity_enforcement": "STRICT",
    "allow_overbooking": false,
    "transfer_policy": "OWNER_APPROVAL",
    "allocation_requires_room_rent": true
  },
  "automation": {
    "auto_generate_rent": true,
    "auto_apply_late_fees": true,
    "auto_send_reminders": true,
    "auto_email_receipts": false,
    "auto_deactivate_days": 0,
    "nightly_reconciliation": true,
    "snapshot_generation": true
  },
  "dashboard": {
    "default_view": "OPERATIONS",
    "enabled_widgets": [],
    "show_risk_alerts": true,
    "show_collection_forecast": true,
    "highlight_overdue": true,
    "occupancy_warning_threshold": 80,
    "collection_target_percentage": 95
  },
  "notifications": {
    "owner_daily_summary": false,
    "channels": {
      "email": true,
      "in_app": true,
      "whatsapp": false,
      "sms": false
    }
  },
  "operations": {
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "date_format": "DD/MM/YYYY",
    "time_format": "12h",
    "language": "en",
    "data_retention_months": 0
  }
}
```

## Legacy-To-Policy Mapping

| Current Source | Current Key | Target Domain |
| --- | --- | --- |
| `hostels.rent_cycle` | `rent_cycle` | `billing.rent_cycle` |
| `hostels.auto_rent_day` | `auto_rent_day` | `billing.auto_rent_day` |
| `preferences_config` | `due_day` | `billing.due_day` |
| `preferences_config` | `grace_days` | `billing.grace_days` |
| `preferences_config` | `late_fee_rules` | `billing.late_fee.rules` |
| `preferences_config` | `max_late_fee` | `billing.late_fee.max_amount` |
| `preferences_config` | `late_fee_type`, `late_fee_amount`, `late_fee_percentage`, `late_fee_after_days` | legacy fallback into `billing.late_fee.rules` |
| `preferences_config.billing_defaults` | `advance_deposit` | `billing.deposit.default_amount` |
| `preferences_config.billing_defaults` | `maintenance_charge` | `billing.maintenance.amount` |
| `preferences_config.billing_defaults` | `maintenance_type` | `billing.maintenance.type` |
| `preferences_config.billing_defaults` | `auto_fill_room_rent` | `billing.invite_defaults.auto_fill_room_rent` |
| `preferences_config.billing_defaults` | `allow_override` | `billing.invite_defaults.allow_override` |
| `preferences_config` | `advance_enabled`, `advance_amount_default`, `advance_refundable` | `billing.deposit` |
| `preferences_config` | `maintenance_enabled`, `maintenance_amount_default`, `maintenance_type` | `billing.maintenance` |
| `preferences_config` | `allow_partial_payments`, `min_payment_amount` | `billing.partial_payments` |
| `hostels.upi_id` | `upi_id` | `payments.upi_id` |
| `hostels.phonepe_merchant_id` | `phonepe_merchant_id` | `payments.phonepe_merchant_id` |
| `preferences_config` | `reminder_email`, `reminder_in_app`, `reminder_whatsapp` | `reminders.channels` |
| `preferences_config` | `reminder_day_1`, `reminder_day_5`, `reminder_day_10` | `reminders.schedule.after_due_days` |
| `preferences_config` | `late_fee_notification`, `owner_daily_summary` | `reminders` and `notifications` |
| `preferences_config` | `auto_generate_rent`, `auto_apply_late_fees`, `auto_send_reminders`, `auto_deactivate_days` | `automation` |
| `hostels.receipt_prefix` | `receipt_prefix` | `receipts.prefix` |
| `preferences_config` | `receipt_format`, `auto_email_receipt`, `receipt_footer` | `receipts` and `automation.auto_email_receipts` |
| `hostels.logo_url` | `logo_url` | `branding.logo_url` |
| `hostels.gst_number` | `gst_number` | `branding.gst_number` |
| `preferences_config` | `allow_tenant_edits`, `require_profile_photo_onboarding` | `tenant_rules` |
| `preferences_config` | `require_doc_approval`, `require_aadhaar` | `documents` |
| `hostels.currency`, `hostels.timezone` | `currency`, `timezone` | `operations` |
| `preferences_config` | `date_format`, `time_format`, `language`, `data_retention_months` | `operations` |

## Policy Access Architecture

Create a future `hostel-policy-service.ts` as the only read/write layer for policy documents.

Required APIs:

```ts
getHostelPolicy(hostelId: string, ownerId?: string): Promise<HostelPolicy>
updateHostelPolicy(hostelId: string, ownerId: string, patch: HostelPolicyPatch, changedBy: string): Promise<HostelPolicy>
resolvePolicyForRoom(roomId: string, ownerId?: string): Promise<HostelPolicy>
resolvePolicyForTenant(tenantId: string, ownerId?: string): Promise<HostelPolicy>
resolvePolicyForPayment(paymentId: string, ownerId?: string): Promise<HostelPolicy>
snapshotPolicyForFinancialEvent(policy: HostelPolicy, domain: keyof HostelPolicy): PolicySnapshot
```

Rules:

- `getHostelPolicy` requires explicit hostel context and validates owner ownership when `ownerId` is provided.
- Entity resolvers must use deterministic lineage helpers from `backend-next/lib/hostel-context.ts`.
- Operational services must not import `getPreferences(ownerId)`.
- Policy normalization must merge typed columns, legacy flat JSON, and nested policy domains into one typed policy object.
- Writes should prefer the nested domain shape and keep legacy flat mirrors only while backward compatibility requires it.

## API Contract Direction

Phase 2 should introduce explicit hostel preference routes:

```text
GET   /api/hostels/:id/preferences
PATCH /api/hostels/:id/preferences
```

Required behavior:

- Resolve owner scope via `resolveOwnerScope`.
- Validate `hostel.id + owner_id + is_active`.
- Return normalized policy plus compatibility `preferences` during transition.
- Patch only allowed policy domains and validate each domain independently.
- Emit `HOSTEL_POLICY_UPDATED` and domain-specific events such as `BILLING_DEFAULTS_UPDATED`.

Example response:

```json
{
  "hostel": { "id": "...", "name": "Hostel A" },
  "policy": { "policy_version": 4, "billing": {}, "reminders": {} },
  "compatibility_preferences": { "auto_rent_day": 1, "due_day": 5 }
}
```

## Versioning And Audit Trail

Policy changes affect operations. HMS needs a durable policy history.

Future additive table:

```sql
CREATE TABLE hostel_policy_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  changed_by UUID REFERENCES profiles(id),
  policy_version INTEGER NOT NULL,
  changed_fields JSONB NOT NULL,
  before_policy JSONB NOT NULL,
  after_policy JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Versioning rules:

- Increment `policy_version` on every successful policy update.
- Store before and after policy snapshots.
- Store changed field paths, not just the full blob.
- Financial workflows should capture the relevant policy version when generating obligations, receipts, late fees, or tenant billing snapshots.
- Preference rollback should be implemented as a new change event, not as a history rewrite.

## Financial Immutability Rules

Policy changes are prospective by default.

- New tenants inherit current invite/billing defaults into tenant fields.
- Existing tenants are not mutated when hostel defaults change.
- Existing obligations are not recalculated when due-day, rent-day, maintenance, or late-fee policy changes.
- Receipts remain immutable after issuance.
- Late fees use the policy active at generation time, and future phases should persist `policy_version` or a policy snapshot reference on generated financial records.

## Domain Validation Rules

### Billing

- `auto_rent_day` and `due_day`: 1-28.
- `grace_days`: 0-30.
- late-fee rule amount: 0-50000.
- late-fee percentage: 0-100.
- maximum late-fee cap: 0-50000.
- deposit and maintenance amounts: non-negative.
- maintenance type: `MONTHLY`, `ONE_TIME`, or `NONE`.

### Reminders

- channels must be supported and credit-aware.
- schedule day arrays must be integers within a safe window.
- automated reminders must respect subscription and credit gates.

### Tenant Rules And Documents

- required fields must be from an allowlist.
- document types must be from an allowlist.
- profile-photo and document approval requirements must resolve through tenant hostel lineage.

### Branding And Receipts

- receipt prefix must be normalized and bounded.
- logo URL must be validated as an owned/uploaded asset.
- GST/legal fields must be hostel-specific.

### Dashboard

- widget IDs must be from an allowlist.
- alert thresholds must be bounded percentages or positive numbers.
- portfolio rollups must not reuse hostel-level cache keys without owner and hostel scope.

## Rollout Sequencing

1. Keep `preferences_config` as the storage primitive and add a normalized policy resolver.
2. Add explicit `/api/hostels/:id/preferences` routes and migrate the owner settings UI to selected-hostel context.
3. Move billing defaults into `billing.deposit`, `billing.maintenance`, and `billing.invite_defaults` while preserving `billing_defaults` read compatibility.
4. Move reminder behavior into `reminders.schedule`, `reminders.channels`, and `reminders.escalation`.
5. Add `hostel_policy_change_logs` and incrementing policy versions.
6. Store policy versions on generated financial artifacts.
7. Add CI guards preventing new operational imports of `getPreferences(ownerId)` and direct `preferences_config` reads.
8. Gradually remove legacy flat writes after all runtime consumers read through the policy service.

## Tests Required In Later Phases

- Hostel A and Hostel B can store different policy domains under one owner.
- Owner A cannot read or patch Owner B hostel policies.
- Tenant invite defaults still resolve from selected room's hostel.
- Existing tenants remain unchanged after billing policy updates.
- Rent generation uses the correct hostel billing policy.
- Reminder automation uses the correct hostel reminder policy.
- Receipt rendering uses the correct hostel receipt and branding policy.
- Policy change logs capture before/after diffs and increment versions.
- Legacy flat preferences continue to normalize correctly during transition.
- Static regression fails if operational services import `getPreferences(ownerId)`.

## Files Changed In This Phase

- `HOSTEL_POLICY_ARCHITECTURE.md`

No runtime code was changed in this phase.

## Remaining Risks

- Legacy owner preference APIs still target the first active hostel.
- The future nested policy resolver is not implemented yet.
- Policy version history is not implemented yet.
- Some current services still consume flat preferences through `resolvePreferences`.
- Dashboard and room policy domains are reserved but not wired to runtime behavior.
- RLS and raw SQL hardening remain separate security phases.

## Rollback Strategy

This phase is documentation-only. Rollback is simply removing `HOSTEL_POLICY_ARCHITECTURE.md`. No database, API, or runtime behavior changed.

## Operational Rollout Notes

- Treat this document as the policy contract for subsequent phases.
- Do not expose owner-global preference editing as the long-term UX.
- Begin UX migration toward a selected-hostel settings workspace before adding more policy domains.
- Preserve compatibility reads during rollout, but make new writes use explicit hostel routes and nested policy domains.
