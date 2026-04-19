import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { studentService } from "@/lib/services/student-service";

export const runtime = "nodejs";

/**
 * 👨‍🎓 STUDENT BY ID — Get, Update, Delete
 * GET    /api/students/[id]
 * PUT    /api/students/[id]
 * DELETE /api/students/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const student = await studentService.getStudentById(params.id, { sub: session.sub, role: session.role });
    return apiResponse(student);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message.startsWith("FORBIDDEN")) return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    return apiError(error.message || "Failed to fetch student");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const updated = await studentService.updateStudent(params.id, body, session.sub);
    return apiResponse(updated);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message.startsWith("FORBIDDEN")) return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    return apiError(error.message || "Failed to update student");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const result = await studentService.deleteStudent(params.id, session.sub);
    return apiResponse(result);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message.startsWith("FORBIDDEN")) return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    return apiError(error.message || "Failed to delete student");
  }
}
