import crypto from "crypto";
import { prisma } from "../../../lib/db";
import { hashPassword } from "../../../lib/auth";
import { normalizeIndianPhone } from "../../../lib/utils/phone-utils";
import { frontendUrl } from "../../../lib/config/domains";
import { EmailService } from "../../../lib/services/email-service";
import { eventLog } from "../../../lib/services/event-log-service";
import { hostelBillingPreferencesService, type MaintenanceType } from "../../../lib/services/hostel-billing-preferences-service";
import { roomCapacityService } from "../../../lib/services/room-capacity-service";

type InvitationStatus = "PENDING" | "OPENED" | "ACTIVATION_STARTED" | "ACTIVATED" | "EXPIRED" | "CANCELLED";
type ReservationReleaseReason = "ACTIVATED" | "EXPIRED" | "CANCELLED" | "TRANSFERRED";

const ACTIVE_INVITE_STATUSES: InvitationStatus[] = ["PENDING", "OPENED", "ACTIVATION_STARTED"];
const DEFAULT_INVITE_DAYS = 7;

function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

function moneyNumber(value: unknown, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export class TenantInvitationLifecycleService {
  async getRoomCapacitySnapshot(tx: any, roomId: string) {
    return roomCapacityService.getRoomCapacitySnapshot(roomId, { tx });
  }

  async createInvitation(data: any, ownerId: string) {
    const normalizedEmail = normalizeEmail(data.email);
    const normalizedPhone = normalizeIndianPhone(data.phone);
    const name = String(data.name || "").trim();
    const roomId = String(data.room_id || data.roomId || "").trim();
    if (!name) throw new Error("VALIDATION_ERROR: Tenant name is required");
    if (!normalizedEmail) throw new Error("VALIDATION_ERROR: Email is required");
    if (!normalizedPhone) throw new Error("VALIDATION_ERROR: Valid phone is required");
    if (!roomId) throw new Error("VALIDATION_ERROR: Room is required");

    const today = startOfToday();
    const joiningDate = data.joining_date ? new Date(data.joining_date) : today;
    if (Number.isNaN(joiningDate.getTime())) throw new Error("VALIDATION_ERROR: Invalid joining date");
    const billingStartDate = joiningDate > today ? joiningDate : today;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = data.expires_at ? new Date(data.expires_at) : addDays(DEFAULT_INVITE_DAYS);
    if (Number.isNaN(expiresAt.getTime())) throw new Error("VALIDATION_ERROR: Invalid invitation expiry");

    const owner = await prisma.profile.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== "OWNER") throw new Error("NOT_FOUND: Owner profile not found");

    const activeExisting = await prisma.tenant_invitations.findFirst({
      where: {
        owner_id: ownerId,
        email: normalizedEmail,
        status: { in: ACTIVE_INVITE_STATUSES },
      },
      include: { tenant: true },
    });
    if (activeExisting) {
      return this.resendInvitation(activeExisting.id, { id: ownerId, role: "OWNER" }, data);
    }

    const existingProfile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      include: { tenants: true },
    });
    if (existingProfile?.tenants && existingProfile.tenants.status !== "EXPIRED" && existingProfile.tenants.status !== "CANCELLED") {
      throw new Error("ALREADY_EXISTS: User with this email already exists");
    }

    const inviteDefaults = await hostelBillingPreferencesService.resolveTenantInviteDefaults(roomId, ownerId);
    const resolved = inviteDefaults.resolved_values;
    const monthlyRent = moneyNumber(data.monthly_rent, Number(resolved.monthly_rent));
    const advanceDeposit = moneyNumber(data.advance_amount ?? data.advance_deposit ?? data.deposit, Number(resolved.advance_deposit));
    const maintenanceType = (data.maintenance_type || resolved.maintenance_type) as MaintenanceType;
    const maintenanceCharge = maintenanceType === "NONE"
      ? 0
      : moneyNumber(data.maintenance_amount, Number(resolved.maintenance_charge));
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      throw new Error("VALIDATION_ERROR: Monthly rent must be greater than zero");
    }
    if (advanceDeposit < 0) throw new Error("VALIDATION_ERROR: Deposit cannot be negative");
    if (maintenanceCharge < 0) throw new Error("VALIDATION_ERROR: Maintenance charge cannot be negative");

    const created = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${roomId}::uuid FOR UPDATE`;
      const capacity = await this.getRoomCapacitySnapshot(tx, roomId);
      if (capacity.room.hostels.owner_id !== ownerId) {
        throw new Error("FORBIDDEN: Cannot invite tenant to another owner's room");
      }
      if (capacity.available <= 0) {
        throw new Error("CAPACITY_EXCEEDED: Room is already full including active reservations");
      }

      const tenant = await tx.tenants.create({
        data: {
          id: crypto.randomUUID(),
          profile_id: null,
          owner_id: ownerId,
          hostel_id: capacity.room.hostel_id,
          monthly_rent: monthlyRent,
          joined_on: joiningDate,
          billing_start_date: billingStartDate,
          status: "INVITED",
          advance_deposit: advanceDeposit,
          maintenance_charge: maintenanceCharge,
          maintenance_type: maintenanceType,
          phone_1: normalizedPhone,
          personal_email: normalizedEmail,
        },
      });

      const invitation = await tx.tenant_invitations.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenant.id,
          owner_id: ownerId,
          hostel_id: capacity.room.hostel_id,
          room_id: roomId,
          batch_id: data.batch_id || null,
          name,
          email: normalizedEmail,
          phone: normalizedPhone,
          token,
          expires_at: expiresAt,
          status: "PENDING",
        },
      });

      const reservation = await tx.tenant_invitation_reservations.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenant.id,
          invitation_id: invitation.id,
          owner_id: ownerId,
          hostel_id: capacity.room.hostel_id,
          room_id: roomId,
          batch_id: data.batch_id || null,
          status: "ACTIVE",
          reserved_at: new Date(),
          expires_at: expiresAt,
        },
      });

      return { tenant, invitation, reservation, room: capacity.room };
    });

    const activationLink = frontendUrl(`/activate/${created.invitation.token}`);
    const roommates = await this.getRoommateNames(created.room.id);
    const emailResult = await EmailService.sendInvitation({
      toEmail: normalizedEmail,
      tenantName: name,
      ownerName: owner.name || "The Owner",
      hostelName: created.room.hostels.name,
      roomNumber: created.room.room_no,
      roomRent: monthlyRent,
      activationLink,
      advanceDeposit,
      maintenanceCharge,
      maintenanceType,
      joiningDate,
      roommates,
      prefs: { ...inviteDefaults.billing_defaults, maintenance_type: maintenanceType },
    });

    await eventLog.log("tenant_invited", ownerId, {
      tenant_id: created.tenant.id,
      invitation_id: created.invitation.id,
      reservation_id: created.reservation.id,
      hostel_id: created.room.hostel_id,
      room_id: created.room.id,
      email_sent: Boolean(emailResult.sent),
      email_error: emailResult.sent ? undefined : String(emailResult.error || "unknown"),
    }, created.tenant.id);

    return {
      tenant_id: created.tenant.id,
      invitation_id: created.invitation.id,
      reservation_id: created.reservation.id,
      email: normalizedEmail,
      activation_link: activationLink,
      action: "INVITED",
      obligations: [],
      email_sent: Boolean(emailResult.sent),
      ...(emailResult.sent ? {} : { email_error: String(emailResult.error || "unknown") }),
    };
  }

  async resendInvitation(invitationId: string, actor?: { id: string; role: string }, overrides?: any) {
    const invitation = await prisma.tenant_invitations.findUnique({
      where: { id: invitationId },
      include: {
        tenant: true,
        room: { include: { hostels: true } },
      },
    });
    if (!invitation || !invitation.tenant) throw new Error("NOT_FOUND: Invitation not found");
    if (actor?.role === "OWNER" && invitation.owner_id !== actor.id) {
      throw new Error("FORBIDDEN: You can only resend your own invitations");
    }
    if (invitation.status === "ACTIVATED" || invitation.tenant.status === "ACTIVE") {
      throw new Error("BAD_REQUEST: Tenant is already active");
    }
    if (invitation.status === "CANCELLED") throw new Error("BAD_REQUEST: Invitation is cancelled");

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = addDays(DEFAULT_INVITE_DAYS);
    const updated = await prisma.$transaction(async (tx: any) => {
      let reservation = await tx.tenant_invitation_reservations.findFirst({
        where: { invitation_id: invitation.id, status: "ACTIVE" },
      });
      if (!reservation) {
        await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${invitation.room_id}::uuid FOR UPDATE`;
        const capacity = await this.getRoomCapacitySnapshot(tx, invitation.room_id);
        if (capacity.available <= 0) throw new Error("CAPACITY_EXCEEDED: Room is already full including active reservations");
        reservation = await tx.tenant_invitation_reservations.create({
          data: {
            id: crypto.randomUUID(),
            tenant_id: invitation.tenant_id,
            invitation_id: invitation.id,
            owner_id: invitation.owner_id,
            hostel_id: invitation.hostel_id,
            room_id: invitation.room_id,
            batch_id: invitation.batch_id,
            status: "ACTIVE",
            reserved_at: new Date(),
            expires_at: expiresAt,
          },
        });
      } else {
        await tx.tenant_invitation_reservations.update({
          where: { id: reservation.id },
          data: { expires_at: expiresAt, updated_at: new Date() },
        });
      }

      await tx.tenants.update({
        where: { id: invitation.tenant_id },
        data: {
          status: "INVITED",
          ...(typeof overrides?.monthly_rent !== "undefined" ? { monthly_rent: Number(overrides.monthly_rent) } : {}),
          ...(typeof overrides?.phone !== "undefined" ? { phone_1: normalizeIndianPhone(overrides.phone) || invitation.phone } : {}),
        },
      });

      return tx.tenant_invitations.update({
        where: { id: invitation.id },
        data: {
          token,
          expires_at: expiresAt,
          status: "PENDING",
          opened_at: null,
          activation_started_at: null,
          activated_at: null,
          cancelled_at: null,
          ...(overrides?.name ? { name: String(overrides.name).trim() } : {}),
          ...(typeof overrides?.phone !== "undefined" ? { phone: normalizeIndianPhone(overrides.phone) || invitation.phone } : {}),
          updated_at: new Date(),
        },
      });
    });

    const owner = await prisma.profile.findUnique({ where: { id: invitation.owner_id }, select: { name: true } });
    const activationLink = frontendUrl(`/activate/${token}`);
    const emailResult = await EmailService.sendInvitation({
      toEmail: updated.email,
      tenantName: updated.name,
      ownerName: owner?.name || "The Owner",
      hostelName: invitation.room.hostels.name,
      roomNumber: invitation.room.room_no,
      roomRent: Number(invitation.tenant.monthly_rent),
      activationLink,
      advanceDeposit: Number(invitation.tenant.advance_deposit),
      maintenanceCharge: Number(invitation.tenant.maintenance_charge),
      maintenanceType: invitation.tenant.maintenance_type,
      joiningDate: invitation.tenant.joined_on || undefined,
      roommates: await this.getRoommateNames(invitation.room_id),
    });

    await eventLog.log("tenant_invitation_resent", invitation.owner_id, {
      tenant_id: invitation.tenant_id,
      invitation_id: invitation.id,
      email_sent: Boolean(emailResult.sent),
    }, invitation.tenant_id);

    return {
      message: emailResult.sent ? "Invitation resent successfully" : "Invitation updated, but email delivery failed",
      action: "RESENT",
      email: updated.email,
      activation_link: activationLink,
      email_sent: Boolean(emailResult.sent),
      ...(emailResult.sent ? {} : { email_error: String(emailResult.error || "unknown") }),
    };
  }

  async resendInvitationByEmail(email: string, actor?: { id: string; role: string }, overrides?: any) {
    const normalizedEmail = normalizeEmail(email);
    const invitation = await prisma.tenant_invitations.findFirst({
      where: {
        email: normalizedEmail,
        ...(actor?.role === "OWNER" ? { owner_id: actor.id } : {}),
        status: { in: ["PENDING", "OPENED", "ACTIVATION_STARTED", "EXPIRED"] },
      },
      orderBy: { created_at: "desc" },
    });
    if (!invitation) throw new Error("NOT_FOUND: Invitation not found");
    return this.resendInvitation(invitation.id, actor, overrides);
  }

  async resolveByToken(token: string, options: { markOpened?: boolean } = {}) {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) throw new Error("VALIDATION_ERROR: Activation token is required");

    const invitation = await prisma.tenant_invitations.findUnique({
      where: { token: normalizedToken },
      include: {
        tenant: {
          include: {
            profiles: true,
            hostels: {
              include: { profiles: { select: { id: true, name: true, phone: true, email: true } } },
            },
            room_allocations: {
              where: { is_active: true, end_date: null },
              orderBy: { start_date: "desc" },
              take: 1,
              include: { room: true },
            },
            identification_documents: { where: { is_active: true }, orderBy: { created_at: "desc" } },
            rule_acceptances: { orderBy: { accepted_at: "desc" }, take: 5, include: { rule_version: true } },
          },
        },
        room: true,
        reservations: { where: { status: "ACTIVE" }, orderBy: { reserved_at: "desc" }, take: 1, include: { room: true } },
      },
    });

    if (!invitation || !invitation.tenant) {
      return this.resolveLegacyProfileToken(normalizedToken);
    }
    if (invitation.status === "ACTIVATED" || invitation.tenant.status === "ACTIVE") {
      throw new Error("ALREADY_ACTIVE: Account already active");
    }
    if (invitation.status === "CANCELLED" || invitation.tenant.status === "CANCELLED") {
      throw new Error("CANCELLED: Invitation was cancelled");
    }
    if (invitation.status === "EXPIRED" || invitation.tenant.status === "EXPIRED") {
      await eventLog.log("expired_invite_rate", invitation.owner_id, { tenant_id: invitation.tenant_id, invitation_id: invitation.id }, invitation.tenant_id);
      throw new Error("EXPIRED: Invitation expired");
    }
    if (invitation.expires_at < new Date() && invitation.status !== "ACTIVATION_STARTED") {
      await eventLog.log("expired_invite_rate", invitation.owner_id, { tenant_id: invitation.tenant_id, invitation_id: invitation.id }, invitation.tenant_id);
      throw new Error("EXPIRED: Invitation expired");
    }
    if (options.markOpened && invitation.status === "PENDING") {
      await prisma.tenant_invitations.update({
        where: { id: invitation.id },
        data: { status: "OPENED", opened_at: new Date(), updated_at: new Date() },
      }).catch(() => undefined);
      await eventLog.log("tenant_invitation_opened", invitation.owner_id, {
        tenant_id: invitation.tenant_id,
        invitation_id: invitation.id,
      }, invitation.tenant_id);
      invitation.status = "OPENED";
    }

    return {
      source: "tenant_invitations",
      invitation,
      profile: invitation.tenant.profiles || null,
      tenant: invitation.tenant,
      token: normalizedToken,
    };
  }

  async startActivation(token: string, data: any) {
    const resolved = await this.resolveByToken(token);
    const invitation = resolved.invitation;
    if (!invitation) throw new Error("INVALID: Activation link expired or already used");
    const tenant = resolved.tenant;
    const password = String(data?.password || "");
    const confirmPassword = String(data?.confirm_password || data?.confirmPassword || "");
    const primaryPhone = normalizeIndianPhone(data?.phone || data?.primary_phone || tenant.phone_1 || invitation.phone);
    if (!primaryPhone) throw new Error("VALIDATION_ERROR: Valid primary phone is required");
    if (!password && !resolved.profile?.password_hash) throw new Error("VALIDATION_ERROR: Password is required");
    if (password || confirmPassword) {
      if (password.length < 8) throw new Error("VALIDATION_ERROR: Password must be at least 8 characters");
      if (password !== confirmPassword) throw new Error("VALIDATION_ERROR: Passwords do not match");
    }

    const passwordHash = password ? await hashPassword(password) : undefined;
    const now = new Date();
    const profile = await prisma.$transaction(async (tx: any) => {
      const existingProfile = resolved.profile;
      let profileRecord = existingProfile;
      if (!profileRecord) {
        profileRecord = await tx.profile.create({
          data: {
            id: crypto.randomUUID(),
            email: invitation.email,
            name: invitation.name,
            phone: primaryPhone,
            role: "TENANT",
            is_active: false,
            owner_id: invitation.owner_id,
            ...(passwordHash ? { password_hash: passwordHash } : {}),
          },
        });
      } else {
        profileRecord = await tx.profile.update({
          where: { id: existingProfile.id },
          data: {
            phone: primaryPhone,
            ...(passwordHash ? { password_hash: passwordHash } : {}),
          },
        });
      }

      await tx.tenants.update({
        where: { id: tenant.id },
        data: {
          profile_id: profileRecord.id,
          phone_1: primaryPhone,
          activation_started_at: tenant.activation_started_at || now,
          onboarding_last_activity_at: now,
          ...(data?.photo_url ? { photo_url: String(data.photo_url) } : {}),
        },
      });
      await tx.tenant_invitations.update({
        where: { id: invitation.id },
        data: {
          status: "ACTIVATION_STARTED",
          activation_started_at: invitation.activation_started_at || now,
          updated_at: now,
        },
      });
      return profileRecord;
    });

    await eventLog.log("activation_started", invitation.owner_id, {
      tenant_id: tenant.id,
      invitation_id: invitation.id,
      hostel_id: invitation.hostel_id,
    }, tenant.id);
    return profile;
  }

  async completeActivation(invitation: any, tenant: any, profile: any) {
    const completedAt = new Date();
    await prisma.$transaction(async (tx: any) => {
      const reservation = await tx.tenant_invitation_reservations.findFirst({
        where: { invitation_id: invitation.id, tenant_id: tenant.id, status: "ACTIVE" },
        orderBy: { reserved_at: "desc" },
      });
      if (!reservation) throw new Error("INVALID_TRANSITION: Active room reservation is missing");

      await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${reservation.room_id}::uuid FOR UPDATE`;
      const capacity = await this.getRoomCapacitySnapshot(tx, reservation.room_id);
      if (capacity.occupied >= Number(capacity.room.capacity || 0)) {
        throw new Error("CAPACITY_EXCEEDED: Reserved room no longer has available capacity");
      }

      await tx.roomAllocation.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenant.id,
          room_id: reservation.room_id,
          hostel_id: reservation.hostel_id,
          start_date: tenant.joined_on || startOfToday(),
          is_active: true,
        },
      });

      await tx.tenant_invitation_reservations.update({
        where: { id: reservation.id },
        data: {
          status: "RELEASED",
          released_by: tenant.owner_id || invitation.owner_id,
          released_at: completedAt,
          release_reason: "ACTIVATED",
          updated_at: completedAt,
        },
      });
      await tx.tenant_invitations.update({
        where: { id: invitation.id },
        data: { status: "ACTIVATED", activated_at: completedAt, updated_at: completedAt },
      });
      await tx.profile.update({
        where: { id: profile.id },
        data: {
          is_active: true,
          is_profile_completed: true,
          invitation_token: null,
          invitation_expires_at: null,
        },
      });
      await tx.tenants.update({
        where: { id: tenant.id },
        data: {
          status: "ACTIVE",
          profile_completed: true,
          activation_completed_at: completedAt,
          onboarding_last_activity_at: completedAt,
        },
      });
    });
    await eventLog.log("activation_completed", invitation.owner_id, {
      tenant_id: tenant.id,
      invitation_id: invitation.id,
      hostel_id: invitation.hostel_id,
      completed_at: completedAt.toISOString(),
      duration_seconds: tenant.activation_started_at
        ? Math.max(0, Math.round((completedAt.getTime() - new Date(tenant.activation_started_at).getTime()) / 1000))
        : null,
    }, tenant.id);
  }

  async releaseReservation(reservationId: string, reason: ReservationReleaseReason, releasedBy: string) {
    if (!releasedBy) throw new Error("VALIDATION_ERROR: released_by is required");
    if (!reason) throw new Error("VALIDATION_ERROR: release_reason is required");
    const releasedAt = new Date();
    return prisma.tenant_invitation_reservations.update({
      where: { id: reservationId },
      data: {
        status: "RELEASED",
        released_by: releasedBy,
        released_at: releasedAt,
        release_reason: reason,
        updated_at: releasedAt,
      },
    });
  }

  private async getRoommateNames(roomId: string) {
    const roommates = await prisma.roomAllocation.findMany({
      where: { room_id: roomId, is_active: true, end_date: null, tenant: { status: "ACTIVE" } },
      include: { tenant: { include: { profiles: { select: { name: true } } } } },
      take: 10,
    });
    return roommates.map((item: any) => item.tenant?.profiles?.name).filter(Boolean);
  }

  private async resolveLegacyProfileToken(token: string) {
    const profile = await prisma.profile.findFirst({
      where: {
        invitation_token: token,
        invitation_expires_at: { gte: new Date() },
        role: "TENANT",
      },
      include: {
        tenants: {
          include: {
            hostels: { include: { profiles: { select: { id: true, name: true, phone: true, email: true } } } },
            room_allocations: {
              where: { is_active: true, end_date: null },
              orderBy: { start_date: "desc" },
              take: 1,
              include: { room: true },
            },
            identification_documents: { where: { is_active: true }, orderBy: { created_at: "desc" } },
            rule_acceptances: { orderBy: { accepted_at: "desc" }, take: 5, include: { rule_version: true } },
          },
        },
      },
    });
    if (!profile || !profile.tenants) throw new Error("INVALID: Activation link expired or already used");
    if (profile.tenants.status === "ACTIVE") throw new Error("ALREADY_ACTIVE: Account already active");
    if (profile.tenants.status === "CANCELLED") throw new Error("CANCELLED: Invitation was cancelled");
    if (profile.tenants.status === "EXPIRED") throw new Error("EXPIRED: Invitation expired");
    return {
      source: "legacy_profile",
      invitation: null,
      profile,
      tenant: profile.tenants,
      token,
    };
  }
}

export const tenantInvitationLifecycleService = new TenantInvitationLifecycleService();
