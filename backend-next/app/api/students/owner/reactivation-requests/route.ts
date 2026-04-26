export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { studentService } from "@/lib/services/student-service";


/**
 * 👨‍🎓 REACTIVATION REQUESTS (Owner View)
 * GET /api/students/owner/reactivation-requests
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const requests = await studentService.listReactivationRequests(session.sub);
    return apiResponse(requests);
  } catch (error: any) {
    return apiError(error.message || "Failed to list reactivation requests");
  }
}
