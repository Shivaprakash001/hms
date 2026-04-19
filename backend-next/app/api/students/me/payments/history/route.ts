import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { paymentService } from "@/lib/services/payment-service";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 👨‍🎓 STUDENT ME PAYMENT HISTORY
 * GET /api/students/me/payments/history
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "STUDENT") {
    return apiError("Forbidden: Only students can access this endpoint", "FORBIDDEN", 403);
  }

  try {
    const student = await prisma.student.findUnique({
      where: { profile_id: session.sub },
      select: { id: true }
    });

    if (!student) {
      return apiError("Student record not found", "NOT_FOUND", 404);
    }

    const history = await paymentService.getStudentPaymentHistory(student.id);
    return apiResponse(history);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    return apiError(error.message || "Failed to fetch payment history");
  }
}
