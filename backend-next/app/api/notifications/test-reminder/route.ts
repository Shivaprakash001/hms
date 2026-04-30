export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { EmailService } from "@/lib/services/email-service";
import { prisma } from "@/lib/db";
import { eventLog } from "@/lib/services/event-log-service";
import { getPreferences } from "@/lib/preferences";
import { formatMonthYear } from "@/lib/format";

/**
 * 🔔 TEST REMINDER
 * POST — Send a test reminder email to the owner themselves
 * 
 * Supports `type` param: "DUE_SOON" | "WARNING" | "FINAL_NOTICE" | "LATE_FEE_ADDED"
 * Defaults to "DUE_SOON" (gentle reminder).
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reminderType = body.type || "DUE_SOON";

    // Validate reminder type
    const validTypes = ["DUE_SOON", "WARNING", "FINAL_NOTICE", "LATE_FEE_ADDED"];
    if (!validTypes.includes(reminderType)) {
      return apiError(`Invalid type. Must be one of: ${validTypes.join(", ")}`, "VALIDATION_ERROR", 400);
    }

    // Fetch owner profile to get email
    const profile = await prisma.profile.findUnique({
      where: { id: session.sub },
      select: { name: true, email: true },
    });

    if (!profile?.email) {
      return apiError("No email found for your account", "NOT_FOUND", 404);
    }

    // Fetch preferences via global service
    const prefs = await getPreferences(session.sub);
    const dueDay = prefs.due_day;
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthLabel = formatMonthYear(nextMonth, prefs);

    // Send the test email using the real template pipeline
    const result = await EmailService.sendReminderBatch({
      toEmail: profile.email,
      name: profile.name,
      amount: 8000, // sample amount for preview
      rentMonth: monthLabel,
      dueDate: `${dueDay} ${monthLabel}`,
      type: reminderType as any,
      prefs,
    });

    // Audit log
    await eventLog.log("TEST_REMINDER_SENT", session.sub, {
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
