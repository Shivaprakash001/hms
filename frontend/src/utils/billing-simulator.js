/**
 * 🏦 Billing Simulation Engine
 *
 * Pure function — no side effects, no API calls.
 * Generates a timeline of billing events based on owner-configured rules.
 *
 * Supports:
 * - Multiple late fee rules (flat, per_day, percentage)
 * - Grace period before any late fee kicks in
 * - Max late fee cap across all accumulated fees
 * - What-if scenario testing
 */

/**
 * @typedef {Object} LateFeeRule
 * @property {string} id - Unique identifier
 * @property {'flat'|'per_day'|'percentage'} type - Rule type
 * @property {number} [amount] - Amount for flat/per_day
 * @property {number} [value] - Percentage value
 * @property {number} after_days - Days after due date (excluding grace)
 * @property {boolean} enabled - Whether this rule is active
 */

/**
 * @typedef {Object} BillingConfig
 * @property {number} auto_rent_day - Day of month rent is generated
 * @property {number} due_day - Day of month rent is due
 * @property {number} grace_days - Grace period after due date
 * @property {LateFeeRule[]} late_fee_rules - Array of late fee rules
 * @property {number} max_late_fee - Maximum total late fee cap
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {number} day - Day of the month
 * @property {string} label - Short label (e.g., "May 1")
 * @property {string} description - Description of the event
 * @property {number} fee_amount - Fee applied at this step (0 for non-fee events)
 * @property {number} running_total - Running total owed
 * @property {'generation'|'due'|'grace_end'|'late_fee'|'cap'} type - Event type
 * @property {string} color - Color key for UI rendering
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Convert legacy flat preference fields into a rules array.
 * This provides backward compatibility for owners who haven't
 * upgraded to the new rules format yet.
 */
export function migrateLegacyPrefs(prefs) {
  if (prefs.late_fee_rules && Array.isArray(prefs.late_fee_rules) && prefs.late_fee_rules.length > 0) {
    return {
      auto_rent_day: prefs.auto_rent_day || 1,
      due_day: prefs.due_day || 5,
      grace_days: prefs.grace_days ?? 0,
      late_fee_rules: prefs.late_fee_rules,
      max_late_fee: prefs.max_late_fee ?? 0,
    };
  }

  // Legacy: single rule from flat fields
  const rules = [];
  if (prefs.late_fee_type && prefs.late_fee_type !== 'none') {
    const rule = {
      id: 'legacy_1',
      type: prefs.late_fee_type,
      after_days: prefs.late_fee_after_days || 7,
      enabled: true,
    };
    if (prefs.late_fee_type === 'flat') {
      rule.amount = Number(prefs.late_fee_amount) || 200;
    } else if (prefs.late_fee_type === 'percentage') {
      rule.value = Number(prefs.late_fee_percentage) || 5;
    }
    rules.push(rule);
  }

  return {
    auto_rent_day: prefs.auto_rent_day || 1,
    due_day: prefs.due_day || 5,
    grace_days: prefs.grace_days ?? 0,
    late_fee_rules: rules,
    max_late_fee: prefs.max_late_fee ?? 0,
  };
}

/**
 * Generate a unique rule ID.
 */
export function generateRuleId() {
  return 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
}

/**
 * Create a default empty rule.
 */
export function createDefaultRule() {
  return {
    id: generateRuleId(),
    type: 'flat',
    amount: 200,
    after_days: 5,
    enabled: true,
  };
}

/**
 * Simulate the billing timeline for a given month.
 *
 * @param {BillingConfig} config - Billing rules configuration
 * @param {number} rentAmount - Monthly rent amount
 * @param {number} [simulateDays=30] - Number of days past due to simulate
 * @param {number} [monthIndex=4] - 0-indexed month (default May = 4)
 * @returns {TimelineEvent[]} - Ordered list of billing events
 */
export function simulateBilling(config, rentAmount, simulateDays = 30, monthIndex = 4) {
  const events = [];
  const monthName = MONTH_NAMES[monthIndex];
  let runningTotal = rentAmount;
  let totalLateFees = 0;
  const maxCap = Number(config.max_late_fee) || 0;
  const graceDays = Number(config.grace_days) || 0;

  // 1️⃣ Rent Generation
  events.push({
    day: config.auto_rent_day,
    label: `${monthName} ${config.auto_rent_day}`,
    description: 'Rent generated',
    fee_amount: 0,
    running_total: runningTotal,
    type: 'generation',
    color: 'slate',
  });

  // 2️⃣ Due Date
  events.push({
    day: config.due_day,
    label: `${monthName} ${config.due_day}`,
    description: 'Payment due',
    fee_amount: 0,
    running_total: runningTotal,
    type: 'due',
    color: 'indigo',
  });

  // 3️⃣ Grace Period End (if > 0)
  if (graceDays > 0) {
    const graceEndDay = config.due_day + graceDays;
    events.push({
      day: graceEndDay,
      label: `${monthName} ${graceEndDay}`,
      description: `Grace period ends (${graceDays} days)`,
      fee_amount: 0,
      running_total: runningTotal,
      type: 'grace_end',
      color: 'amber',
    });
  }

  // 4️⃣ Sort rules by after_days ascending for proper timeline
  const enabledRules = (config.late_fee_rules || [])
    .filter(r => r.enabled)
    .sort((a, b) => a.after_days - b.after_days);

  // Track per_day rules and simulate day-by-day
  const perDayRules = enabledRules.filter(r => r.type === 'per_day');
  const oneTimeRules = enabledRules.filter(r => r.type !== 'per_day');

  // Apply one-time rules (flat, percentage) at their trigger day
  for (const rule of oneTimeRules) {
    const triggerDay = config.due_day + graceDays + rule.after_days;
    if (triggerDay - config.due_day > simulateDays) continue;

    let feeAmount = 0;
    if (rule.type === 'flat') {
      feeAmount = Number(rule.amount) || 0;
    } else if (rule.type === 'percentage') {
      feeAmount = Math.round(rentAmount * (Number(rule.value) || 0) / 100);
    }

    // Apply cap
    if (maxCap > 0 && totalLateFees + feeAmount > maxCap) {
      feeAmount = Math.max(maxCap - totalLateFees, 0);
    }

    if (feeAmount > 0) {
      totalLateFees += feeAmount;
      runningTotal += feeAmount;

      const typeLabel = rule.type === 'flat' ? 'Flat fee' : `${rule.value}% of rent`;

      events.push({
        day: triggerDay,
        label: `${monthName} ${triggerDay}`,
        description: `${typeLabel} (+₹${feeAmount.toLocaleString('en-IN')})`,
        fee_amount: feeAmount,
        running_total: runningTotal,
        type: 'late_fee',
        color: 'amber',
      });
    }
  }

  // Simulate per_day rules — show the start + a few days + summary
  for (const rule of perDayRules) {
    const startDay = config.due_day + graceDays + rule.after_days;
    const dailyAmount = Number(rule.amount) || 0;
    if (dailyAmount <= 0 || startDay - config.due_day > simulateDays) continue;

    // Calculate how many days this rule runs within the simulation window
    const endSimDay = config.due_day + simulateDays;
    const daysActive = Math.max(endSimDay - startDay, 0);

    if (daysActive <= 0) continue;

    let totalDailyFee = dailyAmount * daysActive;

    // Apply cap
    if (maxCap > 0 && totalLateFees + totalDailyFee > maxCap) {
      totalDailyFee = Math.max(maxCap - totalLateFees, 0);
    }

    if (totalDailyFee > 0) {
      totalLateFees += totalDailyFee;
      runningTotal += totalDailyFee;

      events.push({
        day: startDay,
        label: `${monthName} ${startDay}+`,
        description: `₹${dailyAmount}/day × ${daysActive} days (+₹${totalDailyFee.toLocaleString('en-IN')})`,
        fee_amount: totalDailyFee,
        running_total: runningTotal,
        type: 'late_fee',
        color: 'orange',
      });
    }
  }

  // 5️⃣ Cap indicator
  if (maxCap > 0 && totalLateFees >= maxCap) {
    events.push({
      day: null,
      label: 'Cap',
      description: `Maximum late fee ₹${maxCap.toLocaleString('en-IN')}`,
      fee_amount: 0,
      running_total: rentAmount + maxCap,
      type: 'cap',
      color: 'rose',
    });
  }

  return events;
}

/**
 * What-If Calculator: Given a rent amount and days delayed,
 * compute the total payable and which rules triggered.
 *
 * @param {BillingConfig} config
 * @param {number} rentAmount
 * @param {number} daysDelayed - Days past the due date
 * @returns {{ totalPayable: number, breakdown: Array, totalLateFee: number }}
 */
export function calculateWhatIf(config, rentAmount, daysDelayed) {
  const graceDays = Number(config.grace_days) || 0;
  const maxCap = Number(config.max_late_fee) || 0;
  const effectiveDelay = Math.max(daysDelayed - graceDays, 0);

  const enabledRules = (config.late_fee_rules || [])
    .filter(r => r.enabled)
    .sort((a, b) => a.after_days - b.after_days);

  let totalLateFee = 0;
  const breakdown = [];

  for (const rule of enabledRules) {
    if (effectiveDelay < rule.after_days) continue;

    let feeAmount = 0;
    let desc = '';

    if (rule.type === 'flat') {
      feeAmount = Number(rule.amount) || 0;
      desc = `Flat fee: ₹${feeAmount.toLocaleString('en-IN')} (after ${rule.after_days} days)`;
    } else if (rule.type === 'percentage') {
      const pct = Number(rule.value) || 0;
      feeAmount = Math.round(rentAmount * pct / 100);
      desc = `${pct}% of ₹${rentAmount.toLocaleString('en-IN')}: ₹${feeAmount.toLocaleString('en-IN')} (after ${rule.after_days} days)`;
    } else if (rule.type === 'per_day') {
      const dailyAmount = Number(rule.amount) || 0;
      const activeDays = effectiveDelay - rule.after_days;
      feeAmount = dailyAmount * Math.max(activeDays, 0);
      desc = `₹${dailyAmount}/day × ${Math.max(activeDays, 0)} days: ₹${feeAmount.toLocaleString('en-IN')} (after ${rule.after_days} days)`;
    }

    // Apply cap
    if (maxCap > 0 && totalLateFee + feeAmount > maxCap) {
      feeAmount = Math.max(maxCap - totalLateFee, 0);
      desc += ' (capped)';
    }

    if (feeAmount > 0) {
      totalLateFee += feeAmount;
      breakdown.push({ rule, feeAmount, desc });
    }
  }

  return {
    totalPayable: rentAmount + totalLateFee,
    totalLateFee,
    breakdown,
    graceDaysApplied: graceDays,
    effectiveDelay,
    capApplied: maxCap > 0 && totalLateFee >= maxCap,
  };
}
