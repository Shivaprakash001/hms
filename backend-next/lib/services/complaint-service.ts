import { prisma } from "../db";
import { eventSystem } from "../events";

export class ComplaintService {
  async getStudentComplaints(studentId: string) {
    return prisma.complaint.findMany({
      where: { student_id: studentId },
      orderBy: { created_at: "desc" }
    });
  }

  async getOwnerComplaints(ownerId: string, status?: string) {
    return prisma.complaint.findMany({
      where: { 
        owner_id: ownerId,
        ...(status && { status })
      },
      include: {
        student: {
          include: { profile: true }
        }
      },
      orderBy: { created_at: "desc" }
    });
  }

  async createComplaint(data: {
    student_id: string;
    title: string;
    description: string;
    category: string;
    priority?: string;
  }) {
    // Security: Fetch the correct owner_id for this student from DB
    const student = await prisma.student.findUnique({
      where: { id: data.student_id },
      select: { owner_id: true }
    });

    if (!student || !student.owner_id) {
      throw new Error("UNAUTHORIZED: Student not found or has no owner linked");
    }

    const complaint = await prisma.complaint.create({
      data: {
        ...data,
        owner_id: student.owner_id,
        status: "PENDING"
      }
    });

    await eventSystem.trigger("complaint_created", {
      complaint_id: complaint.id,
      student_id: data.student_id,
      owner_id: student.owner_id
    });

    return complaint;
  }


  async updateComplaintStatus(complaintId: string, ownerId: string, data: {
    status: string;
    comment?: string;
  }) {
    const updateData: any = { 
      status: data.status,
      comment: data.comment
    };

    if (data.status === "RESOLVED") {
      updateData.resolved_at = new Date();
    }

    const complaint = await prisma.complaint.update({
      where: { id: complaintId, owner_id: ownerId },
      data: updateData
    });

    await eventSystem.trigger("complaint_updated", {
      complaint_id: complaint.id,
      status: data.status
    });

    return complaint;
  }
}

export const complaintService = new ComplaintService();
