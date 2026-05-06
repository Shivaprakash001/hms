/**
 * 🏗️ Global Preferences Service — SINGLE SOURCE OF TRUTH
 *
 * ALL services MUST use this module to read owner preferences.
 * Direct `(hostel?.preferences_config as any) || {}` is BANNED.
 *
 * This ensures:
 * 1. Type safety — every setting has a defined default
 * 2. Consistency — one place to change defaults
 * 3. Auditability — grep for getPreferences to find every consumer
 */

import { prisma } from "./db";

// ─── Strict Typed Preferences ─────────────────────────────────

export interface HostelPreferences {
  // Billing
  rent_cycle: string;
  auto_rent_day: number;
  due_day: number;
  grace_days: number;
  late_fee_type: string;
  late_fee_amount: number;
  late_fee_percentage: number;
  late_fee_after_days: number;
  max_late_fee: number;
  late_fee_rules: any[];

  // Payments
  allow_partial_payments: boolean;
  min_payment_amount: number;

  // Advance / Deposit
  advance_enabled: boolean;
  advance_amount_default: number;
  advance_refundable: boolean;

  // Maintenance
  maintenance_enabled: boolean;
  maintenance_amount_default: number;
  maintenance_type: string;  // "MONTHLY" | "ONE_TIME"

  // Notifications
  reminder_email: boolean;
  reminder_in_app: boolean;
  reminder_whatsapp: boolean;
  reminder_day_1: boolean;
  reminder_day_5: boolean;
  reminder_day_10: boolean;
  late_fee_notification: boolean;
  owner_daily_summary: boolean;

  // Automation
  auto_generate_rent: boolean;
  auto_apply_late_fees: boolean;
  auto_send_reminders: boolean;
  auto_deactivate_days: number;

  // Receipts
  receipt_prefix: string;
  receipt_format: string;
  auto_email_receipt: boolean;
  receipt_footer: string;

  // Security
  require_doc_approval: boolean;
  require_aadhaar: boolean;
  allow_tenant_edits: boolean;
  require_profile_photo_onboarding: boolean;
  data_retention_months: number;

  // System / Localization
  currency: string;
  timezone: string;
  date_format: string;
  time_format: string;
  language: string;
}

const DEFAULTS: HostelPreferences = {
  rent_cycle: "MONTHLY",
  auto_rent_day: 1,
  due_day: 5,
  grace_days: 0,
  late_fee_type: "none",
  late_fee_amount: 200,
  late_fee_percentage: 5,
  late_fee_after_days: 7,
  max_late_fee: 500,
  late_fee_rules: [],

  allow_partial_payments: false,
  min_payment_amount: 500,

  advance_enabled: false,
  advance_amount_default: 0,
  advance_refundable: true,

  maintenance_enabled: false,
  maintenance_amount_default: 0,
  maintenance_type: "MONTHLY",

  reminder_email: true,
  reminder_in_app: true,
  reminder_whatsapp: false,
  reminder_day_1: true,
  reminder_day_5: true,
  reminder_day_10: true,
  late_fee_notification: true,
  owner_daily_summary: false,

  auto_generate_rent: true,
  auto_apply_late_fees: true,
  auto_send_reminders: true,
  auto_deactivate_days: 0,

  receipt_prefix: "HMS",
  receipt_format: "PREFIX-YEAR-SEQ",
  auto_email_receipt: false,
  receipt_footer: "",

  require_doc_approval: false,
  require_aadhaar: false,
  allow_tenant_edits: true,
  require_profile_photo_onboarding: false,
  data_retention_months: 0,

  currency: "INR",
  timezone: "Asia/Kolkata",
  date_format: "DD/MM/YYYY",
  time_format: "12h",
  language: "en",
};

// ─── Core API ─────────────────────────────────────────────────

/**
 * Fetch and return TYPED preferences for an owner.
 * Merges hostel-level columns + JSON blob + defaults.
 *
 * This is the ONLY function services should call.
 */
export async function getPreferences(ownerId: string): Promise<HostelPreferences> {
  const hostel = await prisma.hostel.findFirst({
    where: { owner_id: ownerId, is_active: true },
  });

  return resolvePreferences(hostel);
}

/**
 * Resolve preferences from a hostel record already in memory.
 * Use this in batch operations where you've already fetched hostels.
 */
export function resolvePreferences(hostel: any): HostelPreferences {
  if (!hostel) return { ...DEFAULTS };

  const config = (hostel.preferences_config as any) || {};

  return {
    ...DEFAULTS,
    // Override from typed columns
    ...(hostel.currency && { currency: hostel.currency }),
    ...(hostel.rent_cycle && { rent_cycle: hostel.rent_cycle }),
    ...(hostel.receipt_prefix && { receipt_prefix: hostel.receipt_prefix }),
    ...(hostel.timezone && { timezone: hostel.timezone }),
    ...(hostel.auto_rent_day && { auto_rent_day: hostel.auto_rent_day }),
    // Override from JSON blob (takes precedence over typed columns for extended keys)
    ...config,
  };
}

/**
 * Get the hostel record + resolved preferences in one call.
 * Useful when you need both the hostel metadata AND the prefs.
 */
export async function getHostelWithPreferences(ownerId: string) {
  const hostel = await prisma.hostel.findFirst({
    where: { owner_id: ownerId, is_active: true },
  });

  return {
    hostel,
    prefs: resolvePreferences(hostel),
  };
}
