import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { studentService } from "@/lib/services/student-service";

export const runtime = "nodejs";

/**
 * 👨‍🎓 OWNER TENANT OVERVIEW
 * GET /api/students/owner/tenants/[id]/overview
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const overview = await studentService.getOwnerTenantOverview(params.id, session.sub);
    return apiResponse(overview);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message.startsWith("FORBIDDEN")) return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    return apiError(error.message || "Failed to fetch tenant overview");
  }
}
