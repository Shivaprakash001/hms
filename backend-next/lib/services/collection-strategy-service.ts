export type ReminderType = "DUE_SOON" | "WARNING" | "FINAL_NOTICE";

export type CollectionStrategy = {
  enabled: boolean;
  after_due_days: number[];
  before_due_days: number[];
  auto_stop_after_payment: boolean;
  escalation_tone: string;
};

function uniqueSortedDays(value: unknown, fallback: number[]) {
  const source = Array.isArray(value) ? value : fallback;
  return Array.from(new Set(
    source
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day > 0 && day <= 90)
  )).sort((a, b) => a - b);
}

function legacyAfterDueDays(config: any) {
  const days: number[] = [];
  if (config.reminder_day_1 !== false) days.push(1);
  if (config.reminder_day_5 !== false) days.push(5);
  if (config.reminder_day_10 !== false) days.push(10);
  return days;
}

export function resolveCollectionStrategy(config: any): CollectionStrategy {
  const afterDue = config.reminder_after_due_days ?? config.reminders_after_due_days;
  const beforeDue = config.reminder_before_due_days ?? config.reminders_before_due_days;
  return {
    enabled: config.auto_send_reminders ?? config.reminders_enabled ?? true,
    after_due_days: uniqueSortedDays(afterDue, legacyAfterDueDays(config)),
    before_due_days: uniqueSortedDays(beforeDue, []),
    auto_stop_after_payment: config.reminder_auto_stop_after_payment ?? true,
    escalation_tone: String(config.reminder_escalation_tone || "STANDARD"),
  };
}

export function reminderTypeForScheduleIndex(index: number, total: number): ReminderType {
  if (index <= 0) return "DUE_SOON";
  if (index === total - 1 && total >= 3) return "FINAL_NOTICE";
  return "WARNING";
}

export function selectReminderForOverdueDay(
  daysOverdue: number,
  lastReminderType: string | null | undefined,
  config: any,
): ReminderType | null {
  const strategy = resolveCollectionStrategy(config);
  if (!strategy.enabled) return null;

  const index = strategy.after_due_days.indexOf(daysOverdue);
  if (index === -1) return null;

  const type = reminderTypeForScheduleIndex(index, strategy.after_due_days.length);
  if (lastReminderType === type) return null;
  if (lastReminderType === "FINAL_NOTICE") return null;
  return type;
}
