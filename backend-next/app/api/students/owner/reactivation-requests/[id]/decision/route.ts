import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { studentService } from "@/lib/services/student-service";

export const runtime = "nodejs";

/**
 * 👨‍🎓 PROCESS REACTIVATION REQUEST
 * POST /api/students/owner/reactivation-requests/[id]/decision
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    if (!body.action) {
      return apiError("action (approve/reject) is required", "VALIDATION_ERROR", 400);
    }
    
    const result = await studentService.processReactivationRequest(
      params.id,
      session.sub,
      body.action,
      body.notes
    );

    return apiResponse(result);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message.startsWith("VALIDATION")) return apiError(error.message.split(": ")[1], "VALIDATION_ERROR", 400);
    return apiError(error.message || "Failed to process reactivation request");
  }
}
