export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantService } from "@/lib/services/tenant-service";
import { prisma } from "@/lib/db";
import { TenantProfileUpdateSchema } from "@/lib/validators";
import { getPreferences } from "@/lib/preferences";


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

    const validated = TenantProfileUpdateSchema.safeParse(parsedData);
    if (!validated.success) {
      const firstIssue = validated.error.issues[0];
      const issuePath = firstIssue?.path?.join(".") || "profile_data";
      const issueMessage = firstIssue?.message || "Invalid value";
      return apiError(`Validation error at ${issuePath}: ${issueMessage}`, "VALIDATION_ERROR", 400);
    }

    const payload = validated.data;
    
    // Default mapped values
    let gender = payload.gender;
    if (gender === "Prefer not to say") gender = null;
    
    // Address backwards compatibility
    const tempAddr = payload.temporary_address || payload.address || null;
    const permAddr = payload.permanent_address || payload.address || null;

    const fileToDataUrl = async (file: File | null): Promise<string | undefined> => {
      if (!file) return undefined;
      const buffer = await file.arrayBuffer();
      const base64Str = Buffer.from(buffer).toString("base64");
      const mimeType = file.type || "image/jpeg";
      return `data:${mimeType};base64,${base64Str}`;
    };

    // File handling before transaction to avoid holding locks during buffer reads
    let fileUrl: string | undefined = undefined;
    const aadhaarFile = formData.get("aadhaar_file") as File | null;
    fileUrl = await fileToDataUrl(aadhaarFile);

    const profilePhotoFile = formData.get("profile_photo") as File | null;

    const tenantOwner = await prisma.tenant.findUnique({
      where: { profile_id: session.sub },
      select: { owner_id: true },
    });
    const ownerPrefs = tenantOwner?.owner_id ? await getPreferences(tenantOwner.owner_id) : null;
    const profilePhotoRequired = Boolean(ownerPrefs?.require_profile_photo_onboarding);
    if (profilePhotoRequired && !profilePhotoFile) {
      return apiError("Profile photo is required by your hostel owner.", "VALIDATION_ERROR", 400);
    }

    if (profilePhotoFile) {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(profilePhotoFile.type)) {
        return apiError("Profile photo must be JPG, PNG, or WEBP", "VALIDATION_ERROR", 400);
      }
      if (profilePhotoFile.size > 2 * 1024 * 1024) {
        return apiError("Profile photo must be less than 2MB", "VALIDATION_ERROR", 400);
      }
    }
    const profilePhotoUrl = await fileToDataUrl(profilePhotoFile);

    // Atomic onboarding transaction: either all profile completion writes commit, or none do.
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Profile Layer
      await tx.profile.update({
        where: { id: session.sub },
        data: {
          name: payload.name || undefined,
          email: payload.personal_email || undefined,
          phone: payload.phone || undefined,
          emergency_contact: payload.emergency_contact || undefined,
          is_profile_completed: true,
        }
      });

      // 2. Update Tenant Layer
      const tenantUpdate = await tx.tenant.update({
        where: { profile_id: session.sub },
        data: {
          phone_1: payload.phone || undefined,
          personal_email: payload.personal_email || undefined,
          gender: gender || undefined,
          date_of_birth: payload.date_of_birth ? new Date(payload.date_of_birth) : undefined,
          temporary_address: tempAddr || undefined,
          permanent_address: permAddr || undefined,
          profile_type: payload.profile_type || "STUDENT",

          college_name: payload.college_name || null,
          roll_number: payload.roll_number || null,
          course: payload.course || null,
          year_of_study: payload.year_of_study || null,
          branch: payload.branch || null,
          section: payload.section || null,

          office_name: payload.office_name || null,
          office_location: payload.office_location || null,
          job_role: payload.job_role || null,

          aadhaar_number: payload.aadhaar_number ?? undefined,
          photo_url: profilePhotoUrl || undefined,
          profile_completed: true,
        }
      });

      if (fileUrl) {
        await tx.identificationDocument.create({
          data: {
            tenant_id: tenantUpdate.id,
            doc_type: "AADHAAR",
            doc_number: payload.aadhaar_number || null,
            file_url: fileUrl,
            uploaded_by: session.sub,
            is_verified: false,
          },
        });
      }

      return tenantUpdate;
    }, { timeout: 15000 });

    return apiResponse(updated, 201);
  } catch (error: any) {
    console.error(error);
    const msg = String(error?.message || "");
    if (error?.code === "P2002" || msg.includes("aadhaar_number")) {
      return apiError("This Aadhaar number is already registered with another account.", "DUPLICATE", 409);
    }
    return apiError(error?.message || "Failed to complete profile");
  }
}
