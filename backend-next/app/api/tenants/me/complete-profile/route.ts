export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantService } from "@/lib/services/tenant-service";
import { prisma } from "@/lib/db";
import { StudentProfileUpdateSchema } from "@/lib/validators";


/**
 * 👨‍🎓 COMPLETE TENANT PROFILE (Onboarding)
 * POST /api/tenants/me/complete-profile
 * Parses FormData for profile details and Aadhaar upload handled elsewhere for now.
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") {
    return apiError("Only tenants can complete profile", "FORBIDDEN", 403);
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
      const firstIssue = validated.error.issues[0];
      const issuePath = firstIssue?.path?.join(".") || "profile_data";
      const issueMessage = firstIssue?.message || "Invalid value";
      return apiError(`Validation error at ${issuePath}: ${issueMessage}`, "VALIDATION_ERROR", 400);
    }

    // Pass data directly to self update method
    const updated = await tenantService.updateStudentSelfProfile(session.sub, validated.data, session.sub);
    
    // Process Aadhaar Document
    const aadhaarFile = formData.get("aadhaar_file") as File | null;
    if (aadhaarFile) {
      try {
        const buffer = await aadhaarFile.arrayBuffer();
        const base64Str = Buffer.from(buffer).toString("base64");
        const mimeType = aadhaarFile.type || "image/jpeg";
        const fileUrl = `data:${mimeType};base64,${base64Str}`;
        
        await prisma.identificationDocument.create({
          data: {
             tenant_id: updated.id,
             doc_type: "AADHAAR",
             doc_number: validated.data.aadhaar_number || null,
             file_url: fileUrl,
             uploaded_by: session.sub,
             is_verified: false
          }
        });
      } catch (fileErr) {
        console.error("Failed to upload aadhaar file:", fileErr);
        // Continue, profile was created successfully. Document can be retried later.
      }
    }
    
    return apiResponse(updated, 201);
  } catch (error: any) {
    if (error && typeof error.message === "string" && error.message.startsWith("NOT_FOUND")) {
      return apiError(error.message.split(": ")[1] ?? error.message, "NOT_FOUND", 404);
    }
    return apiError(error?.message || "Failed to complete profile");
  }
}
