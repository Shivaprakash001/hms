import { prisma } from "../db";
import { eventSystem } from "../events";
import { EmailService } from "./email-service";
import { eventLog } from "./event-log-service";

export class ReminderService {

  /**
   * Process all pending rent obligations that are past their due date.
   * Send tiered automated reminders and generate late fees organically.
   */
  async processDailyReminders(targetDate?: Date) {
    const today = targetDate || new Date();
    // Neutralize to UTC Midnight for accurate day comparison checks
    const todayMid = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    // Only fetch RENT obligations (LATE_FEEs themselves don't accumulate recursive late fees for now)
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
      const config = (prefs?.preferences_config as any) || {};

      // Automation Guards
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

        // 2️⃣ Organic Late Fee Generation (Rules Engine)
        if (autoLateFees && ob.allocation_id) {
          const graceDays = Number(config.grace_days) || 0;
          const effectiveOverdue = Math.max(daysOverdue - graceDays, 0);

          // Resolve rules: prefer new `late_fee_rules[]`, fallback to legacy flat fields
          let rules: any[] = [];
          if (Array.isArray(config.late_fee_rules) && config.late_fee_rules.length > 0) {
            rules = config.late_fee_rules.filter((r: any) => r.enabled !== false);
          } else if (config.late_fee_type && config.late_fee_type !== 'none') {
            // Legacy single-rule backward compat
            rules = [{
              id: 'legacy',
              type: config.late_fee_type,
              amount: Number(config.late_fee_amount) || 200,
              value: Number(config.late_fee_percentage) || 5,
              after_days: Number(config.late_fee_after_days) || 7,
              enabled: true,
            }];
          }

          if (rules.length > 0 && effectiveOverdue > 0) {
            const maxCap = Number(config.max_late_fee) || 0;

            // Fetch all existing late fees for this allocation + month to calculate accumulated total
            const existingLateFees = await prisma.rentObligation.findMany({
              where: {
                allocation_id: ob.allocation_id,
                rent_month: ob.rent_month,
                obligation_type: "LATE_FEE",
              },
              select: { amount: true },
            });
            const accumulatedFees = existingLateFees.reduce((sum: number, lf: any) => sum + Number(lf.amount), 0);

            for (const rule of rules) {
              const afterDays = Number(rule.after_days) || 7;

              if (effectiveOverdue < afterDays) continue;

              // Build idempotency key: use rule.id to avoid duplicate fees per rule per month
              const feeKey = `${ob.allocation_id}_${ob.rent_month.toISOString()}_${rule.id || rule.type}`;

              if (rule.type === 'per_day') {
                // Per-day fees: create ONE obligation per day, check if today's already exists
                const todayFeeKey = `${feeKey}_day_${daysOverdue}`;
                const existingDailyFee = await prisma.rentObligation.findFirst({
                  where: {
                    allocation_id: ob.allocation_id,
                    rent_month: ob.rent_month,
                    obligation_type: "LATE_FEE",
                    // Use created_at date range for today's entry
                    created_at: {
                      gte: todayMid,
                      lt: new Date(todayMid.getTime() + 86400000),
                    },
                  },
                });

                if (!existingDailyFee) {
                  let feeAmount = Number(rule.amount) || 0;
                  // Cap check
                  if (maxCap > 0 && accumulatedFees + feeAmount > maxCap) {
                    feeAmount = Math.max(maxCap - accumulatedFees, 0);
                  }

                  if (feeAmount > 0) {
                    await prisma.rentObligation.create({
                      data: {
                        tenant_id: ob.tenant.id,
                        allocation_id: ob.allocation_id,
                        owner_id: ob.owner_id,
                        rent_month: ob.rent_month,
                        amount: feeAmount,
                        due_date: todayMid,
                        status: "PENDING",
                        obligation_type: "LATE_FEE",
                      },
                    });
                    lateFeesAdded++;
                    await this.triggerNotification(ob, "LATE_FEE_ADDED", config);
                    remindersSent++;
                  }
                }
              } else {
                // One-time fees (flat, percentage): create once per rule per month
                const existingRuleFee = await prisma.rentObligation.findFirst({
                  where: {
                    allocation_id: ob.allocation_id,
                    rent_month: ob.rent_month,
                    obligation_type: "LATE_FEE",
                  },
                });

                // For backward compat: if legacy (single rule), check simple existence
                // For new rules: we allow multiple LATE_FEE obligations (one per rule)
                const hasThisRuleFee = rules.length <= 1
                  ? !!existingRuleFee
                  : existingLateFees.length >= rules.filter((r: any) => r.type !== 'per_day').length;

                if (!hasThisRuleFee) {
                  let feeAmount = 0;
                  if (rule.type === 'flat') {
                    feeAmount = Number(rule.amount) || 200;
                  } else if (rule.type === 'percentage') {
                    const pct = Number(rule.value) || 5;
                    feeAmount = Math.round(Number(ob.amount) * (pct / 100));
                  }

                  // Cap check
                  if (maxCap > 0 && accumulatedFees + feeAmount > maxCap) {
                    feeAmount = Math.max(maxCap - accumulatedFees, 0);
                  }

                  if (feeAmount > 0) {
                    await prisma.rentObligation.create({
                      data: {
                        tenant_id: ob.tenant.id,
                        allocation_id: ob.allocation_id,
                        owner_id: ob.owner_id,
                        rent_month: ob.rent_month,
                        amount: feeAmount,
                        due_date: todayMid,
                        status: "PENDING",
                        obligation_type: "LATE_FEE",
                      },
                    });
                    lateFeesAdded++;
                    await this.triggerNotification(ob, "LATE_FEE_ADDED", config);
                    remindersSent++;
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
          rentMonth: new Date(obligation.rent_month).toLocaleString('default', { month: 'long', year: 'numeric' }),
          dueDate: new Date(obligation.due_date).toLocaleDateString(),
          type: type as any
        };
        
        await EmailService.sendReminderBatch(mailData);
      } catch (err) {
        console.error(`[NOTIFY] Email failed for ${tenant.id}:`, err);
      }
    }

    console.log(`[NOTIFY] [${type}] to ${obligation.tenant.profile?.name} (tenant_id: ${obligation.tenant.id}) triggered`);
  }
}

export const reminderService = new ReminderService();
