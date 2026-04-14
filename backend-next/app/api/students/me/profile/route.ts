import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { studentService } from "@/lib/services/student-service";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const student = await studentService.getStudentByProfile(session.sub, {
      sub: session.sub,
      role: session.role
    });
    return apiResponse(student);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    return apiError("Internal server error");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "STUDENT") return apiError("Only students can update their profile self", "FORBIDDEN", 403);

  try {
    const body = await req.json();
    // In production, we'd use a specific validator here from lib/validators
    const updated = await studentService.updateStudentSelfProfile(session.sub, body, session.sub);
    return apiResponse(updated);
  } catch (error: any) {
    return apiError(error.message || "Failed to update profile");
  }
}
