export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { EmailService } from "@/lib/services/email-service";
import { prisma } from "@/lib/db";
import { eventLog } from "@/lib/services/event-log-service";
import { consumeReminder } from "@/lib/services/plan-gate-service";
import { formatMonthYear } from "@/lib/format";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { hostelPolicyService } from "@/lib/services/hostel-policy-service";

/**
 * 🔔 TEST REMINDER
 * POST /api/notifications/test-reminder
 *
 * Sends a test reminder email to the owner themselves.
 * Credit enforcement: deducts 1 reminder credit (addon-based, NOT plan-gated).
 * All plans can send if credits > 0.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json().catch(() => ({}));
    const reminderType = body.type || "DUE_SOON";
    const hostelId = body.hostel_id || body.hostelId;
    if (!hostelId) {
      return apiError("hostelId is required for test reminders", "HOSTEL_CONTEXT_REQUIRED", 400);
    }

    const validTypes = ["DUE_SOON", "WARNING", "FINAL_NOTICE", "LATE_FEE_ADDED"];
    if (!validTypes.includes(reminderType)) {
      return apiError(
        `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        "VALIDATION_ERROR",
        400
      );
    }

    // 🔒 Enforce addon credits — NOT plan-gated
    try {
      await consumeReminder(scope.owner_id);
    } catch (creditErr: any) {
      if (creditErr?.code === "NO_REMINDERS_LEFT") {
        return apiError(
          "No reminder credits left. Buy a pack to continue sending reminders.",
          "NO_REMINDERS_LEFT",
          402
        );
      }
      throw creditErr;
    }

    // Fetch owner profile
    const profile = await prisma.profile.findUnique({
      where: { id: scope.owner_id },
      select: { name: true, email: true },
    });

    if (!profile?.email) {
      return apiError("No email found for your account", "NOT_FOUND", 404);
    }

    const policyResult = await hostelPolicyService.getHostelPolicy(hostelId, scope.owner_id);
    const prefs = policyResult.compatibility_preferences;
    const dueDay = prefs.due_day;
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthLabel = formatMonthYear(nextMonth, prefs);

    const result = await EmailService.sendReminderBatch({
      toEmail: profile.email,
      name: profile.name,
      amount: 8000,
      rentMonth: monthLabel,
      dueDate: `${dueDay} ${monthLabel}`,
      type: reminderType as any,
      prefs,
    });

    await eventLog.log("TEST_REMINDER_SENT", scope.owner_id, {
      hostel_id: hostelId,
      type: reminderType,
      email: profile.email,
      sent: result.sent,
    });

    if (!result.sent) {
      return apiResponse({
        success: false,
        message: `Email could not be delivered: ${result.error}`,
        simulation: !process.env.RESEND_API_KEY,
      }, 200);
    }

    return apiResponse({
      success: true,
      message: `Test ${reminderType.replace(/_/g, " ").toLowerCase()} sent to ${profile.email}`,
      provider_id: result.provider_id,
    });
  } catch (error: any) {
    console.error("[TEST_REMINDER] Failed:", error);
    return apiError(error.message || "Failed to send test reminder");
  }
}
