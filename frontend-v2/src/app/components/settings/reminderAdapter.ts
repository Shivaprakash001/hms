export interface FrontendReminderState {
  autoSendReminders: boolean;
  strategy: 'gentle' | 'standard' | 'aggressive' | 'custom';
  channels: {
    email: boolean;
    in_app: boolean;
    whatsapp: boolean;
    sms: boolean;
  };
  customBeforeDueDays: number[];
  customAfterDueDays: number[];
  repeatInterval: number; // 0 for none, or 3, 5, 7, 10, 14, 30
  stopCondition: 'paid' | 'manual' | 'never';
  lateFeeNotifications: boolean;
  ownerDailySummary: boolean;
}

export const GENTLE_BEFORE = [2];
export const GENTLE_AFTER = [1, 7];

export const STANDARD_BEFORE = [3, 1];
export const STANDARD_AFTER = [1, 5, 10];

export const AGGRESSIVE_BEFORE = [5, 3, 1];
export const AGGRESSIVE_AFTER = [1, 2, 3, 5, 7, 10, 14];

const eq = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const sA = [...a].sort((x, y) => x - y);
  const sB = [...b].sort((x, y) => x - y);
  return sA.every((val, i) => val === sB[i]);
};

export function toFrontendModel(policy: any): FrontendReminderState {
  const reminders = policy?.reminders;
  const automation = policy?.automation;
  
  const autoSendReminders = automation?.auto_send_reminders ?? reminders?.enabled ?? true;

  const channels = {
    email: reminders?.channels?.email ?? true,
    in_app: reminders?.channels?.in_app ?? true,
    whatsapp: reminders?.channels?.whatsapp ?? false,
    sms: reminders?.channels?.sms ?? false,
  };

  const stopCondition = reminders?.stop_condition ?? 
    (reminders?.auto_stop_after_payment ?? true ? 'paid' : 'never');

  const lateFeeNotifications = reminders?.late_fee_notifications ?? true;
  const ownerDailySummary = reminders?.owner_daily_summary ?? false;

  // 1. If high-fidelity fields are already present, use them
  if (reminders?.strategy) {
    return {
      autoSendReminders,
      strategy: reminders.strategy,
      channels,
      customBeforeDueDays: reminders.custom_before_due_days ?? [],
      customAfterDueDays: reminders.custom_after_due_days ?? [],
      repeatInterval: reminders.repeat_interval ?? 0,
      stopCondition,
      lateFeeNotifications,
      ownerDailySummary,
    };
  }

  // 2. Otherwise detect them from schedule
  const beforeDays = reminders?.schedule?.before_due_days ?? [];
  const afterDays = reminders?.schedule?.after_due_days ?? [];

  // Check presets
  if (eq(beforeDays, GENTLE_BEFORE) && eq(afterDays, GENTLE_AFTER)) {
    return {
      autoSendReminders,
      strategy: 'gentle',
      channels,
      customBeforeDueDays: [],
      customAfterDueDays: [],
      repeatInterval: 0,
      stopCondition,
      lateFeeNotifications,
      ownerDailySummary,
    };
  }

  if (eq(beforeDays, STANDARD_BEFORE) && eq(afterDays, STANDARD_AFTER)) {
    return {
      autoSendReminders,
      strategy: 'standard',
      channels,
      customBeforeDueDays: [],
      customAfterDueDays: [],
      repeatInterval: 0,
      stopCondition,
      lateFeeNotifications,
      ownerDailySummary,
    };
  }

  if (eq(beforeDays, AGGRESSIVE_BEFORE) && eq(afterDays, AGGRESSIVE_AFTER)) {
    return {
      autoSendReminders,
      strategy: 'aggressive',
      channels,
      customBeforeDueDays: [],
      customAfterDueDays: [],
      repeatInterval: 0,
      stopCondition,
      lateFeeNotifications,
      ownerDailySummary,
    };
  }

  // Detect repeating interval for custom
  let repeatInterval = 0;
  let detectedAfterDays = [...afterDays];

  for (const d of [3, 5, 7, 10, 14, 30]) {
    const expectedMultiples = Array.from({ length: Math.floor(90 / d) }, (_, idx) => (idx + 1) * d);
    const containsAllMultiples = expectedMultiples.every(x => afterDays.includes(x));
    if (containsAllMultiples && expectedMultiples.length > 0) {
      repeatInterval = d;
      // Filter out the repeating multiples to get custom days
      detectedAfterDays = detectedAfterDays.filter(x => !expectedMultiples.includes(x));
      break;
    }
  }

  return {
    autoSendReminders,
    strategy: 'custom',
    channels,
    customBeforeDueDays: beforeDays,
    customAfterDueDays: detectedAfterDays,
    repeatInterval,
    stopCondition,
    lateFeeNotifications,
    ownerDailySummary,
  };
}

export function toBackendModel(state: FrontendReminderState): any {
  let before_due_days: number[] = [];
  let after_due_days: number[] = [];

  if (state.strategy === 'gentle') {
    before_due_days = [...GENTLE_BEFORE];
    after_due_days = [...GENTLE_AFTER];
  } else if (state.strategy === 'standard') {
    before_due_days = [...STANDARD_BEFORE];
    after_due_days = [...STANDARD_AFTER];
  } else if (state.strategy === 'aggressive') {
    before_due_days = [...AGGRESSIVE_BEFORE];
    after_due_days = [...AGGRESSIVE_AFTER];
  } else {
    // Custom
    before_due_days = [...state.customBeforeDueDays].sort((a, b) => a - b);
    
    // Combine custom days with repeating interval multiples if enabled
    let combinedAfter = [...state.customAfterDueDays];
    if (state.repeatInterval > 0) {
      const repeatDays = Array.from(
        { length: Math.floor(90 / state.repeatInterval) },
        (_, i) => (i + 1) * state.repeatInterval
      );
      combinedAfter = [...combinedAfter, ...repeatDays];
    }
    after_due_days = Array.from(new Set(combinedAfter)).sort((a, b) => a - b);
  }

  return {
    reminders: {
      enabled: state.autoSendReminders,
      channels: state.channels,
      schedule: {
        before_due_days,
        after_due_days,
      },
      auto_stop_after_payment: state.stopCondition === 'paid',
      late_fee_notifications: state.lateFeeNotifications,
      owner_daily_summary: state.ownerDailySummary,
      // Store metadata for roundtrip precision and future use
      strategy: state.strategy,
      repeat_interval: state.repeatInterval,
      custom_before_due_days: state.customBeforeDueDays,
      custom_after_due_days: state.customAfterDueDays,
      stop_condition: state.stopCondition,
    },
    automation: {
      auto_send_reminders: state.autoSendReminders,
    }
  };
}
