import { formatCurrency, formatDate, formatMonthYear } from "@/lib/format";
import type { HostelPreferences } from "@/lib/preferences";

export enum WhatsAppRentReminderTemplate {
  RENT_DUE_REMINDER = "RENT_DUE_REMINDER",
  RENT_DUE_TODAY = "RENT_DUE_TODAY",
  RENT_OVERDUE_REMINDER = "RENT_OVERDUE_REMINDER",
}

export type RentReminderTemplateVariables = {
  obligationId: string;
  tenantName: string;
  hostelName: string;
  amount: number;
  rentMonth: Date | string;
  dueDate: Date | string;
  daysOverdue: number;
  prefs?: Partial<HostelPreferences>;
};

type TemplateDefinition = {
  metaName: string;
  variableCount: number;
};

const TEMPLATE_REGISTRY: Record<WhatsAppRentReminderTemplate, TemplateDefinition> = {
  [WhatsAppRentReminderTemplate.RENT_DUE_REMINDER]: {
    metaName: "rent_due_reminder_v2",
    variableCount: 6,
  },
  [WhatsAppRentReminderTemplate.RENT_DUE_TODAY]: {
    metaName: "rent_due_today_v2",
    variableCount: 6,
  },
  [WhatsAppRentReminderTemplate.RENT_OVERDUE_REMINDER]: {
    metaName: "rent_overdue_reminder_v2",
    variableCount: 6,
  },
};

export function selectRentReminderTemplate(daysOverdue: number): WhatsAppRentReminderTemplate {
  if (daysOverdue < 0) return WhatsAppRentReminderTemplate.RENT_DUE_REMINDER;
  if (daysOverdue === 0) return WhatsAppRentReminderTemplate.RENT_DUE_TODAY;
  return WhatsAppRentReminderTemplate.RENT_OVERDUE_REMINDER;
}

export function getMetaTemplateName(template: WhatsAppRentReminderTemplate): string {
  return TEMPLATE_REGISTRY[template].metaName;
}

export function buildRentReminderBodyParameters(data: RentReminderTemplateVariables): string[] {
  const dueDescriptor = data.daysOverdue > 0
    ? `${data.daysOverdue} day${data.daysOverdue === 1 ? "" : "s"}`
    : formatDate(data.dueDate, data.prefs);

  const params = [
    data.obligationId,
    data.tenantName || "Tenant",
    data.hostelName || "Your Hostel",
    formatCurrency(data.amount, data.prefs),
    formatMonthYear(data.rentMonth, data.prefs),
    dueDescriptor,
  ].map((value) => String(value).trim());

  const template = selectRentReminderTemplate(data.daysOverdue);
  const expected = TEMPLATE_REGISTRY[template].variableCount;
  if (params.length !== expected || params.some((value) => !value)) {
    throw new Error(`Invalid WhatsApp template variables for ${template}`);
  }

  return params;
}
