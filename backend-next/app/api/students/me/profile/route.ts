export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { studentService } from "@/lib/services/student-service";
import { StudentProfileUpdateSchema } from "@/lib/validators";


/**
 * 👨‍🎓 STUDENT ME PROFILE
 * GET /api/students/me/profile
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "STUDENT") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emergency_contact: true
      }
    });

    if (!profile) {
      return apiError("Student profile not found", "NOT_FOUND", 404);
    }

    const student = await prisma.student.findUnique({
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
        permanent_address: true,
        temporary_address: true,
        aadhaar_number: true,
        document_verified: true,
        created_at: true,
        updated_at: true,
        allocations: {
          where: { is_active: true, end_date: null },
          include: { room: true }
        }
      }
    });

    if (!student) {
      return apiError("Student profile not found", "NOT_FOUND", 404);
    }

    const allocation = student.allocations[0];

    return apiResponse({
      profile: {
        id: profile.id,
        full_name: profile.name,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        emergency_contact: profile.emergency_contact,
        personal_email: student.personal_email,
        permanent_address: student.permanent_address,
        temporary_address: student.temporary_address,
        gender: null
      },
      ...student,
      student_details: student,
      room_no: allocation?.room?.room_no || null,
      status: student.status
    });
  } catch (error: any) {
    return apiError(error?.message || "Failed to fetch student profile");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "STUDENT") {
    return apiError("Only students can update their profile", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const validated = StudentProfileUpdateSchema.safeParse(body);
    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const updated = await studentService.updateStudentSelfProfile(session.sub, validated.data, session.sub);
    return apiResponse(updated);
  } catch (error: any) {
    return apiError(error?.message || "Failed to update profile");
  }
}
