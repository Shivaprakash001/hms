import { prisma } from "../db";
import { eventSystem } from "../events";
import { EmailService } from "./email-service";
import { messageService } from "./message-service";
import { eventLog } from "./event-log-service";
import { resolveRules, calculateSingleRuleFee } from "../billing/engine";
import { resolvePreferences } from "../preferences";
import { batchGetHostelContexts, getTenantOperationalContext, resolveHostelIdFromObligation } from "../hostel-context";
import { formatMonthYear, formatDate } from "../format";
import { requireAutomation, consumeReminder } from "./plan-gate-service";
import { financialService } from "./financial-service";
import { selectReminderForOverdueDay } from "./collection-strategy-service";

export class ReminderService {

  /**
   * Process all pending rent obligations that are past their due date.
   * Send tiered automated reminders and generate late fees organically.
   */
  async processDailyReminders(targetDate?: Date) {
    const today = targetDate || new Date();
    // Neutralize to UTC Midnight for accurate day comparison checks
    const todayMid = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    // Canonical source: operational overdue obligations (ACTIVE tenants only).
    const overdueOperational = await financialService.getOperationalOverdueObligations(todayMid);
    const obligationIds = overdueOperational.map((o) => o.obligation_id);
    const lastReminders = obligationIds.length > 0
      ? await prisma.reminderLog.findMany({
          where: { obligation_id: { in: obligationIds } },
          orderBy: { sent_at: "desc" },
          distinct: ["obligation_id"],
        })
      : [];
    const remindersByObligation = new Map(lastReminders.map((r) => [r.obligation_id, r]));

    // Phase 1 Safety Fix: Build hostelId→context map from obligation allocation chains.
    // Previously used owner_id→hostel (findFirst), which was wrong for multi-hostel owners.
    // Now: each obligation's hostel is resolved from its allocation_id → room → hostel.
    const hostelIds = Array.from(
      new Set(overdueOperational.map((ob) => (ob as any).hostel_id).filter(Boolean))
    ) as string[];

    // For obligations missing hostel_id (pre-Phase-2 data), resolve via allocation chain
    const missingHostelObligations = overdueOperational.filter((ob) => !(ob as any).hostel_id);
    if (missingHostelObligations.length > 0) {
      const resolvedIds = await Promise.all(
        missingHostelObligations.map((ob) =>
          resolveHostelIdFromObligation(ob.obligation_id, ob.allocation_id, ob.tenant_id)
        )
      );
      resolvedIds.forEach((id) => { if (id) hostelIds.push(id); });
    }

    // Batch-load all needed hostel contexts in ONE query (replaces N×findFirst calls)
    const hostelContextMap = await batchGetHostelContexts(hostelIds);

    // Build obligation_id→hostelId lookup (for obligations with no hostel_id column yet)
    const allocationHostelCache = new Map<string, string>();

    let remindersSent = 0;
    let lateFeesAdded = 0;

    for (const ob of overdueOperational) {
      const ownerId = ob.owner_id;
      if (!ownerId) continue;

      // Resolve this obligation's hostel (explicit, not findFirst)
      let hostelId: string | null = (ob as any).hostel_id ?? null;
      if (!hostelId) {
        // Pre-Phase-2 data: resolve from allocation chain (cached per allocation)
        const cacheKey = ob.allocation_id ?? ob.tenant_id;
        if (!allocationHostelCache.has(cacheKey)) {
          const resolved = await resolveHostelIdFromObligation(ob.obligation_id, ob.allocation_id, ob.tenant_id);
          allocationHostelCache.set(cacheKey, resolved ?? "");
        }
        hostelId = allocationHostelCache.get(cacheKey) || null;
      }

      const hostelCtx = hostelId ? hostelContextMap.get(hostelId) : undefined;
      // Fallback: if hostel context is missing (inactive/deleted hostel), use empty defaults
      const config = hostelCtx ? hostelCtx.prefs : resolvePreferences(null);

      // 🔒 Plan Gate: Automation features require Starter+ plan
      // If owner is on FREE plan, skip ALL automation (reminders & late fees)
      try {
        await requireAutomation(ownerId);
      } catch {
        // Owner does not have automation — skip this obligation entirely
        continue;
      }

      // Automation Guards (preference-level — only checked if plan allows)
      const autoReminders = config.auto_send_reminders ?? true;
      const autoLateFees = config.auto_apply_late_fees ?? true;

      // Calculate age of the debt
      const dueTime = new Date(Date.UTC(ob.due_date.getFullYear(), ob.due_date.getMonth(), ob.due_date.getDate())).getTime();
      const diffTime = Math.abs(todayMid.getTime() - dueTime);
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Fetch the last reminder type sent for this obligation
      const lastReminderType = remindersByObligation.get(ob.obligation_id)?.reminder_type ?? null;
      const reminderTarget = {
        id: ob.obligation_id,
        hostel_id: hostelId || null,
        amount: ob.remaining_amount,
        rent_month: ob.rent_month,
        due_date: ob.due_date,
        tenant: {
          id: ob.tenant_id,
          owner_id: ob.owner_id,
          personal_email: ob.personal_email,
          profile: { name: ob.tenant_name },
        },
      };

      try {
        // 1️⃣ Automated Tiered Reminders
        if (autoReminders) {
          const reminderType = selectReminderForOverdueDay(daysOverdue, lastReminderType, config);
          if (reminderType) {
            await this.triggerNotification(reminderTarget, reminderType, config);
            remindersSent++;
          }
        }

        // 2️⃣ Organic Late Fee Generation (Shared Billing Engine)
        if (autoLateFees && ob.allocation_id) {
          const { rules, graceDays, maxCap } = resolveRules(config);
          const effectiveOverdue = Math.max(daysOverdue - graceDays, 0);

          if (rules.length > 0 && effectiveOverdue > 0) {
            // Fetch all existing late fees for this allocation + month to calculate accumulated total
            const existingLateFees = await prisma.rentObligation.findMany({
              where: {
                allocation_id: ob.allocation_id,
                rent_month: ob.rent_month,
                obligation_type: "LATE_FEE",
              },
              select: { amount: true, created_at: true },
            });
            let accumulatedFees = existingLateFees.reduce((sum: number, lf: any) => sum + Number(lf.amount), 0);

            // Cap already reached → skip all rules
            if (maxCap > 0 && accumulatedFees >= maxCap) continue;

            for (const rule of rules) {
              const afterDays = Number(rule.after_days) || 7;
              if (effectiveOverdue < afterDays) continue;

              if (rule.type === 'per_day') {
                // Per-day: create ONE obligation per day, idempotent via created_at date check
                const existingDailyFee = await prisma.rentObligation.findFirst({
                  where: {
                    allocation_id: ob.allocation_id,
                    rent_month: ob.rent_month,
                    obligation_type: "LATE_FEE",
                    created_at: {
                      gte: todayMid,
                      lt: new Date(todayMid.getTime() + 86400000),
                    },
                  },
                });

                if (!existingDailyFee) {
                  let feeAmount = calculateSingleRuleFee(rule as any, Number(ob.amount));

                  // Cap check
                  if (maxCap > 0 && accumulatedFees + feeAmount > maxCap) {
                    feeAmount = Math.max(maxCap - accumulatedFees, 0);
                  }

                  if (feeAmount > 0) {
                    try {
                      await prisma.rentObligation.create({
                        data: {
                          tenant_id: ob.tenant_id,
                          allocation_id: ob.allocation_id,
                          owner_id: ob.owner_id,
                          rent_month: ob.rent_month,
                          amount: feeAmount,
                          total_amount: feeAmount,
                          due_date: todayMid,
                          status: "PENDING",
                          obligation_type: "LATE_FEE",
                          hostel_id: hostelId || null, // Phase 2: immutable hostel context
                        },
                      });
                      accumulatedFees += feeAmount;
                      lateFeesAdded++;
                      await this.triggerNotification(reminderTarget, "LATE_FEE_ADDED", config);
                      remindersSent++;
                    } catch (feeErr: any) {
                      if (feeErr?.code === "P2002") {
                        // Idempotent skip — duplicate caught by unique index
                        console.info(`[REMINDER] Duplicate per_day late fee skipped for obligation ${ob.obligation_id}`);
                      } else {
                        throw feeErr;
                      }
                    }
                  }
                }
              } else {
                // One-time fees (flat, percentage): create once per rule per month
                // For single legacy rule: check any LATE_FEE exists
                // For multi-rule: count existing one-time fees vs expected
                const oneTimeRuleCount = rules.filter((r: any) => r.type !== 'per_day').length;
                const existingOneTimeFees = existingLateFees.length;

                const hasThisRuleFee = rules.length <= 1
                  ? existingOneTimeFees > 0
                  : existingOneTimeFees >= oneTimeRuleCount;

                if (!hasThisRuleFee) {
                  let feeAmount = calculateSingleRuleFee(rule as any, Number(ob.amount));

                  // Cap check
                  if (maxCap > 0 && accumulatedFees + feeAmount > maxCap) {
                    feeAmount = Math.max(maxCap - accumulatedFees, 0);
                  }

                  if (feeAmount > 0) {
                    try {
                      await prisma.rentObligation.create({
                        data: {
                          tenant_id: ob.tenant_id,
                          allocation_id: ob.allocation_id,
                          owner_id: ob.owner_id,
                          rent_month: ob.rent_month,
                          amount: feeAmount,
                          total_amount: feeAmount,
                          due_date: todayMid,
                          status: "PENDING",
                          obligation_type: "LATE_FEE",
                          hostel_id: hostelId || null, // Phase 2: immutable hostel context
                        },
                      });
                      accumulatedFees += feeAmount;
                      lateFeesAdded++;
                      await this.triggerNotification(reminderTarget, "LATE_FEE_ADDED", config);
                      remindersSent++;
                    } catch (feeErr: any) {
                      if (feeErr?.code === "P2002") {
                        // Idempotent skip — duplicate caught by unique index
                        console.info(`[REMINDER] Duplicate one-time late fee skipped for obligation ${ob.obligation_id}`);
                      } else {
                        throw feeErr;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err?.code === "NO_REMINDERS_LEFT") {
          // No credits left for this owner — stop processing all their obligations
          console.warn(`[REMINDER] Credits exhausted for owner ${ownerId}. Stopping obligation loop.`);
          break;
        }
        console.error(`[REMINDER] Error processing obligation ${ob.obligation_id}:`, err?.message);
      }
    }

    if (remindersSent > 0 || lateFeesAdded > 0) {
      // Trigger live updates to owners dashboard so they see realtime notifications and late fees collected incrementing
      const affectedOwners = Array.from(new Set(overdueOperational.map((ob) => ob.owner_id).filter(Boolean)));

      affectedOwners.forEach(ownerId => {
        if (ownerId) {
          eventSystem.trigger("dashboard_updated", { reason: "reminders_processed", ownerId });
        }
      });
    }

    const summary = {
      evaluated_obligations: overdueOperational.length,
      reminders_sent: remindersSent,
      late_fees_added: lateFeesAdded
    };

    // Write structured audit events
    if (remindersSent > 0) {
      await eventLog.log("REMINDER_SENT", null, {
        evaluated: overdueOperational.length,
        reminders_sent: remindersSent
      });
    }
    if (lateFeesAdded > 0) {
      await eventLog.log("LATE_FEE_APPLIED", null, {
        count: lateFeesAdded
      });
    }

    console.log(`[REMINDER] Processing Complete: ${JSON.stringify(summary)}`);
    return summary;
  }

  /**
   * Manual one-tap reminder triggered by owner from the dashboard.
   * Sends to the oldest unpaid obligation for the tenant.
   * Security: verifies tenant.owner_id === ownerId before sending.
   */
  async sendManualReminder(tenantId: string, ownerId: string): Promise<{ sent: number; tenant_name: string }> {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, owner_id: ownerId, status: "ACTIVE" },
      select: { id: true, personal_email: true, owner_id: true, hostel_id: true, profile: { select: { name: true, phone: true } } },
    });
    if (!tenant) {
      const err: any = new Error("Tenant not found or access denied");
      err.httpStatus = 404;
      throw err;
    }

    const obligation = await prisma.rentObligation.findFirst({
      where: {
        tenant_id: tenantId,
        owner_id: ownerId,
        status: { notIn: ["PAID", "WAIVED"] },
        due_date: { lt: new Date() },
      },
      orderBy: { due_date: "asc" },
    });

    if (!obligation) return { sent: 0, tenant_name: tenant.profile?.name ?? "Tenant" };

    const context = await getTenantOperationalContext(tenantId, ownerId, tenant.hostel_id);
    const config = context.prefs;

    await this.triggerNotification({ ...obligation, hostel_id: context.hostel.id, tenant }, "WARNING", config);

    eventSystem.trigger("dashboard_updated", { reason: "manual_reminder_sent", ownerId });

    return { sent: 1, tenant_name: tenant.profile?.name ?? "Tenant" };
  }

  private async triggerNotification(obligation: any, type: string, config: any) {
    const tenant = obligation.tenant;
    const ownerId = tenant.owner_id;

    if (ownerId) {
      // 🔒 Deduct one reminder credit (addon-based). Skip notification if exhausted.
      try {
        await consumeReminder(ownerId);
      } catch (creditErr: any) {
        if (creditErr?.code === "NO_REMINDERS_LEFT") {
          console.warn(`[NOTIFY] Skipped reminder for ${tenant.id}. No reminder credits remaining.`);
          return;
        }
        throw creditErr;
      }
    }

    const canEmail = config.reminder_email ?? true;
    const canInApp = config.reminder_in_app ?? true;

    // 1️⃣ In-App Notification (Always log an audit entry at minimum)
    if (canInApp) {
      await prisma.reminderLog.create({
        data: {
          obligation_id: obligation.id,
          tenant_id: obligation.tenant.id,
          reminder_type: type,
          channel: "IN_APP",
          hostel_id: obligation.hostel_id || null, // Phase 2: immutable hostel context
        }
      });
    }

    // 2️⃣ Email Notification
    if (canEmail && tenant.personal_email) {
      try {
        const mailData = {
          toEmail: tenant.personal_email,
          name: tenant.profile?.name || "Tenant",
          amount: Number(obligation.amount),
          rentMonth: formatMonthYear(obligation.rent_month, config),
          dueDate: formatDate(obligation.due_date, config),
          type: type as any,
          prefs: config,
        };

        await EmailService.sendReminderBatch(mailData);
      } catch (err) {
        console.error(`[NOTIFY] Email failed for ${tenant.id}:`, err);
      }
    }

    // 3️⃣ WhatsApp/SMS Notification (if enabled) — deduct quota
    if ((config.reminder_whatsapp ?? false) && tenant.profile?.phone) {
      try {
        await messageService.sendMessage(tenant.owner_id, "WHATSAPP", tenant.profile.phone, type, `Reminder: ${type} for ${formatMonthYear(obligation.rent_month, config)}`);
      } catch (err: any) {
        // If message quota exhausted, log and trigger owner notification elsewhere
        console.warn(`[NOTIFY] WhatsApp/SMS send failed for ${tenant.id}:`, err?.message || err);
      }
    }

    console.log(`[NOTIFY] [${type}] to ${obligation.tenant.profile?.name} (tenant_id: ${obligation.tenant.id}) triggered`);
  }
}

export const reminderService = new ReminderService();
