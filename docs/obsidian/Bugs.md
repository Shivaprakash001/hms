---
tags: [bugs]
---

# Bugs

Related: [[Features]] · [[Changelog]] · [[TODO]] · [[Business-Rules]]

Log of significant bugs — open and fixed. Not meant to replace an issue tracker for every minor bug; use this for anything that revealed a real architectural/business-rule gap (the kind of thing worth remembering months later), matching the bar already used in `docs/known-issues.md` and `docs/business-logic/*-investigation-report.md`.

## Bug report template

Copy this block for each new entry:

```markdown
### <Short title>

- **Status:** open / investigating / fixed
- **Found:** YYYY-MM-DD
- **Area:** [[Backend]] / [[Frontend]] / [[Database]]
- **Symptom:** What did the user/system observe?
- **Root cause:** Once known — the actual mechanism, not just the symptom.
- **Fix:** What changed, and where (file/commit).
- **Related:** [[links]]
```

---

## Fixed

### Ledger `entry_type` vs `type` field mismatch crashed tenant financial timeline

- **Status:** fixed
- **Found:** 2026-07 (during Owner Financial Workspace redesign)
- **Area:** [[Backend]] — `financial-timeline-service.ts`
- **Symptom:** Runtime throw whenever a tenant had any `tenant_financial_ledger` rows.
- **Root cause:** Service referenced `entry_type`, but the actual Prisma field on `tenant_financial_ledger` is `type`.
- **Fix:** Corrected field reference in `backend-next/src/services/payments/financial-timeline-service.ts`.
- **Related:** [[Features]] (Owner financial workspace)

### Raw SQL calculators used `o.amount` instead of `o.total_amount`, silently dropping late fees

- **Status:** fixed
- **Found:** 2026-07
- **Area:** [[Database]] / [[Backend]]
- **Symptom:** Owner and tenant surfaces showed different Outstanding/Overdue/Future Credit for the same tenant.
- **Root cause:** ~6 independently duplicated outstanding/overdue calculators across surfaces; two used the wrong column in raw SQL.
- **Fix:** Introduced `financial-read-model-service.ts` composing existing services; migrated consumers. See `docs/business-logic/financial-consistency-investigation-report.md` and [[Decisions]] ADR-001.
- **Related:** [[Business-Rules]], [[Decisions]]

## Open / known issues

> See also `docs/known-issues.md` for the maintained list of known drift/gaps in `docs/`.

- **Manual ledger POST route validates against the wrong enum values.** `/api/tenants/[id]/financial-ledger` only accepts `DEPOSIT/TOPUP/DEDUCTION/REFUND/CORRECTION`, none of which exist in the real `FinancialLedgerReason` Prisma enum. Left untouched as out-of-scope during the 2026-07 financial workspace redesign — worth fixing if that route is ever actually exercised.
- **No live-database audit done** for tenants with simultaneous Outstanding + Future Credit predating the future-credit-auto-consumption fix (`cf88ce94`). Needs an explicit user-run query.

## See also
- [[Features]] for which feature each bug affected
- [[Changelog]] for when fixes shipped
