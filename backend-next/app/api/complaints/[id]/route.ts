import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { complaintService } from "@/lib/services/complaint-service";

export const runtime = "nodejs";

/**
 * 🛠 Complaint Member
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN", "WARDEN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const complaint = await complaintService.updateComplaintStatus(params.id, session.sub, body);
    return apiResponse(complaint);
  } catch (error: any) {
    return apiError(error.message || "Failed to update complaint");
  }
}
