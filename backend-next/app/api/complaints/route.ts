import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { complaintService } from "@/lib/services/complaint-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * 🛠 Complaints Collection
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;

    if (session.role === "STUDENT") {
      // Students only see their own complaints
      const complaints = await complaintService.getStudentComplaints(session.sub);
      return apiResponse(complaints);
    } else {
      // Owners/Admins see all for their property
      const complaints = await complaintService.getOwnerComplaints(session.sub, status);
      return apiResponse(complaints);
    }
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch complaints");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json();
    if (session.role !== "STUDENT") {
      return apiError("Only students can create complaints", "FORBIDDEN", 403);
    }

    // We need the owner_id for the student.
    // Assuming it's in the session or we fetch it.
    // For now, assume it's passed or student is linked to owner in session.
    // If not in session, we look it up.
    const complaint = await complaintService.createComplaint({
      ...body,
      student_id: session.sub
    });

    return apiResponse(complaint, 201);
  } catch (error: any) {
    return apiError(error.message || "Failed to create complaint");
  }
}
