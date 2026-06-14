import { renewalDecisionService } from "./renewal-decision-service";

export type RenewalStage =
  | "30_DAY_REMINDER"
  | "15_DAY_REMINDER"
  | "EXPIRY_DAY_ALERT"
  | "7_DAY_OVERDUE"
  | "30_DAY_CRITICAL"
  | "EXPIRED_RENT_OVERDUE";

export class RenewalStatusService {
  determineRenewalStage(agreement: any, now: Date = new Date()): RenewalStage | null {
    if (!agreement?.agreement_end_date) {
      return null;
    }

    const decision = renewalDecisionService.evaluateAgreement(agreement, now);
    const daysUntilExpiry = decision.days_until_expiry; // number or null
    const daysOverdue = decision.days_overdue; // number
    const states = decision.states || [];

    // 1. Critical overdue (grace period limit)
    if (
      (states.includes("RENEWAL_OVERDUE_CRITICAL") || states.includes("RENEWAL_DECISION_PENDING")) &&
      daysOverdue === decision.grace_period_days
    ) {
      return "30_DAY_CRITICAL";
    }

    // 2. 7 days overdue
    if (
      (states.includes("RENEWAL_OVERDUE_CRITICAL") || states.includes("RENEWAL_DECISION_PENDING")) &&
      daysOverdue === 7
    ) {
      return "7_DAY_OVERDUE";
    }

    // 3. Expiry day (0 days left)
    if (daysUntilExpiry === 0) {
      return "EXPIRY_DAY_ALERT";
    }

    // 4. 15 days left
    if (daysUntilExpiry === 15) {
      return "15_DAY_REMINDER";
    }

    // 5. 30 days left
    if (daysUntilExpiry === 30) {
      return "30_DAY_REMINDER";
    }

    // 6. Expired and rent overdue (lowest priority)
    if (states.includes("EXPIRED_AND_RENT_OVERDUE")) {
      return "EXPIRED_RENT_OVERDUE";
    }

    return null;
  }
}

export const renewalStatusService = new RenewalStatusService();
