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
            where: { is_active: true, end_date: null },
            include: { room: true },
          },
          obligations: {
            where: { status: { not: "WAIVED" } },
            include: { payments: true }
          }
        },
        take: limit,
        skip: offset,
        orderBy: { joined_on: "desc" },
      }),
      prisma.student.count({ where }),
    ]);

    const mappedStudents = students.map((s: any) => {
      let totalAmount = 0;
      let totalPaid = 0;
      let lastPaymentDate: string | Date | null = null;
      let lastPaymentAmount = 0;

      if (s.obligations) {
        s.obligations.forEach((o: any) => {
          totalAmount += Number(o.amount);
          o.payments.forEach((p: any) => {
             totalPaid += Number(p.amount_paid);
             if (!lastPaymentDate || new Date(p.payment_date) > new Date(lastPaymentDate)) {
                 lastPaymentDate = p.payment_date;
                 lastPaymentAmount = p.amount_paid;
             }
          });
        });
      }

      const pending_amount = totalAmount - totalPaid;
      let payment_status = "PENDING";
      if (pending_amount <= 0 && totalAmount > 0) payment_status = "PAID";
      else if (totalPaid > 0) payment_status = "PARTIAL";
      else if (totalAmount === 0) payment_status = "NOT_GENERATED";

      return {
        ...s,
        payment_summary: {
           total_amount: totalAmount,
           total_paid: totalPaid,
           pending_amount: Math.max(0, pending_amount),
           last_paid_at: lastPaymentDate,
           last_payment_amount: lastPaymentAmount,
           payment_status: payment_status
        }
      };
    });

    return { students: mappedStudents, total, limit, offset };
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

  async listReactivationRequests(ownerId: string) {
    const requests = await prisma.reactivationRequest.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: "desc" },
      include: {
        student: {
          include: {
            profile: true,
            allocations: {
              where: { is_active: true, end_date: null },
              include: { room: true }
            }
          }
        }
      }
    });

    return requests.map((req: any) => {
      const student = req.student;
      const profile = student.profile;
      const room = student.allocations[0]?.room;
      return {
        id: req.id,
        student_id: req.student.id,
        owner_id: req.owner_id,
        current_status: req.current_status,
        status: req.status,
        notes: req.notes,
        created_at: req.created_at,
        processed_at: req.processed_at,
        processed_by: req.processed_by,
        student_name: profile.name,
        student_email: profile.email,
        student_phone: profile.phone,
        room_no: room?.room_no || null
      };
    });
  }

  async processReactivationRequest(requestId: string, ownerId: string, action: string, notes?: string) {
    const request = await prisma.reactivationRequest.findFirst({
      where: { id: requestId, owner_id: ownerId }
    });

    if (!request) throw new Error("NOT_FOUND: Reactivation request not found");
    if (request.status !== "PENDING") throw new Error("VALIDATION: Request already processed");

    const actionNorm = action.toLowerCase();
    if (!["approve", "reject"].includes(actionNorm)) throw new Error("VALIDATION: Action must be approve or reject");

    const newStatus = actionNorm === "approve" ? "APPROVED" : "REJECTED";

    if (actionNorm === "approve") {
      await prisma.student.update({
        where: { id: request.student_id },
        data: { status: "ACTIVE" }
      });
      await eventSystem.trigger("student_reactivated", { studentId: request.student_id, userId: ownerId });
    }

    return await prisma.reactivationRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        notes: notes || null,
        processed_at: new Date(),
        processed_by: ownerId
      }
    });
  }
  async getOwnerTenantOverview(studentId: string, ownerId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        profile: true,
        allocations: {
          where: { is_active: true, end_date: null },
          include: { room: true },
        },
        obligations: {
          include: { payments: true }
        }
      }
    });

    if (!student) throw new Error("NOT_FOUND: Tenant not found");
    if (student.owner_id !== ownerId) {
      throw new Error("FORBIDDEN: You can only view your own tenants");
    }

    const currentRoom = student.allocations[0]?.room;
    
    // Calculate due and paid amounts
    let totalDue = 0;
    let totalPaid = 0;
    const allPayments: any[] = [];
    
    student.obligations.forEach((o: any) => {
      if (o.status !== "WAIVED") totalDue += Number(o.amount);
      const paid = o.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
      totalPaid += paid;
      o.payments.forEach((p: any) => allPayments.push(p));
    });

    const outstanding = totalDue - totalPaid;
    const recentPayments = allPayments
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        amount: Number(p.amount_paid),
        date: p.payment_date,
        method: p.payment_method,
        status: "paid",
        reference_number: p.reference_number
      }));

    let floor = "G";
    if (currentRoom?.room_no && currentRoom.room_no.length >= 3) {
      floor = currentRoom.room_no.substring(0, currentRoom.room_no.length - 2);
    }

    return {
      id: student.id,
      name: student.profile.name,
      phone: student.phone_1 || student.profile.phone,
      guardian_phone: student.phone_2 || student.profile.emergency_contact,
      email: student.profile.email,
      roll_number: student.roll_number,
      course: student.course,
      year_of_study: student.year_of_study,
      section: student.section,
      branch: student.branch,
      college_name: student.college_name,
      room_number: currentRoom?.room_no || null,
      floor: floor,
      joined_at: student.joined_on,
      status: student.status,
      rent: Number(student.monthly_rent),
      total_paid: totalPaid,
      total_due: totalDue,
      outstanding: outstanding,
      recent_payments: recentPayments
    };
  }

  async createStudent(data: any, ownerId: string) {
    // Note: Profile must be created first or linked.
    return await prisma.student.create({
      data: {
        ...data,
        owner_id: ownerId,
      },
      include: { profile: true },
    });
  }

  async updateStudent(id: string, data: any, ownerId: string) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new Error("NOT_FOUND: Student not found");
    if (student.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only update your own tenants");

    if (data.status === "LEFT") {
      // Auto-end active allocations if any exists
      await prisma.roomAllocation.updateMany({
        where: { student_id: id, is_active: true, end_date: null },
        data: { is_active: false, end_date: new Date() },
      });
    }

    return await prisma.student.update({
      where: { id },
      data,
      include: { profile: true },
    });
  }

  async deleteStudent(id: string, ownerId: string) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new Error("NOT_FOUND: Student not found");
    if (student.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only delete your own tenants");

    // Soft delete: status = LEFT
    await prisma.roomAllocation.updateMany({
      where: { student_id: id, is_active: true, end_date: null },
      data: { is_active: false, end_date: new Date() },
    });

    return await prisma.student.update({
      where: { id },
      data: { status: "LEFT" },
      include: { profile: true },
    });
  }

  async reactivateStudent(id: string, rent: number, joinedOn: Date, ownerId: string) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new Error("NOT_FOUND: Student not found");
    if (student.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only reactivate your own tenants");
    if (student.status !== "LEFT") throw new Error("VALIDATION: Only students with LEFT status can be reactivated");

    return await prisma.student.update({
      where: { id },
      data: {
        status: "ACTIVE",
        monthly_rent: rent,
        joined_on: joinedOn,
      },
      include: { profile: true },
    });
  }
}

export const studentService = new StudentService();
