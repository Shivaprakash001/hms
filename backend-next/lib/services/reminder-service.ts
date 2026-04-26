import { prisma } from "../db";
import { eventSystem } from "../events";

const LATE_FEE_AMOUNT = 200; // Customizable later per owner/hostel

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
        student: {
          select: { id: true, personal_email: true, owner_id: true, profile: { select: { name: true } } }
        },
        reminders: {
          orderBy: { sent_at: 'desc' },
          take: 1
        }
      }
    });

    let remindersSent = 0;
    let lateFeesAdded = 0;

    for (const ob of overdueObligations) {
      // Calculate age of the debt
      const dueTime = new Date(Date.UTC(ob.due_date.getFullYear(), ob.due_date.getMonth(), ob.due_date.getDate())).getTime();
      const diffTime = Math.abs(todayMid.getTime() - dueTime);
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Fetch the last reminder type sent for this obligation
      const lastReminderType = ob.reminders.length > 0 ? ob.reminders[0].reminder_type : null;

      try {
        if (daysOverdue === 1 && lastReminderType !== "DUE_SOON") {
          await this.triggerNotification(ob, "DUE_SOON");
          remindersSent++;
        } else if (daysOverdue === 5 && lastReminderType !== "WARNING") {
          await this.triggerNotification(ob, "WARNING");
          remindersSent++;
        } else if (daysOverdue === 10 && lastReminderType !== "FINAL_NOTICE") {
          await this.triggerNotification(ob, "FINAL_NOTICE");
          remindersSent++;
        } else if (daysOverdue >= 7) {
          // Late Fee Engine: Check if a Late Fee already exists for this allocation + month
          if (ob.allocation_id) {
            const existingLateFee = await prisma.rentObligation.findUnique({
              where: {
                allocation_id_rent_month_obligation_type: {
                  allocation_id: ob.allocation_id,
                  rent_month: ob.rent_month,
                  obligation_type: "LATE_FEE"
                }
              }
            });

            if (!existingLateFee) {
              await prisma.rentObligation.create({
                data: {
                  student_id: ob.student.id,
                  allocation_id: ob.allocation_id,
                  owner_id: ob.owner_id,
                  rent_month: ob.rent_month,
                  amount: LATE_FEE_AMOUNT,
                  due_date: todayMid,
                  status: "PENDING",
                  obligation_type: "LATE_FEE"
                }
              });
              lateFeesAdded++;
              // Send a synchronous alert that a late fee was added
              await this.triggerNotification(ob, "LATE_FEE_ADDED");
              remindersSent++;
            }
          }
        }
      } catch (err: any) {
        console.error(`[REMINDER] Error processing obligation ${ob.id}:`, err?.message);
      }
    }

    if (remindersSent > 0 || lateFeesAdded > 0) {
      // Trigger live updates to owners dashboard so they see realtime notifications and late fees collected incrementing
      const affectedOwners = Array.from(new Set(overdueObligations.map(ob => ob.student.owner_id).filter(Boolean)));
      
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

    console.log(`[REMINDER] Processing Complete: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async triggerNotification(obligation: any, type: string) {
    const channel = "IN_APP";
    // Write Reminder Audit Log entry
    await prisma.reminderLog.create({
      data: {
        obligation_id: obligation.id,
        student_id: obligation.student_id,
        reminder_type: type,
        channel: channel
      }
    });

    // In future iterations: integrate AWS SES / Resend for Email, Twilio for SMS here
    console.log(`[NOTIFY] [${type}] to ${obligation.student.profile?.name} (student_id: ${obligation.student.id}) via ${channel}`);
  }
}

export const reminderService = new ReminderService();
