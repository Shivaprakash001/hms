import { prisma } from "../db";
import { activationService } from "./activation-service";
import { eventLog } from "./event-log-service";

/**
 * AbandonmentService
 *
 * Detects owners who have stalled in the onboarding funnel and
 * generates in-app nudges + notification entries to recover them.
 *
 * Design rules:
 * - Never spam. Each nudge type fires at most once per TTL window.
 * - Prioritize revenue blockers over cosmetic ones.
 * - All nudges are informational — never coercive.
 */

// ─── Abandonment Rules ────────────────────────────────────────────────────────
// Each rule defines:
//   condition:    string   — operational_state that triggers this rule
//   stale_hours:  number   — how long since last_seen to trigger
//   nudge_type:   string   — unique key (prevents duplicate nudges)
//   title/msg:    string   — notification content
//   path:         string   — deep link into the product

interface AbandonmentRule {
  condition:    string;    // operational_state
  stale_hours:  number;   // hours since last_seen_at without progress
  nudge_type:   string;
  title:        string;
  message:      string;
  path:         string;
}

const ABANDONMENT_RULES: AbandonmentRule[] = [
  {
    condition:   "NEW",
    stale_hours: 24,
    nudge_type:  "NUDGE_SETUP_HOSTEL",
    title:       "Your hostel setup is waiting 🏠",
    message:     "You're 5 minutes away from automated rent collection. Add your hostel details to get started.",
    path:        "/onboarding/hostel",
  },
  {
    condition:   "HOSTEL_READY",
    stale_hours: 48,
    nudge_type:  "NUDGE_ADD_ROOMS",
    title:       "Add your first room to unlock rent tracking 🚪",
    message:     "Your hostel is configured. Add rooms so you can assign tenants and generate rent automatically.",
    path:        "/onboarding/rooms",
  },
  {
    condition:   "ROOM_READY",
    stale_hours: 48,
    nudge_type:  "NUDGE_ADD_TENANT",
    title:       "Your rooms are ready — add tenants to start 👤",
    message:     "Rooms are set up but no tenants yet. Add your first tenant and rent tracking begins automatically.",
    path:        "/onboarding/tenant",
  },
  {
    condition:   "TENANT_READY",
    stale_hours: 72,
    nudge_type:  "NUDGE_GENERATE_RENT",
    title:       "Your first rent cycle is ready to generate 📋",
    message:     "You have active tenants. Trigger rent generation now or let automation handle it on your configured day.",
    path:        "/owner/payments",
  },
  {
    condition:   "RENT_ACTIVE",
    stale_hours: 96,
    nudge_type:  "NUDGE_SETUP_COLLECTIONS",
    title:       "Enable online payments to collect faster 💳",
    message:     "Rent is generated. Add your UPI ID so tenants can pay online — no more cash follow-ups.",
    path:        "/onboarding/payments",
  },
];

// ─── Nudge deduplication TTL: do not re-send same nudge within 7 days ─────────
const NUDGE_TTL_HOURS = 7 * 24;

export class AbandonmentService {

  /**
   * Main cron entry point. Scans all non-completed owners,
   * evaluates rules, and writes in-app nudge notifications.
   */
  async processAbandonmentNudges(): Promise<{
    scanned:  number;
    nudged:   number;
    skipped:  number;
  }> {
    // Fetch owners who have NOT completed onboarding
    const staleOwners = await (prisma as any).ownerOnboardingState.findMany({
      where: {
        onboarding_completed_at: null,
        onboarding_step:         { not: "COMPLETED" },
      },
      select: {
        owner_id:                true,
        onboarding_last_seen_at: true,
        activation_score:        true,
      },
    });

    let nudged  = 0;
    let skipped = 0;
    const nowMs = Date.now();

    for (const ownerRow of staleOwners) {
      try {
        const lastSeenMs = new Date(ownerRow.onboarding_last_seen_at).getTime();
        const hoursSinceSeen = (nowMs - lastSeenMs) / (1000 * 3600);

        // Derive real state (not cached step) to pick correct rule
        const activation = await activationService.deriveOperationalActivation(ownerRow.owner_id);

        const rule = ABANDONMENT_RULES.find(r =>
          r.condition === activation.operational_state &&
          hoursSinceSeen >= r.stale_hours
        );

        if (!rule) { skipped++; continue; }

        // Deduplication: check if this nudge was already sent within TTL
        const recentNudge = await prisma.notifications.findFirst({
          where: {
            profile_id: ownerRow.owner_id,
            type:       rule.nudge_type,
            created_at: { gte: new Date(nowMs - NUDGE_TTL_HOURS * 3600 * 1000) },
          },
          select: { id: true },
        });

        if (recentNudge) { skipped++; continue; }

        // Write in-app notification
        await prisma.notifications.create({
          data: {
            profile_id: ownerRow.owner_id,
            title:      rule.title,
            message:    rule.message,
            type:       rule.nudge_type,
            is_read:    false,
          },
        });

        // Write audit event
        await eventLog.log("ONBOARDING_NUDGE_SENT", ownerRow.owner_id, {
          nudge_type:   rule.nudge_type,
          state:        activation.operational_state,
          score:        activation.activation_score,
          hours_stale:  Math.round(hoursSinceSeen),
        });

        nudged++;
      } catch (err) {
        // Never let one owner failure abort the entire batch
        console.error(`[ABANDONMENT] Error processing owner ${ownerRow.owner_id}:`, err);
        skipped++;
      }
    }

    console.log(`[ABANDONMENT] Scanned=${staleOwners.length} Nudged=${nudged} Skipped=${skipped}`);
    return { scanned: staleOwners.length, nudged, skipped };
  }

  /**
   * Generate a first-success celebration notification.
   * Called from key lifecycle hooks (rent generated, payment recorded, etc.)
   */
  async sendFirstSuccessNotification(
    ownerId:     string,
    successType: "FIRST_TENANT" | "FIRST_RENT" | "FIRST_PAYMENT" | "FIRST_REMINDER"
  ): Promise<void> {
    const MILESTONES: Record<string, { title: string; message: string; type: string }> = {
      FIRST_TENANT: {
        type:    "FIRST_TENANT_MILESTONE",
        title:   "🎉 First tenant added!",
        message: "Your hostel is live. Rent will generate automatically from now on.",
      },
      FIRST_RENT: {
        type:    "FIRST_RENT_MILESTONE",
        title:   "🎉 First rent cycle generated!",
        message: "Your first rent cycle was generated automatically. This will now happen every month.",
      },
      FIRST_PAYMENT: {
        type:    "FIRST_PAYMENT_MILESTONE",
        title:   "🎉 First payment collected!",
        message: "Congratulations on your first collection. The system will handle reminders automatically.",
      },
      FIRST_REMINDER: {
        type:    "FIRST_REMINDER_MILESTONE",
        title:   "🔔 First reminder sent!",
        message: "Reminders have been sent. Owners who use reminders collect 40% faster.",
      },
    };

    const milestone = MILESTONES[successType];
    if (!milestone) return;

    // Idempotent: only send once per milestone type per owner
    const already = await prisma.notifications.findFirst({
      where: { profile_id: ownerId, type: milestone.type },
      select: { id: true },
    });
    if (already) return;

    await prisma.notifications.create({
      data: {
        profile_id: ownerId,
        title:      milestone.title,
        message:    milestone.message,
        type:       milestone.type,
        is_read:    false,
      },
    });

    // Refresh score cache in background (don't await — non-blocking)
    activationService.refreshActivationScore(ownerId).catch(() => {});

    await eventLog.log("FIRST_SUCCESS_MILESTONE", ownerId, {
      milestone: successType,
    });
  }
}

export const abandonmentService = new AbandonmentService();
