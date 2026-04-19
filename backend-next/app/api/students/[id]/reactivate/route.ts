import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { studentService } from "@/lib/services/student-service";

export const runtime = "nodejs";

/**
 * 👨‍🎓 REACTIVATE STUDENT
 * POST /api/students/[id]/reactivate
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
    if (!body.monthly_rent || !body.joined_on) {
      return apiError("monthly_rent and joined_on are required", "VALIDATION_ERROR", 400);
    }
    
    const joinedOnDate = new Date(body.joined_on);

    const result = await studentService.reactivateStudent(
      params.id, 
      body.monthly_rent, 
      joinedOnDate, 
      session.sub
    );

    return apiResponse(result);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message.startsWith("FORBIDDEN")) return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    if (error.message.startsWith("VALIDATION")) return apiError(error.message.split(": ")[1], "VALIDATION_ERROR", 400);
    return apiError(error.message || "Failed to reactivate student");
  }
}
