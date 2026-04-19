import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { studentService } from "@/lib/services/student-service";
import { StudentProfileUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * 👨‍🎓 COMPLETE STUDENT PROFILE (Onboarding)
 * POST /api/students/me/complete-profile
 * Parses FormData for profile details and Aadhaar upload handled elsewhere for now.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "STUDENT") {
    return apiError("Only students can complete profile", "FORBIDDEN", 403);
  }

  try {
    const formData = await req.formData();
    const profileDataStr = formData.get("profile_data") as string;
    if (!profileDataStr) {
      return apiError("profile_data is required", "VALIDATION_ERROR", 400);
    }
    
    let parsedData;
    try {
      parsedData = JSON.parse(profileDataStr);
    } catch (e) {
      return apiError("Invalid JSON in profile_data", "VALIDATION_ERROR", 400);
    }

    const validated = StudentProfileUpdateSchema.safeParse(parsedData);
    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    // Pass data directly to self update method
    const updated = await studentService.updateStudentSelfProfile(session.sub, validated.data, session.sub);
    
    // Note: Aadhaar file processing should be integrated here or via separate document_service
    // For now we accept and update fields 
    
    return apiResponse(updated, 201);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    return apiError(error.message || "Failed to complete profile");
  }
}
