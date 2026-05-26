# Notification Triggers

## Trigger types

| Trigger | Why it fires | Likely channel |
|---|---|---|
| Invitation | Owner invites a tenant | Email or WhatsApp |
| Activation nudge | Tenant has not completed activation | Email or WhatsApp |
| Rent reminder | Due date is near or passed | Email or WhatsApp |
| Payment update | Payment status changes | In-app, email, or WhatsApp |
| Document review | Document is approved or rejected | In-app or WhatsApp |
| Move-out update | Exit workflow changes | In-app or WhatsApp |
| Test reminder | Owner tests notification config | Email or WhatsApp |

**How this works:**
1. Business services create or request messages.
2. Notification services select provider behavior.
3. Logs store message attempts and webhook events.

## Cron jobs

| Cron route | Purpose |
|---|---|
| `/api/cron/rent-reminders` | Sends rent reminders. |
| `/api/cron/onboarding-nudges` | Nudges incomplete activation. |
| `/api/cron/generate-rent` | Creates rent obligations. |
| `/api/cron/reconcile-payments` | Reconciles payments. |
| `/api/cron/move-out-releases` | Processes move-out release tasks. |

**How this works:**
1. Vercel calls cron routes on schedule.
2. Routes check `CRON_SECRET` when configured.
3. Services process eligible records in batches.

## Redis queue and cache invalidation map

| Event | Redis action |
|---|---|
| Payment recorded | Invalidate owner, hostel, portfolio, and tenant dashboard tags. |
| Rent generated | Invalidate owner and hostel dashboard tags. |
| Expense changed | Invalidate owner, hostel, analytics, and portfolio tags. |
| Tenant activated, transferred, moved out, or reactivated | Invalidate owner, hostel, and tenant dashboard tags. |
| Room allocated, released, created, updated, or deleted | Invalidate owner and hostel dashboard tags. |
| Reminder or late fee creates financial state | Invalidate owner, hostel, and portfolio tags. |

**How this works:**
1. Redis tag sets remember cache keys created for each owner, hostel, or tenant.
2. Domain events delete tagged keys after mutations.
3. Short TTLs protect users if a rare invalidation path is missed.

## Redis queue primitives

| Queue | Intended work |
|---|---|
| `whatsapp-reminders` | WhatsApp rent and activation reminders. |
| `email-notifications` | Email reminders and operational notifications. |
| `receipt-generation` | Deferred receipt or invoice rendering. |
| `rent-generation` | Coordination around scheduled rent work. |
| `late-fee-processing` | Deferred late-fee jobs. |

**How this works:**
1. Jobs enter Redis sorted sets with a `runAfter` score.
2. Cron drains bounded batches and retries failed jobs.
3. Dead-letter sets keep terminal failures inspectable.

## Logs

| Model | Purpose |
|---|---|
| `notifications` | In-app notification records. |
| `reminder_logs` | Rent reminder attempts. |
| `message_logs` | General message tracking. |
| `whatsapp_logs` | WhatsApp delivery events. |
| `whatsapp_webhook_events` | Raw WhatsApp webhook events. |

**How this works:**
1. Logs preserve delivery evidence.
2. Webhook events allow provider replay analysis.
3. Owners can trust reminders were attempted.

> **Needs clarification:** Exact notification templates and provider fallback order are not fully centralized. Confirm production message copy before a new-client launch.
