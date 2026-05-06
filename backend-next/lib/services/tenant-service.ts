import { prisma } from "../db";
import { eventSystem } from "../events";
import { z } from "zod";
import { getPreferences } from "../preferences";
import { documentService } from "./document-service";
import { allocationReconciliationService } from "./allocation-reconciliation-service";
import { getLogger } from "../logger";

const logger = getLogger("tenant-service");

export class TenantService {
  async getTenantById(id: string, requestingUser: { sub: string; role: string }) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
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
        permanent_address: true,
        temporary_address: true,
        aadhaar_number: true,
        document_verified: true,
        created_at: true,
        updated_at: true,
        profile: true,
        allocations: {
          where: { is_active: true, end_date: null },
          orderBy: { start_date: "desc" },
          take: 1,
          include: { room: true },
        },
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");

    if (requestingUser.role === "TENANT" && tenant.profile_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own record");
    }

    const verification_badge = await documentService.getVerificationBadge(id);
    return { ...tenant, verification_badge };
  }

  async getTenantByProfile(profileId: string, requestingUser: { sub: string; role: string }) {
    const tenant = await prisma.tenant.findUnique({
      where: { profile_id: profileId },
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
        permanent_address: true,
        temporary_address: true,
        aadhaar_number: true,
        document_verified: true,
        created_at: true,
        updated_at: true,
        profile: true,
        allocations: {
          where: { is_active: true, end_date: null },
          orderBy: { start_date: "desc" },
          take: 1,
          include: { room: true },
        },
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");

    if (requestingUser.role === "TENANT" && profileId !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own record");
    }

    const verification_badge = await documentService.getVerificationBadge(tenant.id);
    return { ...tenant, verification_badge };
  }

  async getAllTenants(params: {
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

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
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
      prisma.tenant.count({ where }),
    ]);

    const mappedTenants = tenants.map((s: any) => {
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

    return { tenants: mappedTenants, total, limit, offset };
  }

  async updateTenantSelfProfile(profileId: string, data: any, updatedBy: string) {
    const tenantCheck = await prisma.tenant.findUnique({
      where: { profile_id: profileId },
      select: { id: true, owner_id: true },
    });

    if (!tenantCheck) throw new Error("NOT_FOUND: Tenant record not found");

    // ── Enforce allow_tenant_edits preference ──
    if (tenantCheck.owner_id) {
      const prefs = await getPreferences(tenantCheck.owner_id);
      if (prefs.allow_tenant_edits === false) {
        throw new Error("FORBIDDEN: Profile editing is currently disabled by the hostel owner");
      }
    }

    const profileFields = ["name", "email", "phone", "emergency_contact"];
    const tenantFields = [
      "photo_url", "phone_1", "phone_2", "phone_3", "aadhaar_number", "personal_email",
      "college_name", "roll_number", "course", "year_of_study", "section", "branch",
      "temporary_address", "permanent_address", "gender", "profile_type",
      "office_name", "office_location", "job_role", "date_of_birth"
    ];

    const profileUpdate: any = {};
    const tenantUpdate: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (profileFields.includes(key)) profileUpdate[key] = value;
      else if (tenantFields.includes(key)) tenantUpdate[key] = value;
    }

    if (tenantUpdate.gender === "Prefer not to say") {
      tenantUpdate.gender = null;
    }

    // Sanitize aadhaar: empty string or null → skip (don't overwrite existing value with blank)
    if ("aadhaar_number" in tenantUpdate && !tenantUpdate.aadhaar_number) {
      delete tenantUpdate.aadhaar_number;
    }

    // Legacy address mapping
    if (data.address) {
      tenantUpdate.temporary_address = data.address;
      tenantUpdate.permanent_address = data.address;
    }
    if (typeof data.profile_type === "string") {
      const raw = String(data.profile_type).trim().toUpperCase();
      if (raw === "WORKING_PROFESSIONAL" || raw === "STUDENT") {
        tenantUpdate.profile_type = raw;
      } else {
        throw new Error("VALIDATION: profile_type must be STUDENT or WORKING_PROFESSIONAL");
      }
    }
    await prisma.$transaction(async (tx) => {
      if (Object.keys(profileUpdate).length > 0) {
        await tx.profile.update({
          where: { id: profileId },
          data: profileUpdate,
        });
      }

      if (Object.keys(tenantUpdate).length > 0) {
        try {
          await tx.tenant.update({
            where: { profile_id: profileId },
            data: tenantUpdate,
          });
        } catch (error: any) {
          const code = (error as any)?.code;
          const msg = String(error?.message || error);
          if (code === "P2002" || msg.includes("aadhaar_number")) {
            throw new Error("VALIDATION: This Aadhaar number is already registered with another account.");
          }
          if (msg.includes("tenants.gender") && Object.prototype.hasOwnProperty.call(tenantUpdate, "gender")) {
            delete tenantUpdate.gender;
            await tx.tenant.update({
              where: { profile_id: profileId },
              data: tenantUpdate,
            });
          } else {
            throw error;
          }
        }
      }

      const current = await tx.tenant.findUnique({
        where: { profile_id: profileId },
        select: {
          id: true,
          profile_completed: true,
          phone_1: true,
          phone_2: true,
          aadhaar_number: true,
          college_name: true,
          roll_number: true,
          year_of_study: true,
          branch: true,
          temporary_address: true,
          permanent_address: true,
          profile: {
            select: {
              name: true,
              email: true,
              phone: true,
              emergency_contact: true
            }
          }
        }
      });

      if (!current) throw new Error("NOT_FOUND: Tenant record not found");

      const isComplete = this.checkProfileCompletion(current);
      if (isComplete) {
        await tx.tenant.update({
          where: { id: current.id },
          data: { profile_completed: true },
        });
        await tx.profile.update({
          where: { id: profileId },
          data: { is_profile_completed: true },
        });
      }
    });

    return this.getTenantByProfile(profileId, { sub: profileId, role: "TENANT" });
  }

  private checkProfileCompletion(tenant: any) {
    const p = tenant.profile;
    const required = [
      p.name, p.email, p.phone || tenant.phone_1,
      p.emergency_contact, tenant.aadhaar_number, tenant.college_name,
      tenant.roll_number, tenant.year_of_study, tenant.branch,
      tenant.temporary_address || tenant.permanent_address,
    ];
    return required.every(field => field !== null && field !== undefined && field !== "");
  }

  async requestReactivation(profileId: string, requestedBy: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { profile_id: profileId },
      include: { profile: true },
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");
    if (tenant.status === "ACTIVE") throw new Error("BAD_REQUEST: Account is already active");
    if (!tenant.owner_id) throw new Error("BAD_REQUEST: Owner not linked for this tenant");

    // Check rate limit: 1 request per 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.reactivationRequest.findFirst({
      where: {
        tenant_id: tenant.id,
        created_at: { gte: cutoff },
      },
      orderBy: { created_at: "desc" },
    });

    if (recent) {
      throw new Error(`BAD_REQUEST: Reactivation request already sent recently. Status: ${recent.status}`);
    }

    const request = await prisma.reactivationRequest.create({
      data: {
        tenant_id: tenant.id,
        owner_id: tenant.owner_id,
        requested_by_profile_id: requestedBy,
        current_status: tenant.status,
        status: "PENDING",
      },
    });

    await eventSystem.trigger("reactivation_requested", {
      requestId: request.id,
      tenantId: tenant.id,
      ownerId: tenant.owner_id,
      tenantName: tenant.profile.name,
    });

    return request;
  }

  async listReactivationRequests(ownerId: string) {
    const requests = await prisma.reactivationRequest.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: "desc" },
      include: {
        tenant: {
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
      const tenant = req.tenant;
      const profile = tenant.profile;
      const room = tenant.allocations[0]?.room;
      return {
        id: req.id,
        tenant_id: req.tenant.id,
        owner_id: req.owner_id,
        current_status: req.current_status,
        status: req.status,
        notes: req.notes,
        created_at: req.created_at,
        processed_at: req.processed_at,
        processed_by: req.processed_by,
        tenant_name: profile.name,
        tenant_email: profile.email,
        tenant_phone: profile.phone,
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
      await prisma.tenant.update({
        where: { id: request.tenant_id },
        data: { status: "ACTIVE" }
      });
      await eventSystem.trigger("tenant_reactivated", { tenantId: request.tenant_id, userId: ownerId });
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
  async getOwnerTenantOverview(tenantId: string, ownerId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
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

    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) {
      throw new Error("FORBIDDEN: You can only view your own tenants");
    }

    const currentRoom = tenant.allocations[0]?.room;
    
    // Calculate due and paid amounts
    let totalDue = 0;
    let totalPaid = 0;
    const allPayments: any[] = [];
    
    tenant.obligations.forEach((o: any) => {
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

    const floor = currentRoom?.floor ?? null;

    return {
      id: tenant.id,
      name: tenant.profile.name,
      phone: tenant.phone_1 || tenant.profile.phone,
      guardian_phone: tenant.phone_2 || tenant.profile.emergency_contact,
      email: tenant.profile.email,
      roll_number: tenant.roll_number,
      course: tenant.course,
      year_of_study: tenant.year_of_study,
      section: tenant.section,
      branch: tenant.branch,
      college_name: tenant.college_name,
      room_number: currentRoom?.room_no || null,
      floor: floor,
      joined_at: tenant.joined_on,
      status: tenant.status,
      rent: Number(tenant.monthly_rent),
      total_paid: totalPaid,
      total_due: totalDue,
      outstanding: outstanding,
      recent_payments: recentPayments
    };
  }

  async createTenant(data: any, ownerId: string) {
    // Note: Profile must be created first or linked.
    return await prisma.tenant.create({
      data: {
        ...data,
        owner_id: ownerId,
      },
      include: { profile: true },
    });
  }

  async updateTenant(id: string, data: any, ownerId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, owner_id: true, status: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only update your own tenants");

    if (data.status === "LEFT") {
      // Auto-end active allocations if any exists
      await prisma.roomAllocation.updateMany({
        where: { tenant_id: id, is_active: true, end_date: null },
        data: { is_active: false, end_date: new Date() },
      });
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data,
      include: { profile: true },
    });
    if (typeof data.status !== "undefined") {
      await allocationReconciliationService.reconcileTenant(id).catch((err: any) => {
        logger.error("reconcile_after_tenant_update_failed", {
          tenant_id: id,
          new_status: data.status,
          error: String(err?.message || err),
        });
      });
    }
    return updated;
  }

  async deleteTenant(id: string, ownerId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, owner_id: true, status: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only delete your own tenants");

    // Soft delete: status = LEFT
    await prisma.roomAllocation.updateMany({
      where: { tenant_id: id, is_active: true, end_date: null },
      data: { is_active: false, end_date: new Date() },
    });

    const updated = await prisma.tenant.update({
      where: { id },
      data: { status: "LEFT" },
      include: { profile: true },
    });
    await allocationReconciliationService.reconcileTenant(id).catch((err: any) => {
      logger.error("reconcile_after_tenant_delete_failed", {
        tenant_id: id,
        error: String(err?.message || err),
      });
    });
    return updated;
  }

  async reactivateTenant(id: string, rent: number, joinedOn: Date, ownerId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, owner_id: true, status: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only reactivate your own tenants");
    if (tenant.status !== "LEFT") throw new Error("VALIDATION: Only tenants with LEFT status can be reactivated");

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        status: "ACTIVE",
        monthly_rent: rent,
        joined_on: joinedOn,
      },
      include: { profile: true },
    });
    await allocationReconciliationService.reconcileTenant(id).catch((err: any) => {
      logger.error("reconcile_after_tenant_reactivate_failed", {
        tenant_id: id,
        error: String(err?.message || err),
      });
    });
    return updated;
  }
}

export const tenantService = new TenantService();
