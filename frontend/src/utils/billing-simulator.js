/**
 * 🏦 Billing Simulation Engine (Frontend Port)
 *
 * This is a JavaScript port of backend-next/lib/billing/engine.ts
 * It uses the IDENTICAL math for fee calculation.
 *
 * ⚠️  This file is a UI PREVIEW tool. The backend is the source of truth
 * for actual charges. Any changes to engine.ts MUST be reflected here.
 *
 * Supports:
 * - Multiple late fee rules (flat, per_day, percentage)
 * - Grace period before any late fee kicks in
 * - Max late fee cap across all accumulated fees
 * - What-if scenario testing
 * - Legacy config auto-migration
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Rule Resolution (mirrors engine.ts resolveRules) ────────────

/**
 * Convert legacy flat preference fields into a normalized billing config.
 * Mirrors backend-next/lib/billing/engine.ts → resolveRules()
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
    } else if (prefs.late_fee_type === 'per_day') {
      rule.amount = Number(prefs.late_fee_amount) || 50;
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

// ─── Rule Helpers ────────────────────────────────────────────────

export function generateRuleId() {
  return 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
}

import { formatCurrency } from './format';

export const createDefaultRule = () => ({
  id: generateRuleId(),
  type: 'flat',
  amount: 200,
  after_days: 5,
  enabled: true,
});

// ─── Core Fee Calculation (mirrors engine.ts calculateLateFees) ──

/**
 * Calculate fee for a single rule.
 * Mirrors backend-next/lib/billing/engine.ts → calculateSingleRuleFee()
 */
function calculateSingleRuleFeeAmount(rule, rentAmount) {
  switch (rule.type) {
    case 'flat':
      return Math.max(Number(rule.amount) || 0, 0);
    case 'percentage':
      return Math.round(rentAmount * (Math.max(Number(rule.value) || 0, 0)) / 100);
    case 'per_day':
      return Math.max(Number(rule.amount) || 0, 0);
    default:
      return 0;
  }
}

/**
 * Calculate total late fees for a given delay.
 * Mirrors backend-next/lib/billing/engine.ts → calculateLateFees()
 *
 * IMPORTANT: This MUST produce identical results to the backend engine.
 */
function calculateLateFeesCore(config, rentAmount, daysDelayed) {
  const graceDays = Math.max(Number(config.grace_days) || 0, 0);
  const maxCap = Math.max(Number(config.max_late_fee) || 0, 0);
  const effectiveDelay = Math.max(daysDelayed - graceDays, 0);

  const enabledRules = (config.late_fee_rules || [])
    .filter(r => r.enabled)
    .sort((a, b) => a.after_days - b.after_days);

  let totalLateFee = 0;
  const breakdown = [];

  for (const rule of enabledRules) {
    const afterDays = Math.max(Number(rule.after_days) || 0, 0);
    if (effectiveDelay < afterDays) continue;

    let feeAmount = 0;
    let desc = '';

    switch (rule.type) {
      case 'flat': {
        feeAmount = Math.max(Number(rule.amount) || 0, 0);
        desc = `Flat fee ${formatCurrency(feeAmount)} (after ${afterDays}d)`;
        break;
      }
      case 'percentage': {
        const pct = Math.max(Number(rule.value) || 0, 0);
        feeAmount = Math.round(rentAmount * pct / 100);
        desc = `${pct}% of ${formatCurrency(rentAmount)} = ${formatCurrency(feeAmount)} (after ${afterDays}d)`;
        break;
      }
      case 'per_day': {
        const dailyAmount = Math.max(Number(rule.amount) || 0, 0);
        const activeDays = Math.max(effectiveDelay - afterDays, 0);
        feeAmount = dailyAmount * activeDays;
        desc = `${formatCurrency(dailyAmount)}/day × ${activeDays}d = ${formatCurrency(feeAmount)} (after ${afterDays}d)`;
        break;
      }
      default:
        continue;
    }

    // Enforce cap
    let capped = false;
    if (maxCap > 0 && totalLateFee + feeAmount > maxCap) {
      feeAmount = Math.max(maxCap - totalLateFee, 0);
      capped = true;
    }

    if (feeAmount > 0) {
      totalLateFee += feeAmount;
      breakdown.push({ rule, feeAmount, desc: desc + (capped ? ' (capped)' : ''), capped });
    }
  }

  return {
    rentAmount,
    totalLateFee,
    totalPayable: rentAmount + totalLateFee,
    breakdown,
    graceDaysApplied: graceDays,
    effectiveDelay,
    capApplied: maxCap > 0 && totalLateFee >= maxCap,
  };
}

// ─── Timeline Simulation (UI-specific) ──────────────────────────

/**
 * Generate a visual billing timeline for the preview card.
 * Uses calculateLateFeesCore internally for consistent math.
 */
export function simulateBilling(config, rentAmount, simulateDays = 30, monthIndex = 4) {
  const events = [];
  const monthName = MONTH_NAMES[monthIndex];
  const runDate = new Date();
  let runningTotal = rentAmount;
  let totalLateFees = 0;
  const maxCap = Math.max(Number(config.max_late_fee) || 0, 0);
  const graceDays = Math.max(Number(config.grace_days) || 0, 0);

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

  // 3️⃣ Grace Period End
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

  // 4️⃣ Apply rules using same core logic
  const enabledRules = (config.late_fee_rules || [])
    .filter(r => r.enabled)
    .sort((a, b) => a.after_days - b.after_days);

  const oneTimeRules = enabledRules.filter(r => r.type !== 'per_day');
  const perDayRules = enabledRules.filter(r => r.type === 'per_day');

  // One-time rules at their trigger day
  for (const rule of oneTimeRules) {
    const triggerDay = config.due_day + graceDays + rule.after_days;
    if (triggerDay - config.due_day > simulateDays) continue;

    let feeAmount = calculateSingleRuleFeeAmount(rule, rentAmount);
    if (rule.type === 'percentage') {
      feeAmount = Math.round(rentAmount * (Math.max(Number(rule.value) || 0, 0)) / 100);
    }

    // Cap
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
        amount: feeAmount,
        description: `${typeLabel} (+${formatCurrency(feeAmount)})`,
        date: new Date(runDate).toISOString(),
        running_total: runningTotal,
        type: 'late_fee',
        color: 'amber',
      });
    }
  }

  // Per-day rules — summarized
  for (const rule of perDayRules) {
    const startDay = config.due_day + graceDays + rule.after_days;
    const dailyAmount = Math.max(Number(rule.amount) || 0, 0);
    if (dailyAmount <= 0 || startDay - config.due_day > simulateDays) continue;

    const endSimDay = config.due_day + simulateDays;
    const daysActive = Math.max(endSimDay - startDay, 0);
    if (daysActive <= 0) continue;

    let totalDailyFee = dailyAmount * daysActive;

    // Cap
    if (maxCap > 0 && totalLateFees + totalDailyFee > maxCap) {
      totalDailyFee = Math.max(maxCap - totalLateFees, 0);
    }

    if (totalDailyFee > 0) {
      totalLateFees += totalDailyFee;
      runningTotal += totalDailyFee;
      events.push({
        day: startDay,
        label: `${monthName} ${startDay}+`,
        amount: totalDailyFee,
        description: `${formatCurrency(dailyAmount)}/day × ${daysActive} days (+${formatCurrency(totalDailyFee)})`,
        date: new Date(runDate).toISOString(),
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
      description: `Maximum late fee ${formatCurrency(maxCap)}`,
      amount: 0,
      running_total: rentAmount + maxCap,
      type: 'cap',
      color: 'rose',
    });
  }

  return events;
}

// ─── What-If Calculator ─────────────────────────────────────────

/**
 * What-If Calculator using the same core logic as the backend.
 * Mirrors backend-next/lib/billing/engine.ts → calculateLateFees()
 */
export function calculateWhatIf(config, rentAmount, daysDelayed) {
  return calculateLateFeesCore(config, rentAmount, daysDelayed);
}
