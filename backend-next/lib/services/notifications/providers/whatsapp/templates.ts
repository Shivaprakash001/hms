import { formatDate, formatMonthYear } from "@/lib/format";
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
  buildParameters: (data: RentReminderTemplateVariables) => string[];
};

function formatTemplateAmount(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

const TEMPLATE_REGISTRY: Record<WhatsAppRentReminderTemplate, TemplateDefinition> = {
  [WhatsAppRentReminderTemplate.RENT_DUE_REMINDER]: {
    metaName: "rent_due_reminder_v1",
    buildParameters: (data) => [
      data.tenantName || "Tenant",
      formatTemplateAmount(data.amount),
      formatMonthYear(data.rentMonth, data.prefs),
      formatDate(data.dueDate, data.prefs),
      data.hostelName || "Your Hostel",
    ],
  },
  [WhatsAppRentReminderTemplate.RENT_DUE_TODAY]: {
    metaName: "rent_due_today_v1",
    buildParameters: (data) => [
      data.tenantName || "Tenant",
      formatTemplateAmount(data.amount),
      formatMonthYear(data.rentMonth, data.prefs),
      data.hostelName || "Your Hostel",
    ],
  },
  [WhatsAppRentReminderTemplate.RENT_OVERDUE_REMINDER]: {
    metaName: "rent_overdue_reminder_v1",
    buildParameters: (data) => [
      data.tenantName || "Tenant",
      formatTemplateAmount(data.amount),
      formatMonthYear(data.rentMonth, data.prefs),
      String(Math.max(1, Math.floor(data.daysOverdue))),
      data.hostelName || "Your Hostel",
    ],
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
  const template = selectRentReminderTemplate(data.daysOverdue);
  const params = TEMPLATE_REGISTRY[template]
    .buildParameters(data)
    .map((value) => String(value).trim());

  if (params.some((value) => !value)) {
    throw new Error(`Invalid WhatsApp template variables for ${template}`);
  }

  return params;
}
