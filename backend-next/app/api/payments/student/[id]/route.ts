export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { paymentService } from "@/lib/services/payment-service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const studentId = params.id;

    if (session.role === "STUDENT") {
      const me = await prisma.student.findUnique({ where: { profile_id: session.sub }, select: { id: true } });
      if (!me || me.id !== studentId) return apiError("Forbidden", "FORBIDDEN", 403);
    }

    if (session.role === "OWNER") {
      const target = await prisma.student.findUnique({ where: { id: studentId }, select: { owner_id: true } });
      if (!target || target.owner_id !== session.sub) return apiError("Forbidden", "FORBIDDEN", 403);
    }

    const history = await paymentService.getStudentPaymentHistory(studentId);
    return apiResponse(history);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    return apiError(msg || "Failed to fetch payment history");
  }
}
