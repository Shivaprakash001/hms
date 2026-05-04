import { prisma } from "../db";
import { eventSystem } from "../events";
import { EmailService } from "./email-service";
import { messageService } from "./message-service";
import { eventLog } from "./event-log-service";
import { resolveRules, calculateSingleRuleFee } from "../billing/engine";
import { resolvePreferences } from "../preferences";
import { formatMonthYear, formatDate } from "../format";
import { requireAutomation, consumeReminder } from "./plan-gate-service";

export class ReminderService {

  /**
   * Process all pending rent obligations that are past their due date.
   * Send tiered automated reminders and generate late fees organically.
   */
  async processDailyReminders(targetDate?: Date) {
    const today = targetDate || new Date();
    // Neutralize to UTC Midnight for accurate day comparison checks
    const todayMid = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    // 🔒 CRITICAL: Only fetch RENT obligations — late fees NEVER generate late fees.
    // This is the guard that prevents compounding debt spirals.
    const overdueObligations = await prisma.rentObligation.findMany({
      where: {
        status: "PENDING",
        obligation_type: "RENT",
        due_date: { lt: todayMid }
      },
      include: {
        tenant: {
          select: { id: true, personal_email: true, owner_id: true, profile: { select: { name: true } } }
        },
        reminders: {
          orderBy: { sent_at: 'desc' },
          take: 1
        }
      }
    });

    // Optimization: Batch fetch owner preferences
    const ownerIds = Array.from(new Set(overdueObligations.map(ob => ob.tenant.owner_id).filter(Boolean))) as string[];
    const hostelPrefs: any[] = await prisma.hostel.findMany({
      where: { owner_id: { in: ownerIds }, is_active: true },
    });
    const prefsMap = new Map(hostelPrefs.map((p: any) => [p.owner_id, p]));

    let remindersSent = 0;
    let lateFeesAdded = 0;

    for (const ob of overdueObligations) {
      const ownerId = ob.tenant.owner_id;
      if (!ownerId) continue;

      const prefs: any = prefsMap.get(ownerId);
      const config = resolvePreferences(prefs);

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
      const lastReminderType = ob.reminders.length > 0 ? ob.reminders[0].reminder_type : null;

      try {
        // 1️⃣ Automated Tiered Reminders
        if (autoReminders) {
          const sendGentle = config.reminder_day_1 ?? true;
          const sendWarning = config.reminder_day_5 ?? true;
          const sendFinal = config.reminder_day_10 ?? true;

          if (daysOverdue === 1 && sendGentle && lastReminderType !== "DUE_SOON") {
            await this.triggerNotification(ob, "DUE_SOON", config);
            remindersSent++;
          } else if (daysOverdue === 5 && sendWarning && lastReminderType !== "WARNING") {
            await this.triggerNotification(ob, "WARNING", config);
            remindersSent++;
          } else if (daysOverdue === 10 && sendFinal && lastReminderType !== "FINAL_NOTICE") {
            await this.triggerNotification(ob, "FINAL_NOTICE", config);
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
                          tenant_id: ob.tenant.id,
                          allocation_id: ob.allocation_id,
                          owner_id: ob.owner_id,
                          rent_month: ob.rent_month,
                          amount: feeAmount,
                          total_amount: feeAmount,
                          due_date: todayMid,
                          status: "PENDING",
                          obligation_type: "LATE_FEE",
                        },
                      });
                      accumulatedFees += feeAmount;
                      lateFeesAdded++;
                      await this.triggerNotification(ob, "LATE_FEE_ADDED", config);
                      remindersSent++;
                    } catch (feeErr: any) {
                      if (feeErr?.code === "P2002") {
                        // Idempotent skip — duplicate caught by unique index
                        console.info(`[REMINDER] Duplicate per_day late fee skipped for obligation ${ob.id}`);
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
                          tenant_id: ob.tenant.id,
                          allocation_id: ob.allocation_id,
                          owner_id: ob.owner_id,
                          rent_month: ob.rent_month,
                          amount: feeAmount,
                          total_amount: feeAmount,
                          due_date: todayMid,
                          status: "PENDING",
                          obligation_type: "LATE_FEE",
                        },
                      });
                      accumulatedFees += feeAmount;
                      lateFeesAdded++;
                      await this.triggerNotification(ob, "LATE_FEE_ADDED", config);
                      remindersSent++;
                    } catch (feeErr: any) {
                      if (feeErr?.code === "P2002") {
                        // Idempotent skip — duplicate caught by unique index
                        console.info(`[REMINDER] Duplicate one-time late fee skipped for obligation ${ob.id}`);
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
        console.error(`[REMINDER] Error processing obligation ${ob.id}:`, err?.message);
      }
    }

    if (remindersSent > 0 || lateFeesAdded > 0) {
      // Trigger live updates to owners dashboard so they see realtime notifications and late fees collected incrementing
      const affectedOwners = Array.from(new Set(overdueObligations.map(ob => ob.tenant.owner_id).filter(Boolean)));

      affectedOwners.forEach(ownerId => {
        if (ownerId) {
          eventSystem.trigger("dashboard_updated", { reason: "reminders_processed", ownerId });
        }
      });
    }

    const summary = {
      evaluated_obligations: overdueObligations.length,
      reminders_sent: remindersSent,
      late_fees_added: lateFeesAdded
    };

    // Write structured audit events
    if (remindersSent > 0) {
      await eventLog.log("REMINDER_SENT", null, {
        evaluated: overdueObligations.length,
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
          channel: "IN_APP"
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
