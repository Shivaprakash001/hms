import { prisma } from "../db";
import { hashPassword } from "../auth";
import crypto from "crypto";
import { eventSystem } from "../events";
import { EmailService } from "./email-service";
import { getLogger } from "../logger";
import { planEnforcementService } from "./plan-enforcement-service";
import { allocationReconciliationService } from "./allocation-reconciliation-service";
import { hostelBillingPreferencesService, type MaintenanceType } from "./hostel-billing-preferences-service";

const logger = getLogger("invitation-service");

function mapAllocationConstraintError(err: any): Error {
  const msg = String(err?.message || err || "");
  if (err?.code === "P2002" || msg.includes("idx_room_allocations_active_tenant_unique")) {
    return new Error("VALIDATION_ERROR: Tenant already has an active allocation");
  }
  return err instanceof Error ? err : new Error(msg);
}

export class InvitationService {
  async inviteTenant(data: any, ownerId: string) {
    const { email, name, phone, room_id } = data;

    // ── Resolve financial defaults from hostel preferences ────────
    // Phase 2: prefs resolved from room.hostel after room fetch (below)

    // ── Resolve joining date + billing start ─────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const joiningDate = data.joining_date ? new Date(data.joining_date) : today;
    const billingStartDate = joiningDate > today ? joiningDate : today;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    logger.info(`Starting invitation process for email: ${normalizedEmail} by owner: ${ownerId}`);
    
    // Enforcement: subscription must allow writes and tenant slots
    await planEnforcementService.assertSubscriptionActive(ownerId);
    await planEnforcementService.assertTenantLimit(ownerId);
    // 1. Duplicate check
    const existingProfile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      include: { tenant_details: true },
    });
    if (existingProfile) {
      if (
        existingProfile.role === "TENANT" &&
        existingProfile.owner_id === ownerId &&
        existingProfile.tenant_details?.status === "INVITED"
      ) {
        logger.info(`Existing INVITED tenant found for ${normalizedEmail}; converting invite to resend.`);
        return this.resendInvitation(normalizedEmail, { id: ownerId, role: "OWNER" }, {
          name, phone, room_id, monthly_rent: data.monthly_rent,
        });
      }
      logger.warn(`Attempted to invite existing email: ${normalizedEmail}`);
      throw new Error("ALREADY_EXISTS: User with this email already exists");
    }

    // 2. Room and Owner check
    const room = await prisma.room.findFirst({
      where: { id: room_id, hostel: { owner_id: ownerId, is_active: true } },
      include: {
        hostel: true,
        allocations: {
          where: { is_active: true },
          include: { tenant: { include: { profile: { select: { name: true } } } } },
        },
      },
    });
    if (!room) throw new Error("NOT_FOUND: Target room not found");
    if (!room.hostel) throw new Error("NOT_FOUND: Associated hostel not found");
    if (room.allocations.length >= room.capacity) {
      throw new Error("CAPACITY_EXCEEDED: Room is already at full capacity");
    }

    // Resolve invitation defaults from the selected room's hostel. These values
    // are copied into Tenant as immutable billing snapshots for future history.
    const inviteDefaults = await hostelBillingPreferencesService.resolveTenantInviteDefaults(room_id, ownerId);
    const resolved = inviteDefaults.resolved_values;
    const monthlyRent = Number(data.monthly_rent ?? resolved.monthly_rent);
    const advance_amount = Number(data.advance_amount ?? resolved.advance_deposit);
    const maintenance_type = (data.maintenance_type || resolved.maintenance_type) as MaintenanceType;
    const maintenance_amount = maintenance_type === "NONE"
      ? 0
      : Number(data.maintenance_amount ?? resolved.maintenance_charge);

    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      throw new Error("VALIDATION: Monthly rent must be greater than zero");
    }
    if (!Number.isFinite(advance_amount) || advance_amount < 0) {
      throw new Error("VALIDATION: Advance deposit must be zero or greater");
    }
    if (!Number.isFinite(maintenance_amount) || maintenance_amount < 0) {
      throw new Error("VALIDATION: Maintenance charge must be zero or greater");
    }
    if (!["MONTHLY", "ONE_TIME", "NONE"].includes(maintenance_type)) {
      throw new Error("VALIDATION: Invalid maintenance type");
    }

    const owner = await prisma.profile.findUnique({ where: { id: ownerId } });
    if (!owner) throw new Error("NOT_FOUND: Owner profile not found");

    // Roommate names for the invite email
    const roommates = (room.allocations || [])
      .map((a: any) => a.tenant?.profile?.name)
      .filter(Boolean) as string[];

    // 3. Generate Token (48h)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 4. Atomic: Profile + Tenant + Allocation + Initial Obligations
    const { obligationEngine } = await import("./obligation-engine");

    let createdBundle: { profile: any; tenant: any; obligations: string[]; allocationId: string };
    try {
      createdBundle = await prisma.$transaction(async (tx) => {
        const profile = await tx.profile.create({
        data: {
          email: normalizedEmail,
          name,
          phone,
          role: "TENANT",
          is_active: false,
          owner_id: ownerId,
          invitation_token: token,
          invitation_expires_at: expiresAt,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          id: crypto.randomUUID(),
          profile_id: profile.id,
          owner_id: ownerId,
          monthly_rent: monthlyRent,
          joined_on: joiningDate,
          billing_start_date: billingStartDate,
          status: "INVITED",
          advance_deposit:    advance_amount,
          maintenance_charge: maintenance_amount,
          maintenance_type,
          hostel_id: room.hostel.id, // Phase 2: write-through hostel_id
        } as any,
      });

      const allocation = await tx.roomAllocation.create({
        data: {
          tenant_id: tenant.id,
          room_id,
          start_date: joiningDate,
          is_active: true,
          hostel_id: room.hostel.id, // Phase 2: write-through hostel_id
        },
      });

      // ── Financial obligations (ADVANCE + one-time MAINTENANCE) ──
      const created = await obligationEngine.createInitialObligations(tx, {
        tenantId: tenant.id,
        allocationId: allocation.id,
        ownerId,
        hostelId: room.hostel.id,
        joiningDate,
        advanceDeposit: advance_amount,
        maintenanceCharge: maintenance_amount,
        maintenanceType: maintenance_type,
      });

        return { profile, tenant, obligations: created, allocationId: allocation.id };
      });
    } catch (err: any) {
      throw mapAllocationConstraintError(err);
    }
    const { profile: newProfile, tenant: newTenant, obligations, allocationId } = createdBundle;

    logger.info(`Created profile ${newProfile.id}, tenant ${newTenant.id} [INVITED], obligations: [${obligations.join(", ") || "none"}]`);
    await allocationReconciliationService.reconcileAllocation(allocationId).catch((err: any) => {
      logger.error("reconcile_after_invite_failed", {
        allocation_id: allocationId,
        tenant_id: newTenant.id,
        error: String(err?.message || err),
      });
    });

    // 5. Log Activity
    await eventSystem.trigger("tenant_created", {
      tenant_id: newTenant.id,
      email: normalizedEmail,
      owner_id: ownerId,
      creator_id: ownerId,
    });

    // 6. Send enhanced invitation email
    let baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || "https://trishul.solutions";
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    } else if (baseUrl.startsWith("http://") && !baseUrl.includes("localhost")) {
      baseUrl = baseUrl.replace("http://", "https://");
    }
    const activationLink = `${baseUrl}/activate?token=${token}`;

    const emailResult = await EmailService.sendInvitation({
      toEmail: normalizedEmail,
      tenantName: name,
      ownerName: owner.name || "The Owner",
      hostelName: room.hostel.name,
      roomNumber: room.room_no,
      roomRent: monthlyRent,
      activationLink,
      advanceDeposit: advance_amount,
      maintenanceCharge: maintenance_amount,
      maintenanceType: maintenance_type,
      joiningDate,
      roommates,
      prefs: { ...inviteDefaults.billing_defaults, maintenance_type },
    });
    if (!emailResult.sent) {
      logger.error(`Failed to send invitation email to ${normalizedEmail}: ${String(emailResult.error || "unknown")}`);
      throw new Error("INTERNAL_ERROR: EMAIL_DELIVERY_FAILED");
    }
    logger.info(`Successfully queued invitation email for ${normalizedEmail}`);

    return {
      tenant_id: newTenant.id,
      email: normalizedEmail,
      activation_link: activationLink,
      action: "INVITED",
      obligations,
    };
  }

  async activateTenant(token: string, password: string) {
    logger.info(`Attempting to activate account with token: ${token}`);
    // 1. Resolve tenant by invitation token
    const profile = await prisma.profile.findFirst({
      where: {
        invitation_token: token,
        invitation_expires_at: { gte: new Date() },
      },
    });

    if (!profile) {
      logger.warn(`Invalid or expired token received: ${token}`);
      throw new Error("INVALID: Token expired or invalid");
    }

    const tenant = await prisma.tenant.findUnique({
        where: { profile_id: profile.id }
    });

    if (!tenant) {
        logger.error(`No tenant record found for profile ${profile.id} during activation.`);
        throw new Error("INTERNAL_ERROR: Could not find associated tenant record.");
    }

    const hashedPassword = await hashPassword(password);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        password_hash: hashedPassword,
        is_active: true,
        invitation_token: null,
        invitation_expires_at: null,
      },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "ACTIVE" },
    });
    await allocationReconciliationService.reconcileTenant(tenant.id).catch((err: any) => {
      logger.error("reconcile_after_activate_failed", {
        tenant_id: tenant.id,
        error: String(err?.message || err),
      });
    });
    
    logger.info(`Successfully activated account for email: ${profile.email}`);

    return { success: true, message: "Account activated successfully." };
  }

  async resendInvitation(
    email: string,
    actor?: { id: string; role: string },
    overrides?: {
      name?: string;
      phone?: string;
      room_id?: string;
      monthly_rent?: number;
    }
  ) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    logger.info(`Resending invitation for email: ${normalizedEmail}`);
    // 1. Find the tenant by email
    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      include: { tenant_details: true },
    });
    if (!profile || !profile.tenant_details) {
      logger.warn(`Resend failed: User not found for email ${normalizedEmail}`);
      throw new Error("NOT_FOUND: User not found");
    }
    const tenantDetails = profile.tenant_details;

    if (actor?.role === "OWNER" && profile.owner_id !== actor.id) {
      logger.warn(`Owner ${actor.id} attempted resend for foreign tenant ${normalizedEmail}`);
      throw new Error("FORBIDDEN: You can only resend invitations for your own tenants");
    }

    if (profile.tenant_details.status !== "INVITED") {
      logger.warn(`Resend failed: Tenant ${normalizedEmail} is not in INVITED state.`);
      throw new Error("BAD_REQUEST: Tenant is already active or left");
    }

    // Optional metadata updates when resend is triggered from invite flow.
    const roomIdOverride = overrides?.room_id ? String(overrides.room_id) : undefined;
    if (overrides?.name || typeof overrides?.phone !== "undefined" || typeof overrides?.monthly_rent !== "undefined" || roomIdOverride) {
      try {
        await prisma.$transaction(async (tx) => {
          if (overrides?.name || typeof overrides?.phone !== "undefined") {
            await tx.profile.update({
              where: { id: profile.id },
              data: {
                ...(overrides?.name ? { name: overrides.name } : {}),
                ...(typeof overrides?.phone !== "undefined" ? { phone: overrides.phone } : {}),
              },
            });
          }

          if (typeof overrides?.monthly_rent !== "undefined") {
            await tx.tenant.update({
              where: { id: tenantDetails.id },
              data: { monthly_rent: Number(overrides.monthly_rent) },
            });
          }

          if (roomIdOverride) {
            const targetRoom = await tx.room.findUnique({
              where: { id: roomIdOverride },
              include: {
                hostel: true,
                allocations: { where: { is_active: true } },
              },
            });
            if (!targetRoom || !targetRoom.hostel) {
              throw new Error("NOT_FOUND: Target room not found");
            }
            if (profile.owner_id && targetRoom.hostel.owner_id !== profile.owner_id) {
              throw new Error("FORBIDDEN: Cannot assign room from another owner");
            }
            
            // Only check capacity if we're actually changing rooms
            const activeAllocation = await tx.roomAllocation.findFirst({
              where: { tenant_id: tenantDetails.id, is_active: true },
            });
            if (!activeAllocation || activeAllocation.room_id !== roomIdOverride) {
              if (targetRoom.allocations.length >= targetRoom.capacity) {
                throw new Error("CAPACITY_EXCEEDED: Target room is already at full capacity");
              }
            }

            if (activeAllocation) {
              await tx.roomAllocation.update({
                where: { id: activeAllocation.id },
                data: { room_id: roomIdOverride, hostel_id: targetRoom.hostel.id, start_date: new Date() },
              });
            } else {
              await tx.roomAllocation.create({
                data: {
                  tenant_id: tenantDetails.id,
                  room_id: roomIdOverride,
                  hostel_id: targetRoom.hostel.id,
                  start_date: new Date(),
                  is_active: true,
                },
              });
            }
          }
        });
      } catch (err: any) {
        throw mapAllocationConstraintError(err);
      }
      if (roomIdOverride) {
        await allocationReconciliationService.reconcileTenant(tenantDetails.id).catch((err: any) => {
          logger.error("reconcile_after_resend_room_override_failed", {
            tenant_id: tenantDetails.id,
            room_id: roomIdOverride,
            error: String(err?.message || err),
          });
        });
      }
    }

    // Additional details needed for email
    const allocation = await prisma.roomAllocation.findFirst({
      where: { tenant_id: tenantDetails.id, is_active: true },
      include: { room: { include: { hostel: true } } },
    });

    if (!allocation || !allocation.room || !allocation.room.hostel) {
      logger.error(`Could not find active allocation/room/hostel for resend to ${normalizedEmail}`);
      throw new Error("INTERNAL_ERROR: Cannot resend, missing allocation details.");
    }
    
    const owner = await prisma.profile.findUnique({ where: { id: profile.owner_id! }});
    if (!owner) {
      logger.error(`Could not find owner ${profile.owner_id} for resend to ${normalizedEmail}`);
      throw new Error("INTERNAL_ERROR: Cannot resend, missing owner details.");
    }

    // 2. Generate new token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    let baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || "https://trishul.solutions";
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    } else if (baseUrl.startsWith("http://") && !baseUrl.includes("localhost")) {
      baseUrl = baseUrl.replace("http://", "https://");
    }
    const activationLink = `${baseUrl}/activate?token=${token}`;

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        invitation_token: token,
        invitation_expires_at: expiresAt,
      },
    });

    const emailResult = await EmailService.sendInvitation({
      toEmail: profile.email,
      tenantName: profile.name,
      ownerName: owner.name,
      hostelName: allocation.room.hostel.name,
      roomNumber: allocation.room.room_no,
      roomRent: Number(tenantDetails.monthly_rent),
      activationLink,
    });
    if (!emailResult.sent) {
      logger.error(`Failed to resend invitation email to ${normalizedEmail}: ${String(emailResult.error || "unknown")}`);
      return {
        message: "Invitation updated, but email delivery failed",
        action: "RESENT",
        email: normalizedEmail,
        activation_link: activationLink,
        email_sent: false,
        email_error: String(emailResult.error || "unknown"),
      };
    }
    
    logger.info(`Successfully resent invitation to ${normalizedEmail}`);

    return {
      message: "Invitation resent successfully",
      action: "RESENT",
      email: normalizedEmail,
      activation_link: activationLink,
      email_sent: true,
    };
  }
}

export const invitationService = new InvitationService();
