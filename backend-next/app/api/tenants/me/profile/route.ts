export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tenantService } from "@/lib/services/tenant-service";
import { TenantProfileUpdateSchema } from "@/lib/validators";
import { documentService } from "@/lib/services/document-service";


/**
 * 👨‍🎓 TENANT ME PROFILE
 * GET /api/tenants/me/profile
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const tenant = await prisma.tenants.findUnique({
      where: { profile_id: session.sub },
      select: {
        id: true,
        profile_id: true,
        monthly_rent: true,
        joined_on: true,
        status: true,
        owner_id: true,
        profile_completed: true,
        photo_url: true,
        phone_1: true,
        phone_2: true,
        phone_3: true,
        personal_email: true,
        college_name: true,
        roll_number: true,
        course: true,
        year_of_study: true,
        section: true,
        branch: true,
        office_name: true,
        office_location: true,
        job_role: true,
        profile_type: true,
        gender: true,
        date_of_birth: true,
        permanent_address: true,
        temporary_address: true,
        document_verified: true,
        created_at: true,
        updated_at: true,
        profile: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            emergency_contact: true
          }
        },
        allocations: {
          where: { is_active: true, end_date: null },
          orderBy: { start_date: "desc" },
          take: 1,
          include: { room: true }
        }
      }
    });

    if (!tenant) {
      return apiError("Tenant profile not found", "NOT_FOUND", 404);
    }

    const allocation = tenant.allocations[0];
    const profile = tenant.profile;

    const verification_badge = await documentService.getVerificationBadge(tenant.id);

    return apiResponse({
      ...tenant,
      verification_badge,
      profile: {
        id: profile.id,
        full_name: profile.name,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        emergency_contact: profile.emergency_contact,
        personal_email: tenant.personal_email,
        permanent_address: tenant.permanent_address,
        temporary_address: tenant.temporary_address,
        gender: tenant.gender,
        date_of_birth: tenant.date_of_birth
      },
      tenant_details: tenant,
      current_room: allocation?.room
        ? {
            room_no: allocation.room.room_no,
            floor: allocation.room.floor ?? null,
          }
        : null,
      room_no: allocation?.room?.room_no || null,
      floor: allocation?.room?.floor ?? null,
      status: tenant.status
    });
  } catch (error: any) {
    return apiError(error?.message || "Failed to fetch tenant profile");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "TENANT") {
    return apiError("Only tenants can update their profile", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const validated = TenantProfileUpdateSchema.safeParse(body);
    if (!validated.success) {
      return apiError(`Validation error: ${validated.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`, "VALIDATION_ERROR", 400);
    }

    const updated = await tenantService.updateTenantSelfProfile(session.sub, validated.data, session.sub);
    return apiResponse(updated);
  } catch (error: any) {
    return apiError(error?.message || "Failed to update profile");
  }
}
