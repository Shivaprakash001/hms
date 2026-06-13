import { prisma } from "../../../lib/db";
import { eventSystem } from "../../../lib/events";
import { z } from "zod";
import { getTenantOperationalContext } from "../../../lib/hostel-context";
import { authOtpService } from "../../../lib/services/auth/auth-otp-service";
import { normalizeWhatsAppPhone } from "../../../lib/services/notifications/providers/whatsapp/meta-provider";

import { allocationReconciliationService } from "../../../lib/services/allocation-reconciliation-service";
import { financialService } from "../../../src/services/payments/financial-service";
import { getLogger } from "../../../lib/logger";
import { eventLog } from "../../../lib/services/event-log-service";
import { imagekit } from "../../../lib/imagekit";
import { tenantRepository } from "../../repositories/tenantRepository";
import { assertCapability } from "../../../lib/services/move-out-service";

const logger = getLogger("tenant-service");

export class TenantService {
  private withLegacyTenantRelations(tenant: any) {
    if (!tenant) return tenant;
    const invitation = tenant.tenant_invitations?.[0] || null;
    const fallbackProfile = tenant.profile ?? tenant.profiles ?? (invitation
      ? { id: null, name: invitation.name, email: invitation.email, phone: invitation.phone }
      : null);
    const activeMoveOut = tenant.move_out_requests?.find((r: any) => r.status !== "COMPLETED" && r.status !== "REJECTED");
    const hasActiveMoveOut = !!activeMoveOut;
    const hasFutureExit = tenant.exit_date && new Date(tenant.exit_date).getTime() > new Date().getTime();
    const computedStatus = (hasActiveMoveOut || hasFutureExit) ? "MOVE_OUT_REQUESTED" : tenant.status;
    return {
      ...tenant,
      status: computedStatus,
      profile: fallbackProfile,
      profiles: tenant.profiles ?? fallbackProfile,
      allocations: tenant.allocations ?? tenant.room_allocations ?? [],
      obligations: tenant.obligations ?? tenant.rent_obligations ?? [],
    };
  }

  async getTenantById(id: string, requestingUser: { sub: string; role: string }) {
    const tenant = await tenantRepository.findUnique({
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
        created_at: true,
        updated_at: true,
        profiles: true,
        tenant_invitations: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: { name: true, email: true, phone: true, status: true },
        },
        room_allocations: {
          where: { is_active: true, end_date: null },
          orderBy: { start_date: "desc" },
          take: 1,
          include: { room: true },
        },
        move_out_requests: {
          where: { status: { notIn: ["COMPLETED", "REJECTED"] } },
          orderBy: { created_at: "desc" },
          take: 1,
          select: { id: true, status: true }
        },
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");

    if (requestingUser.role === "TENANT" && tenant.profile_id !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own record");
    }
    if (requestingUser.role === "OWNER" && tenant.owner_id !== requestingUser.sub) {
      await eventLog.log("OWNER_SCOPE_VIOLATION", requestingUser.sub, {
        entity_type: "Tenant",
        entity_id: id,
        attempted_owner_id: tenant.owner_id,
      });
      throw new Error("FORBIDDEN: You can only view your own tenants");
    }


    return { ...this.withLegacyTenantRelations(tenant), verification_badge: null };
  }

  async getTenantByProfile(profileId: string, requestingUser: { sub: string; role: string }) {
    const tenant = await tenantRepository.findUnique({
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
        created_at: true,
        updated_at: true,
        profiles: true,
        tenant_invitations: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: { name: true, email: true, phone: true, status: true },
        },
        room_allocations: {
          where: { is_active: true, end_date: null },
          orderBy: { start_date: "desc" },
          take: 1,
          include: { room: true },
        },
        move_out_requests: {
          where: { status: { notIn: ["COMPLETED", "REJECTED"] } },
          orderBy: { created_at: "desc" },
          take: 1,
          select: { id: true, status: true }
        },
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");

    if (requestingUser.role === "TENANT" && profileId !== requestingUser.sub) {
      throw new Error("FORBIDDEN: You can only view your own record");
    }
    if (requestingUser.role === "OWNER" && tenant.owner_id !== requestingUser.sub) {
      await eventLog.log("OWNER_SCOPE_VIOLATION", requestingUser.sub, {
        entity_type: "Tenant",
        entity_id: tenant.id,
        attempted_owner_id: tenant.owner_id,
      });
      throw new Error("FORBIDDEN: You can only view your own tenants");
    }


    return { ...this.withLegacyTenantRelations(tenant), verification_badge: null };
  }

  async getAllTenants(params: {
    status?: string;
    search?: string;
    ownerId?: string;
    hostelId: string; // URL-driven hostel isolation
    limit?: number;
    offset?: number;
  }) {
    const { status, search, ownerId, hostelId, limit = 50, offset = 0 } = params;

    const where: any = {
      ...(ownerId && { owner_id: ownerId }),
      ...(hostelId && { hostel_id: hostelId }),
    };

    if (status) {
      if (status === "MOVE_OUT_REQUESTED") {
        where.move_out_requests = {
          some: {
            status: {
              in: [
                "REQUESTED",
                "SETTLEMENT_PENDING",
                "SETTLEMENT_APPROVED",
                "PHYSICALLY_VACATED",
                "SETTLEMENT_PENDING_PAYMENT",
                "APPROVED",
                "VACATED",
              ],
            },
          }
        };
      } else {
        where.status = status as any;
      }
    }

    if (search) {
      where.OR = [
        { profiles: { name: { contains: search, mode: "insensitive" } } },
        { profiles: { email: { contains: search, mode: "insensitive" } } },
        { tenant_invitations: { some: { name: { contains: search, mode: "insensitive" } } } },
        { tenant_invitations: { some: { email: { contains: search, mode: "insensitive" } } } },
        { roll_number: { contains: search, mode: "insensitive" } },
      ];
    }

    const [tenants, total] = await Promise.all([
      tenantRepository.findMany({
        where,
        include: {
          profiles: true,
          tenant_invitations: {
            orderBy: { created_at: "desc" },
            take: 1,
            select: { name: true, email: true, phone: true, status: true },
          },
          room_allocations: {
            where: { is_active: true, end_date: null },
            include: { room: true },
          },
          rent_obligations: {
            where: { status: { in: ["PENDING", "PARTIAL"] } },
            include: { payments: { select: { amount_paid: true, payment_date: true } } }
          },
          move_out_requests: {
            where: { status: { notIn: ["COMPLETED", "REJECTED"] } },
            orderBy: { created_at: "desc" },
            take: 1,
            select: { id: true, status: true }
          }
        },
        take: limit,
        skip: offset,
        orderBy: { joined_on: "desc" },
      }),
      tenantRepository.count({ where }),
    ]);

    const mappedTenants = tenants.map((s: any) => {
      const tenant = this.withLegacyTenantRelations(s);
      const summary = financialService.getTenantPaymentSummary(tenant.id, tenant.obligations ?? []);
      const firstAllocation = tenant.room_allocations?.[0];
      const firstObligation = (tenant.obligations ?? [])[0];
      return {
        ...tenant,
        payment_summary: summary,
        // Denormalized top-level fields consumed by the frontend
        name: tenant.profiles?.name ?? null,
        email: tenant.profiles?.email ?? null,
        phone: tenant.profiles?.phone ?? tenant.phone_1 ?? null,
        room_no: firstAllocation?.room?.room_no ?? null,
        room_number: firstAllocation?.room?.room_no ?? null,
        payment_status: summary.payment_status,
        outstanding_amount: summary.pending_amount,
        due_date: firstObligation?.due_date ?? null,
        obligation_id: firstObligation?.id ?? null,
      };
    });

    return { tenants: mappedTenants, total, limit, offset };
  }

  async updateTenantSelfProfile(profileId: string, data: any, updatedBy: string) {
    const tenantCheck = await tenantRepository.findUnique({
      where: { profile_id: profileId },
      select: { id: true, owner_id: true, hostel_id: true },
    });

    if (!tenantCheck) throw new Error("NOT_FOUND: Tenant record not found");

    await assertCapability(tenantCheck.id, "EDIT_PROFILE");

    // ── Enforce allow_tenant_edits preference ──
    if (tenantCheck.owner_id) {
      // Phase 2: resolve from tenant's hostel, not findFirst(owner_id)
      const { prefs } = await getTenantOperationalContext(tenantCheck.id, tenantCheck.owner_id, tenantCheck.hostel_id);
      if (prefs.allow_tenant_edits === false) {
        throw new Error("FORBIDDEN: Profile editing is currently disabled by the hostel owner");
      }
    }

    const profileFields = ["name", "email", "phone", "emergency_contact", "city", "state", "pincode"];
    const tenantFields = [
      "photo_url", "phone_1", "phone_2", "phone_3", "personal_email",
      "college_name", "roll_number", "course", "year_of_study", "section", "branch",
      "temporary_address", "permanent_address", "gender", "profile_type",
      "office_name", "office_location", "job_role", "date_of_birth"
    ];

    const profileUpdate: any = {};
    const tenantUpdate: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (profileFields.includes(key)) {
        profileUpdate[key] = value;
      } else if (tenantFields.includes(key)) {
        if (key === "date_of_birth") {
          tenantUpdate[key] = value ? new Date(value as string) : null;
        } else {
          tenantUpdate[key] = value;
        }
      }
    }

    // Synchronize duplicates across profile and tenant tables
    const syncedPhone = data.phone_1 || data.phone;
    if (syncedPhone) {
      profileUpdate.phone = syncedPhone;
      tenantUpdate.phone_1 = syncedPhone;
    }
    const syncedEmergency = data.phone_3 || data.emergency_contact;
    if (syncedEmergency) {
      profileUpdate.emergency_contact = syncedEmergency;
      tenantUpdate.phone_3 = syncedEmergency;
    }
    const syncedGuardian = data.phone_2 || data.guardian_phone;
    if (syncedGuardian) {
      tenantUpdate.phone_2 = syncedGuardian;
      tenantUpdate.guardian_phone = syncedGuardian;
    }

    // Fetch current state to verify if phone numbers changed
    const current = await tenantRepository.findUnique({
      where: { id: tenantCheck.id },
      include: { profiles: true },
    });
    if (!current) throw new Error("NOT_FOUND: Tenant record not found");

    const oldPrimary = (current.profiles?.phone || current.phone_1 || "").trim();
    const newPrimary = (syncedPhone || "").trim();
    if (newPrimary && oldPrimary) {
      try {
        const normOld = normalizeWhatsAppPhone(oldPrimary);
        const normNew = normalizeWhatsAppPhone(newPrimary);
        if (normOld !== normNew) {
          // Check if OTP was already verified by the frontend (status: VERIFIED)
          const alreadyVerified = await prisma.phoneVerificationOtp.findFirst({
            where: {
              phone: normNew,
              purpose: "ProfileUpdate",
              status: "VERIFIED",
              verified_at: { gte: new Date(Date.now() - 15 * 60 * 1000) },
            },
            orderBy: { verified_at: "desc" },
          });

          if (!alreadyVerified) {
            const otp = data.phone_1_otp || data.phone_otp;
            if (!otp) {
              throw new Error("VALIDATION_ERROR: Verification code is required to update your primary phone number");
            }
            await authOtpService.verifyPhoneOtp({
              phone: normNew,
              otp,
              purpose: "ProfileUpdate",
              requestIp: null,
            });
          }
        }
      } catch (err: any) {
        if (err.message?.includes("VALIDATION_ERROR")) throw err;
        throw new Error(`VALIDATION_ERROR: Primary phone verification failed: ${err.message || "Invalid or expired code"}`);
      }
    }

    const oldPhone2 = (current.phone_2 || current.guardian_phone || "").trim();
    const newPhone2 = (syncedGuardian || "").trim();
    if (newPhone2) {
      try {
        const normOld = oldPhone2 ? normalizeWhatsAppPhone(oldPhone2) : "";
        const normNew = normalizeWhatsAppPhone(newPhone2);
        if (normOld !== normNew) {
          // Check if OTP was already verified by the frontend (status: VERIFIED)
          const alreadyVerified = await prisma.phoneVerificationOtp.findFirst({
            where: {
              phone: normNew,
              purpose: "ProfileUpdate",
              status: "VERIFIED",
              verified_at: { gte: new Date(Date.now() - 15 * 60 * 1000) },
            },
            orderBy: { verified_at: "desc" },
          });

          if (!alreadyVerified) {
            // Fallback: try to verify OTP inline (e.g. if frontend didn't pre-verify)
            const otp = data.phone_2_otp || data.guardian_otp;
            if (!otp) {
              throw new Error("VALIDATION_ERROR: Verification code is required to update the parent/guardian phone number");
            }
            await authOtpService.verifyPhoneOtp({
              phone: normNew,
              otp,
              purpose: "ProfileUpdate",
              requestIp: null,
            });
          }
        }
      } catch (err: any) {
        if (err.message?.includes("VALIDATION_ERROR")) throw err;
        throw new Error(`VALIDATION_ERROR: Parent/Guardian phone verification failed: ${err.message || "Invalid or expired code"}`);
      }
    }

    const oldPhone3 = (current.phone_3 || current.profiles?.emergency_contact || "").trim();
    const newPhone3 = (syncedEmergency || "").trim();
    if (newPhone3) {
      try {
        const normOld = oldPhone3 ? normalizeWhatsAppPhone(oldPhone3) : "";
        const normNew = normalizeWhatsAppPhone(newPhone3);
        if (normOld !== normNew) {
          // Check if OTP was already verified by the frontend (status: VERIFIED)
          const alreadyVerified = await prisma.phoneVerificationOtp.findFirst({
            where: {
              phone: normNew,
              purpose: "ProfileUpdate",
              status: "VERIFIED",
              verified_at: { gte: new Date(Date.now() - 15 * 60 * 1000) },
            },
            orderBy: { verified_at: "desc" },
          });

          if (!alreadyVerified) {
            const otp = data.phone_3_otp || data.emergency_otp;
            if (!otp) {
              throw new Error("VALIDATION_ERROR: Verification code is required to update the emergency contact phone number");
            }
            await authOtpService.verifyPhoneOtp({
              phone: normNew,
              otp,
              purpose: "ProfileUpdate",
              requestIp: null,
            });
          }
        }
      } catch (err: any) {
        if (err.message?.includes("VALIDATION_ERROR")) throw err;
        throw new Error(`VALIDATION_ERROR: Emergency contact phone verification failed: ${err.message || "Invalid or expired code"}`);
      }
    }

    if (tenantUpdate.gender === "Prefer not to say") {
      tenantUpdate.gender = null;
    }

    // Aadhaar is now stored in identification_documents table, not on tenant record

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

    // Intercept Base64 profile photo and upload to ImageKit
    if (tenantUpdate.photo_url && tenantUpdate.photo_url.startsWith("data:image")) {
      try {
        const upload = await imagekit.files.upload({
          file: tenantUpdate.photo_url,
          fileName: `profile_${profileId}.jpg`,
          folder: `owners/${tenantCheck.owner_id}/tenants/${tenantCheck.id}/documents/PROFILE_PHOTO`,
          useUniqueFileName: true,
          tags: ["PROFILE_PHOTO", tenantCheck.id],
        });
        tenantUpdate.photo_url = upload.url;
      } catch (err: any) {
        logger.error("profile_photo_upload_failed", { error: err?.message, tenant_id: tenantCheck.id });
        delete tenantUpdate.photo_url; // Don't save the massive base64 string
      }
    }

    await prisma.$transaction(async (tx: any) => {
      if (Object.keys(profileUpdate).length > 0) {
        await tx.profile.update({
          where: { id: profileId },
          data: profileUpdate,
        });
      }

      if (Object.keys(tenantUpdate).length > 0) {
        try {
          await tx.tenants.update({
            where: { profile_id: profileId },
            data: tenantUpdate,
          });
        } catch (error: any) {
          const code = (error as any)?.code;
          const msg = String(error?.message || error);
          if (code === "P2002") {
            throw new Error("VALIDATION: This record violates a unique constraint.");
          }
          if (msg.includes("tenants.gender") && Object.prototype.hasOwnProperty.call(tenantUpdate, "gender")) {
            delete tenantUpdate.gender;
            await tx.tenants.update({
              where: { profile_id: profileId },
              data: tenantUpdate,
            });
          } else {
            throw error;
          }
        }
      }

      const current = await tx.tenants.findUnique({
        where: { profile_id: profileId },
        select: {
          id: true,
          profile_completed: true,
          phone_1: true,
          phone_2: true,
          college_name: true,
          roll_number: true,
          year_of_study: true,
          branch: true,
          temporary_address: true,
          permanent_address: true,
          profiles: {
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
        await tx.tenants.update({
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
    const p = tenant.profile ?? tenant.profiles;
    const isWorkingProf = String(tenant.profile_type || "").trim().toUpperCase() === "WORKING_PROFESSIONAL";

    const required = [
      p.name,
      p.email,
      p.phone || tenant.phone_1,
      p.emergency_contact,
      tenant.permanent_address,
    ];

    if (isWorkingProf) {
      required.push(
        tenant.office_name,
        tenant.job_role,
        tenant.office_location
      );
    } else {
      required.push(
        tenant.college_name,
        tenant.roll_number,
        tenant.year_of_study,
        tenant.branch
      );
    }

    return required.every(field => field !== null && field !== undefined && String(field).trim() !== "");
  }

  async requestReactivation(profileId: string, requestedBy: string) {
    const tenant = await tenantRepository.findUnique({
      where: { profile_id: profileId },
      include: { profiles: true },
    });
    const legacyTenant = this.withLegacyTenantRelations(tenant);

    if (!legacyTenant) throw new Error("NOT_FOUND: Tenant record not found");
    if (legacyTenant.status === "ACTIVE") throw new Error("BAD_REQUEST: Account is already active");
    if (!legacyTenant.owner_id) throw new Error("BAD_REQUEST: Owner not linked for this tenant");

    // Check rate limit: 1 request per 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.reactivation_requests.findFirst({
      where: {
        tenant_id: legacyTenant.id,
        created_at: { gte: cutoff },
      },
      orderBy: { created_at: "desc" },
    });

    if (recent) {
      throw new Error(`BAD_REQUEST: Reactivation request already sent recently. Status: ${recent.status}`);
    }

    const request = await prisma.reactivation_requests.create({
      data: {
        tenant_id: legacyTenant.id,
        owner_id: legacyTenant.owner_id,
        requested_by_profile_id: requestedBy,
        current_status: legacyTenant.status,
        status: "PENDING",
      },
    });

    await eventSystem.trigger("reactivation_requested", {
      requestId: request.id,
      tenantId: legacyTenant.id,
      ownerId: legacyTenant.owner_id,
      tenantName: legacyTenant.profile.name,
    });

    return request;
  }

  async listReactivationRequests(ownerId: string) {
    const requests = await prisma.reactivation_requests.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: "desc" },
      include: {
        tenants: {
          include: {
            profiles: true,
            room_allocations: {
              where: { is_active: true, end_date: null },
              include: { room: true }
            }
          }
        }
      }
    });

    return requests.map((req: any) => {
      const tenant = this.withLegacyTenantRelations(req.tenants);
      const profile = tenant.profile;
      const room = tenant.allocations[0]?.room;
      return {
        id: req.id,
        tenant_id: tenant.id,
        owner_id: req.owner_id,
        current_status: req.current_status,
        status: req.status,
        notes: req.notes,
        created_at: req.created_at,
        processed_at: req.processed_at,
        processed_by: req.processed_by,
        tenant_name: profile?.name ?? tenant.name ?? "Tenant",
        tenant_email: profile?.email ?? "",
        tenant_phone: profile?.phone ?? tenant.phone_1 ?? "",
        room_no: room?.room_no || null
      };
    });
  }

  async processReactivationRequest(requestId: string, ownerId: string, action: string, notes?: string) {
    const request = await prisma.reactivation_requests.findFirst({
      where: { id: requestId, owner_id: ownerId }
    });

    if (!request) throw new Error("NOT_FOUND: Reactivation request not found");
    if (request.status !== "PENDING") throw new Error("VALIDATION: Request already processed");

    const actionNorm = action.toLowerCase();
    if (!["approve", "reject"].includes(actionNorm)) throw new Error("VALIDATION: Action must be approve or reject");

    const newStatus = actionNorm === "approve" ? "APPROVED" : "REJECTED";

    if (actionNorm === "approve") {
      await prisma.tenants.update({
        where: { id: request.tenant_id },
        data: { status: "ACTIVE" }
      });
      await eventSystem.trigger("tenant_reactivated", { tenantId: request.tenant_id, userId: ownerId });
    }

    return await prisma.reactivation_requests.update({
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
    const tenant = await tenantRepository.findFirst({
      where: { id: tenantId, owner_id: ownerId },
      include: {
        profiles: true,
        tenant_invitations: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
        move_out_requests: {
          where: { status: { notIn: ["COMPLETED", "REJECTED"] } },
          orderBy: { created_at: "desc" },
          take: 1,
        },
        room_allocations: {
          where: { is_active: true, end_date: null },
          include: { room: true },
        },
        rent_obligations: {
          where: { status: { in: ["PENDING", "PARTIAL"] } },
          include: { payments: { select: { amount_paid: true, payment_date: true, payment_method: true, reference_number: true } } }
        },
        identification_documents: {
          where: { is_active: true },
          orderBy: { created_at: "desc" },
        },
        rule_acceptances: {
          orderBy: { accepted_at: "desc" },
          take: 1,
          include: { rule_version: true },
        },
      }
    });

    const legacyTenant = this.withLegacyTenantRelations(tenant);

    if (!legacyTenant) throw new Error("NOT_FOUND: Tenant not found");

    const currentRoom = legacyTenant.allocations[0]?.room;

    if (!legacyTenant.hostel_id) throw new Error("HOSTEL_CONTEXT_REQUIRED: tenant hostel scope unavailable");
    const dues = await financialService.getTenantDues(tenantId, ownerId, legacyTenant.hostel_id);
    const paymentAgg = await prisma.payments.aggregate({
      where: { tenant_id: tenantId, owner_id: ownerId, hostel_id: legacyTenant.hostel_id },
      _sum: { amount_paid: true },
    });
    const totalPaid = Number(paymentAgg._sum.amount_paid || 0);
    const totalDue = dues.total_due;
    const outstanding = dues.total_due;
    const overdueAmount = (dues.items || []).reduce((sum: number, item: any) => {
      const dueDate = item.due_date ? new Date(item.due_date) : null;
      if (!dueDate || dueDate.getTime() >= Date.now()) return sum;
      return sum + Number(item.outstanding || 0);
    }, 0);
    const advanceEntries = await prisma.tenant_advance_ledger.findMany({
      where: { tenant_id: tenantId, owner_id: ownerId },
      orderBy: { created_at: "asc" },
    });
    const advanceBalance = advanceEntries.reduce((acc: number, entry: any) => {
      const amount = Number(entry.amount || 0);
      return entry.type === "CREDIT" ? acc + amount : acc - amount;
    }, 0);
    const allPayments = await prisma.payments.findMany({
      where: { tenant_id: tenantId, owner_id: ownerId, hostel_id: legacyTenant.hostel_id },
      orderBy: { payment_date: "desc" },
      take: 25,
      select: {
        id: true,
        amount_paid: true,
        payment_date: true,
        payment_method: true,
        reference_number: true,
      },
    });
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
    const latestRuleAcceptance = legacyTenant.rule_acceptances?.[0] ?? null;
    const requiredDocumentTypes = String(legacyTenant.profile_type || "STUDENT").toUpperCase() === "WORKING_PROFESSIONAL"
      ? ["AADHAAR", "WORK_ID"]
      : ["AADHAAR", "COLLEGE_ID"];
    const activeDocuments = (legacyTenant.identification_documents ?? []).filter((doc: any) => requiredDocumentTypes.includes(doc.doc_type));

    return {
      id: legacyTenant.id,
      name: legacyTenant.profile?.name ?? legacyTenant.name ?? "Tenant",
      photo_url: legacyTenant.photo_url,
      phone: legacyTenant.phone_1 || legacyTenant.profile?.phone || "",
      guardian_name: legacyTenant.guardian_name,
      guardian_phone: legacyTenant.phone_2 || legacyTenant.profile?.emergency_contact || "",
      guardian_relation: legacyTenant.guardian_relation,
      email: legacyTenant.profile?.email || "",
      profile_type: legacyTenant.profile_type,
      roll_number: legacyTenant.roll_number,
      course: legacyTenant.course,
      year_of_study: legacyTenant.year_of_study,
      section: legacyTenant.section,
      branch: legacyTenant.branch,
      college_name: legacyTenant.college_name,
      gender: legacyTenant.gender,
      date_of_birth: legacyTenant.date_of_birth,
      permanent_address: legacyTenant.permanent_address,
      temporary_address: legacyTenant.temporary_address,
      room_number: currentRoom?.room_no || null,
      floor: floor,
      joined_on: legacyTenant.joined_on,
      joined_at: legacyTenant.joined_on,
      status: legacyTenant.status,
      monthly_rent: legacyTenant.monthly_rent,
      rent: Number(legacyTenant.monthly_rent),
      maintenance_charge: legacyTenant.maintenance_charge,
      maintenance_type: legacyTenant.maintenance_type,
      advance_deposit: legacyTenant.advance_deposit,
      security_deposit: legacyTenant.advance_deposit,
      document_verified: legacyTenant.document_verified,
      profile_completed: legacyTenant.profile_completed,
      total_paid: totalPaid,
      total_due: totalDue,
      outstanding: outstanding,
      overdue_amount: overdueAmount,
      advance_balance: advanceBalance,
      recent_payments: recentPayments,
      current_room: currentRoom
        ? {
            id: currentRoom.id,
            room_no: currentRoom.room_no,
            floor: currentRoom.floor,
            capacity: currentRoom.capacity,
            base_rent: currentRoom.base_rent,
          }
        : null,
      payment_summary: {
        total_paid: totalPaid,
        pending_amount: outstanding,
        outstanding,
        overdue_amount: overdueAmount,
        payment_status: outstanding <= 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : "PENDING",
      },
      financial_summary: {
        total_paid: totalPaid,
        pending_amount: outstanding,
        outstanding,
        overdue_amount: overdueAmount,
        deposit_balance: advanceBalance,
      },
      profile: legacyTenant.profile
        ? {
            id: legacyTenant.profile.id,
            name: legacyTenant.profile.name,
            email: legacyTenant.profile.email,
            phone: legacyTenant.profile.phone,
            emergency_contact: legacyTenant.profile.emergency_contact,
            is_profile_completed: legacyTenant.profile.is_profile_completed,
            phone_verified: legacyTenant.profile.phone_verified ?? legacyTenant.profile.mobile_verified ?? false,
          }
        : null,
      tenant: {
        id: legacyTenant.id,
        profile_id: legacyTenant.profile_id,
        profile_type: legacyTenant.profile_type,
        status: legacyTenant.status,
        photo_url: legacyTenant.photo_url,
        monthly_rent: legacyTenant.monthly_rent,
        maintenance_charge: legacyTenant.maintenance_charge,
        maintenance_type: legacyTenant.maintenance_type,
        advance_deposit: legacyTenant.advance_deposit,
        security_deposit: legacyTenant.advance_deposit,
        joined_on: legacyTenant.joined_on,
        billing_start_date: legacyTenant.billing_start_date,
        phone_1: legacyTenant.phone_1,
        phone_2: legacyTenant.phone_2,
        phone_3: legacyTenant.phone_3,
        guardian_name: legacyTenant.guardian_name,
        guardian_phone: legacyTenant.phone_2 || legacyTenant.profile?.emergency_contact || "",
        guardian_relation: legacyTenant.guardian_relation,
        gender: legacyTenant.gender,
        date_of_birth: legacyTenant.date_of_birth,
        college_name: legacyTenant.college_name,
        course: legacyTenant.course,
        year_of_study: legacyTenant.year_of_study,
        branch: legacyTenant.branch,
        section: legacyTenant.section,
        roll_number: legacyTenant.roll_number,
        office_name: legacyTenant.office_name,
        office_location: legacyTenant.office_location,
        job_role: legacyTenant.job_role,
        permanent_address: legacyTenant.permanent_address,
        temporary_address: legacyTenant.temporary_address,
        document_verified: legacyTenant.document_verified,
        mobile_verified: legacyTenant.mobile_verified,
        profile_completed: legacyTenant.profile_completed,
        room_number: currentRoom?.room_no || null,
        floor,
        current_room: currentRoom
          ? {
              id: currentRoom.id,
              room_no: currentRoom.room_no,
              floor: currentRoom.floor,
              capacity: currentRoom.capacity,
              base_rent: currentRoom.base_rent,
            }
          : null,
      },
      compliance: {
        profile_completed: Boolean(legacyTenant.profile_completed || legacyTenant.profile?.is_profile_completed),
        rules_accepted: Boolean(latestRuleAcceptance),
        rules_accepted_at: latestRuleAcceptance?.accepted_at ?? null,
        rules_version: latestRuleAcceptance?.rules_version ?? latestRuleAcceptance?.rule_version?.version ?? null,
        rule_version_id: latestRuleAcceptance?.rule_version_id ?? null,
        rules_snapshot: latestRuleAcceptance?.rules_snapshot ?? latestRuleAcceptance?.rule_version?.content ?? latestRuleAcceptance?.rule_version?.content_snapshot ?? null,
        documents_uploaded: activeDocuments.length,
        document_types: activeDocuments.map((doc: any) => doc.doc_type),
        required_document_types: requiredDocumentTypes,
        document_verification_status: legacyTenant.document_verified ? "VERIFIED" : "PENDING",
        activation_progress_percent: Math.round(([
          Boolean(legacyTenant.profile?.password_hash && (legacyTenant.phone_1 || legacyTenant.profile?.phone)),
          Boolean(latestRuleAcceptance),
          Boolean(legacyTenant.profile_completed || legacyTenant.profile?.is_profile_completed),
          legacyTenant.status === "ACTIVE",
        ].filter(Boolean).length / 4) * 100),
        activation_started_at: legacyTenant.activation_started_at ?? null,
        activation_completed_at: legacyTenant.activation_completed_at ?? null,
        onboarding_last_activity_at: legacyTenant.onboarding_last_activity_at ?? null,
        pending: {
          profile: !legacyTenant.profile_completed,
          rules: !latestRuleAcceptance,
          documents: activeDocuments.length < requiredDocumentTypes.length || !legacyTenant.document_verified,
        },
      }
    };
  }

  async createTenant(data: any, ownerId: string) {
    // Note: Profile must be created first or linked.
    return await tenantRepository.create({
      data: {
        ...data,
        owner_id: ownerId,
      },
      include: { profiles: true },
    }).then((tenant: any) => this.withLegacyTenantRelations(tenant));
  }

  async cancelInvitation(tenantId: string, ownerId: string) {
    const tenant = await tenantRepository.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        owner_id: true,
        status: true,
        tenant_invitations: {
          where: { status: { in: ["PENDING", "OPENED", "ACTIVATION_STARTED"] as any } },
          select: { id: true },
        },
        room_allocations: { where: { is_active: true, end_date: null }, select: { id: true } },
      },
    });
    const legacyTenant = this.withLegacyTenantRelations(tenant);
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only manage your own tenants");
    if (tenant.status !== "INVITED") {
      throw new Error("VALIDATION: Only INVITED tenants can be cancelled. Use checkout for ACTIVE tenants.");
    }

    const now = new Date();
    const invitationIds = (tenant.tenant_invitations || []).map((invitation: any) => invitation.id);
    let releasedReservationCount = 0;
    await prisma.$transaction(async (tx: any) => {
      if (invitationIds.length > 0) {
        await tx.tenant_invitations.updateMany({
          where: { id: { in: invitationIds }, status: { in: ["PENDING", "OPENED", "ACTIVATION_STARTED"] as any } },
          data: { status: "CANCELLED" as any, cancelled_at: now, updated_at: now },
        });

        const releaseResult = await tx.tenant_invitation_reservations.updateMany({
          where: { invitation_id: { in: invitationIds }, status: "ACTIVE" },
          data: {
            status: "RELEASED" as any,
            released_by: ownerId,
            released_at: now,
            release_reason: "CANCELLED",
            updated_at: now,
          },
        });
        releasedReservationCount = releaseResult.count;
      }

      await tx.tenants.update({
        where: { id: tenantId },
        data: { status: "CANCELLED" as any },
      });
      if (legacyTenant.allocations.length > 0) {
        await tx.roomAllocation.updateMany({
          where: { tenant_id: tenantId, is_active: true, end_date: null },
          data: { is_active: false, end_date: now },
        });
      }
      // Waive all pending obligations — a cancelled invitation means
      // the tenant never moved in; no financial claims should remain.
      await tx.rent_obligations.updateMany({
        where: { tenant_id: tenantId, status: { in: ["PENDING", "PARTIAL"] } },
        data: { status: "WAIVED" },
      });
    });

    await allocationReconciliationService.reconcileTenant(tenantId).catch((err: any) => {
      logger.error("reconcile_after_cancel_invitation_failed", {
        tenant_id: tenantId,
        error: String(err?.message || err),
      });
    });

    await eventLog.log("INVITATION_CANCELLED_BY_OWNER", ownerId, {
      tenant_id: tenantId,
      invitation_ids: invitationIds,
      released_reservation_count: releasedReservationCount,
      released_allocations: legacyTenant.allocations.length,
    }, tenantId);
    await eventSystem.trigger("tenant_status_changed", {
      owner_id: ownerId,
      tenant_id: tenantId,
      status: "CANCELLED",
    });

    return { success: true, tenant_id: tenantId, new_status: "CANCELLED" };
  }

  async updateTenant(id: string, data: any, ownerId: string) {
    const tenant = await tenantRepository.findUnique({
      where: { id },
      select: { id: true, owner_id: true, status: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only update your own tenants");

    if (data.status === "CANCELLED") {
      // Use dedicated cancelInvitation — it enforces INVITED-only guard
      return this.cancelInvitation(id, ownerId);
    }

    if (data.status === "FORMER_TENANT") {
      // ── GUARD: Direct FORMER_TENANT transitions are no longer allowed. ──
      // The owner MUST use the move-out workflow which enforces:
      //   inspection → settlement → payment → completion → FORMER_TENANT
      // This prevents tenants being marked FORMER_TENANT without owner review.
      throw new Error(
        "VALIDATION: Cannot set status to FORMER_TENANT directly. " +
        "Please use the Move-Out workflow (POST /api/move-out/requests) " +
        "which ensures proper inspection, settlement, and approval."
      );
    }

    const updated = await tenantRepository.update({
      where: { id },
      data,
      include: { profiles: true },
    });
    if (typeof data.status !== "undefined") {
      await allocationReconciliationService.reconcileTenant(id).catch((err: any) => {
        logger.error("reconcile_after_tenant_update_failed", {
          tenant_id: id,
          new_status: data.status,
          error: String(err?.message || err),
        });
      });
      await eventSystem.trigger("tenant_status_changed", {
        owner_id: ownerId,
        tenant_id: id,
        status: data.status,
      });
    }
    return this.withLegacyTenantRelations(updated);
  }

  async deleteTenant(id: string, ownerId: string) {
    const tenant = await tenantRepository.findUnique({
      where: { id },
      select: { id: true, owner_id: true, status: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only delete your own tenants");

    // Lifecycle-correct soft delete:
    // INVITED => CANCELLED (never activated, treat as cancelled invitation)
    if (tenant.status === "INVITED") {
      return this.cancelInvitation(id, ownerId);
    }

    // ACTIVE => must use move-out workflow
    if (tenant.status === "ACTIVE") {
      throw new Error(
        "VALIDATION: Cannot remove an active tenant directly. " +
        "Please use the Move-Out workflow which ensures proper " +
        "inspection, settlement calculation, and owner approval before marking as FORMER_TENANT."
      );
    }

    // FORMER_TENANT / CANCELLED — already terminal, no-op
    throw new Error(`VALIDATION: Tenant is already in terminal status: ${tenant.status}`);
  }

  async reactivateTenant(id: string, rent: number, joinedOn: Date, ownerId: string) {
    const tenant = await tenantRepository.findUnique({
      where: { id },
      select: { id: true, owner_id: true, status: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: You can only reactivate your own tenants");
    if (tenant.status !== "FORMER_TENANT") throw new Error("VALIDATION: Only tenants with FORMER_TENANT status can be reactivated");

    const updated = await tenantRepository.update({
      where: { id },
      data: {
        status: "ACTIVE",
        monthly_rent: rent,
        joined_on: joinedOn,
      },
      include: { profiles: true },
    });
    await allocationReconciliationService.reconcileTenant(id).catch((err: any) => {
      logger.error("reconcile_after_tenant_reactivate_failed", {
        tenant_id: id,
        error: String(err?.message || err),
      });
    });
    await eventSystem.trigger("tenant_status_changed", {
      owner_id: ownerId,
      tenant_id: id,
      status: "ACTIVE",
    });
    return this.withLegacyTenantRelations(updated);
  }

  async getIncrementYearPreview(hostelId: string, ownerId: string) {
    const students = await prisma.tenants.findMany({
      where: {
        hostel_id: hostelId,
        owner_id: ownerId,
        status: "ACTIVE",
        profile_type: "STUDENT",
      },
      include: {
        profiles: {
          select: {
            name: true,
          },
        },
        room_allocations: {
          where: { is_active: true, end_date: null },
          include: { room: true },
        },
      },
    });

    const toIncrement: any[] = [];
    const violators: any[] = [];
    const others: any[] = [];

    for (const student of students) {
      const roomNo = student.room_allocations?.[0]?.room?.room_no || "Unassigned";
      const name = student.profiles?.name || "Unknown Tenant";
      const year = student.year_of_study;

      if (year === null || year === undefined) {
        others.push({ id: student.id, name, roomNo, year: null });
      } else if (year >= 1 && year < 4) {
        toIncrement.push({ id: student.id, name, roomNo, currentYear: year, nextYear: year + 1 });
      } else if (year >= 4) {
        violators.push({ id: student.id, name, roomNo, year });
      } else {
        others.push({ id: student.id, name, roomNo, year });
      }
    }

    return {
      toIncrement,
      violators,
      others,
    };
  }

  async executeIncrementYear(hostelId: string, ownerId: string) {
    const preview = await this.getIncrementYearPreview(hostelId, ownerId);

    if (preview.toIncrement.length === 0) {
      return {
        success: true,
        message: "No students eligible for increment.",
        updatedCount: 0,
        skippedCount: preview.violators.length + preview.others.length,
        skippedTenants: preview.violators,
      };
    }

    const idsToIncrement = preview.toIncrement.map((s) => s.id);

    await prisma.$transaction(
      idsToIncrement.map((id) =>
        prisma.tenants.update({
          where: { id },
          data: {
            year_of_study: {
              increment: 1,
            },
          },
        })
      )
    );

    return {
      success: true,
      message: `Successfully incremented the year of study for ${idsToIncrement.length} students.`,
      updatedCount: idsToIncrement.length,
      skippedCount: preview.violators.length + preview.others.length,
      skippedTenants: preview.violators,
    };
  }
}

export const tenantService = new TenantService();
