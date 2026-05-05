export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { reminderService } from "@/lib/services/reminder-service";
import { eventLog } from "@/lib/services/event-log-service";

/**
 * 🔔 MANUAL REMINDER
 * POST /api/notifications/send-reminder
 *
 * Owner-triggered one-tap reminder from the dashboard.
 * Sends a WARNING reminder to the tenant's oldest unpaid obligation.
 * Deducts one reminder credit per call (same as automated reminders).
 *
 * Body: { tenant_id: string }
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { tenant_id } = body;

    if (!tenant_id || typeof tenant_id !== "string") {
      return apiError("tenant_id is required", "VALIDATION_ERROR", 400);
    }

    const result = await reminderService.sendManualReminder(tenant_id, session.sub);

    if (result.sent === 0) {
      return apiResponse({
        success: false,
        message: `No unpaid obligations found for ${result.tenant_name}`,
      });
    }

    await eventLog.log("MANUAL_REMINDER_SENT", session.sub, {
      tenant_id,
      tenant_name: result.tenant_name,
    });

    return apiResponse({
      success: true,
      message: `Reminder sent to ${result.tenant_name}`,
      tenant_name: result.tenant_name,
    });
  } catch (error: any) {
    if (error?.httpStatus === 404) {
      return apiError(error.message, "NOT_FOUND", 404);
    }
    if (error?.code === "NO_REMINDERS_LEFT") {
      return apiError(
        "No reminder credits left. Buy a pack to continue sending reminders.",
        "NO_REMINDERS_LEFT",
        402
      );
    }
    console.error("[SEND_REMINDER]", error);
    return apiError(error.message || "Failed to send reminder");
  }
}
