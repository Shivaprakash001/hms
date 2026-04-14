import { prisma } from "../db";
import { eventSystem } from "../events";
import { z } from "zod";

export class StudentService {
  async getStudentById(id: string, requestingUser: { sub: string; role: string }) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        profile: true,
        allocations: {
          where: { is_active: true },
          include: { room: true },
        },
      },
    });

    if (!student) throw new Error("NOT_FOUND: Student record not found");

    if (requestingUser.role === "STUDENT" && student.profile_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own record");
    }

    return student;
  }

  async getStudentByProfile(profileId: string, requestingUser: { sub: string; role: string }) {
    const student = await prisma.student.findUnique({
      where: { profile_id: profileId },
      include: {
        profile: true,
        allocations: {
          where: { is_active: true },
          include: { room: true },
        },
      },
    });

    if (!student) throw new Error("NOT_FOUND: Student record not found");

    if (requestingUser.role === "STUDENT" && profileId !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own record");
    }

    return student;
  }

  async getAllStudents(params: {
    status?: string;
    search?: string;
    ownerId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { status, search, ownerId, limit = 50, offset = 0 } = params;

    const where: any = {
      ...(ownerId && { owner_id: ownerId }),
      ...(status && { status: status as any }),
    };

    if (search) {
      where.OR = [
        { profile: { name: { contains: search, mode: "insensitive" } } },
        { profile: { email: { contains: search, mode: "insensitive" } } },
        { roll_number: { contains: search, mode: "insensitive" } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          profile: true,
          allocations: {
            where: { is_active: true },
            include: { room: true },
          },
        },
        take: limit,
        skip: offset,
        orderBy: { joined_on: "desc" },
      }),
      prisma.student.count({ where }),
    ]);

    return { students, total, limit, offset };
  }

  async updateStudentSelfProfile(profileId: string, data: any, updatedBy: string) {
    const studentCheck = await prisma.student.findUnique({
      where: { profile_id: profileId },
      select: { id: true },
    });

    if (!studentCheck) throw new Error("NOT_FOUND: Student record not found");

    const profileFields = ["name", "email", "phone"];
    const studentFields = [
      "photo_url", "phone_1", "phone_2", "phone_3", "aadhaar_number", "personal_email",
      "college_name", "roll_number", "course", "year_of_study", "section", "branch",
      "temporary_address", "permanent_address"
    ];

    const profileUpdate: any = {};
    const studentUpdate: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (profileFields.includes(key)) profileUpdate[key] = value;
      else if (studentFields.includes(key)) studentUpdate[key] = value;
    }

    // Legacy address mapping
    if (data.address) {
      studentUpdate.temporary_address = data.address;
      studentUpdate.permanent_address = data.address;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.profile.update({
        where: { id: profileId },
        data: profileUpdate,
      });
    }

    if (Object.keys(studentUpdate).length > 0) {
      await prisma.student.update({
        where: { profile_id: profileId },
        data: studentUpdate,
      });
    }

    // Completion check
    const refreshed = await this.getStudentByProfile(profileId, { sub: profileId, role: "STUDENT" });
    const isComplete = this.checkProfileCompletion(refreshed);

    if (isComplete) {
      await prisma.student.update({
        where: { id: refreshed.id },
        data: { profile_completed: true },
      });
      await prisma.profile.update({
        where: { id: profileId },
        data: { is_profile_completed: true },
      });
      refreshed.profile_completed = true;
    }

    return refreshed;
  }

  private checkProfileCompletion(student: any) {
    const p = student.profile;
    const required = [
      p.name, p.email, p.phone || student.phone_1,
      student.phone_2, student.aadhaar_number, student.college_name,
      student.roll_number, student.year_of_study, student.branch,
      student.temporary_address || student.permanent_address,
    ];
    return required.every(field => field !== null && field !== undefined && field !== "");
  }

  async requestReactivation(profileId: string, requestedBy: string) {
    const student = await prisma.student.findUnique({
      where: { profile_id: profileId },
      include: { profile: true },
    });

    if (!student) throw new Error("NOT_FOUND: Student record not found");
    if (student.status === "ACTIVE") throw new Error("BAD_REQUEST: Account is already active");
    if (!student.owner_id) throw new Error("BAD_REQUEST: Owner not linked for this student");

    // Check rate limit: 1 request per 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.reactivationRequest.findFirst({
      where: {
        student_id: student.id,
        created_at: { gte: cutoff },
      },
      orderBy: { created_at: "desc" },
    });

    if (recent) {
      throw new Error(`BAD_REQUEST: Reactivation request already sent recently. Status: ${recent.status}`);
    }

    const request = await prisma.reactivationRequest.create({
      data: {
        student_id: student.id,
        owner_id: student.owner_id,
        requested_by_profile_id: requestedBy,
        current_status: student.status,
        status: "PENDING",
      },
    });

    await eventSystem.trigger("reactivation_requested", {
      requestId: request.id,
      studentId: student.id,
      ownerId: student.owner_id,
      studentName: student.profile.name,
    });

    return request;
  }
}

export const studentService = new StudentService();
