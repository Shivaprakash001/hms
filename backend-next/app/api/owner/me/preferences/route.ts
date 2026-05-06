export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { propertyService } from "@/lib/services/property-service";
import { getPreferences } from "@/lib/preferences";
import { planGate } from "@/lib/services/plan-gate-service";

// Automation-related preference keys
const AUTOMATION_KEYS = ["auto_generate_rent", "auto_apply_late_fees", "auto_send_reminders"] as const;
const STARTER_ONLY_KEYS = ["require_profile_photo_onboarding"] as const;

/**
 * GET — Return resolved preferences (defaults merged with hostel overrides).
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }
  try {
    const prefs = await getPreferences(session.sub);
    return apiResponse(prefs);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch preferences");
  }
}

/**
 * ⚙️ OWNER PREFERENCES
 * PATCH /api/owner/me/preferences
 *
 * Plan enforcement:
 * - Automation keys (auto_generate_rent, auto_apply_late_fees, auto_send_reminders)
 *   → blocked with 402 if plan does not include automation (FREE plan)
 * - Reminder keys (reminder_email, reminder_in_app, reminder_day_*, etc.)
 *   → NEVER blocked — reminder settings are always editable
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();

    const currentPrefs = await getPreferences(session.sub) as any;
    // 🔒 Automation save guard — block enabling automation on FREE plan
    const isTryingToEnableAutomation = AUTOMATION_KEYS.some(
      (key) => key in body && body[key] === true && currentPrefs[key] !== true
    );

    if (isTryingToEnableAutomation) {
      const hasAutomation = await planGate.hasFeature(session.sub, "automation");
      if (!hasAutomation) {
        return NextResponse.json({
          error: "FEATURE_NOT_AVAILABLE",
          feature: "automation",
          message: "Upgrade to Starter to enable automation",
          upgrade_required: true,
          recommended_plan: "starter",
        }, { status: 402 });
      }
    }

    const isTryingToEnableStarterOnly = STARTER_ONLY_KEYS.some(
      (key) => key in body && body[key] === true && currentPrefs[key] !== true
    );
    if (isTryingToEnableStarterOnly) {
      const hasStarterPlus = await planGate.hasFeature(session.sub, "automation");
      if (!hasStarterPlus) {
        return NextResponse.json({
          error: "FEATURE_NOT_AVAILABLE",
          feature: "require_profile_photo_onboarding",
          message: "Upgrade to Starter to require profile photo during onboarding",
          upgrade_required: true,
          recommended_plan: "starter",
        }, { status: 402 });
      }
    }

    const result = await propertyService.updatePreferences(session.sub, body);
    return apiResponse(result);
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("VALIDATION"))
      return apiError(msg.split(": ")[1] ?? msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("NOT_FOUND"))
      return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    return apiError(msg || "Failed to update preferences");
  }
}
