import { prisma } from "../db";
import { eventSystem } from "../events";

export class ComplaintService {
  async getTenantComplaints(tenantId: string) {
    return prisma.complaint.findMany({
      where: { tenant_id: tenantId },
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
        tenant: {
          include: { profile: true }
        }
      },
      orderBy: { created_at: "desc" }
    });
  }

  async createComplaint(data: {
    tenant_id: string;
    title: string;
    description: string;
    category: string;
    priority?: string;
  }) {
    // Security: Fetch the correct owner_id for this tenant from DB
    const tenant = await prisma.tenant.findUnique({
      where: { id: data.tenant_id },
      select: { owner_id: true }
    });

    if (!tenant || !tenant.owner_id) {
      throw new Error("UNAUTHORIZED: Tenant not found or has no owner linked");
    }

    const complaint = await prisma.complaint.create({
      data: {
        ...data,
        owner_id: tenant.owner_id,
        status: "PENDING"
      }
    });

    await eventSystem.trigger("complaint_created", {
      complaint_id: complaint.id,
      tenant_id: data.tenant_id,
      owner_id: tenant.owner_id
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
