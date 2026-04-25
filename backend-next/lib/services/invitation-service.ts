import { prisma } from "../db";
import { hashPassword } from "../auth";
import crypto from "crypto";
import { eventSystem } from "../events";
import { EmailService } from "./email-service";
import { getLogger } from "../logger";

const logger = getLogger("invitation-service");

export class InvitationService {
  async inviteTenant(data: any, ownerId: string) {
    const { email, name, phone, room_id, monthly_rent } = data;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    logger.info(`Starting invitation process for email: ${normalizedEmail} by owner: ${ownerId}`);

    // 1. Duplicate check
    const existingProfile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      include: { student_details: true },
    });
    if (existingProfile) {
      // If a tenant is still invited, treat repeated invite as a resend action.
      if (
        existingProfile.role === "STUDENT" &&
        existingProfile.owner_id === ownerId &&
        existingProfile.student_details?.status === "INVITED"
      ) {
        logger.info(`Existing INVITED tenant found for ${normalizedEmail}; converting invite to resend.`);
        return this.resendInvitation(normalizedEmail, { id: ownerId, role: "OWNER" }, {
          name,
          phone,
          room_id,
          monthly_rent,
        });
      }

      logger.warn(`Attempted to invite existing email: ${normalizedEmail}`);
      throw new Error("ALREADY_EXISTS: User with this email already exists");
    }

    // 2. Room and Owner check
    const room = await prisma.room.findUnique({
      where: { id: room_id },
      include: { hostel: true },
    });
    if (!room) {
      logger.error(`Room not found for id: ${room_id}`);
      throw new Error("NOT_FOUND: Target room not found");
    }
    if (!room.hostel) {
      logger.error(`Hostel not found for room id: ${room_id}`);
      throw new Error("NOT_FOUND: Associated hostel not found");
    }

    const owner = await prisma.profile.findUnique({ where: { id: ownerId } });
    if (!owner) {
      logger.error(`Owner not found for id: ${ownerId}`);
      throw new Error("NOT_FOUND: Owner profile not found");
    }

    // 3. Generate Token (48h)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 4. Create Profile + Student + Allocation atomically
    const { profile: newProfile, student: newStudent } = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          email: normalizedEmail,
          name,
          phone,
          role: "STUDENT",
          is_active: false, // Student remains inactive until activation
          owner_id: ownerId,
          invitation_token: token,
          invitation_expires_at: expiresAt,
        },
      });

      const student = await tx.student.create({
        data: {
          id: crypto.randomUUID(),
          profile_id: profile.id,
          owner_id: ownerId,
          monthly_rent: Number(monthly_rent),
          joined_on: new Date(),
          status: "INVITED",
        },
      });

      // Reserve/track room assignment for invited tenant so resend + lifecycle remain consistent.
      await tx.roomAllocation.create({
        data: {
          student_id: student.id,
          room_id,
          start_date: new Date(),
          is_active: true,
        },
      });

      return { profile, student };
    });

    logger.info(`Successfully created profile ${newProfile.id} and student record ${newStudent.id} with status INVITED`);

    // 5. Log Activity
    await eventSystem.trigger("student_created", {
      student_id: newStudent.id,
      email: normalizedEmail,
      owner_id: ownerId,
      creator_id: ownerId,
    });

    // 6. Prepare and Send Email
    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${baseUrl}/auth/activate?token=${token}`;

    logger.info(`Attempting to send invitation email to ${normalizedEmail}`);
    const emailResult = await EmailService.sendInvitation({
      toEmail: normalizedEmail,
      tenantName: name,
      ownerName: owner.name || "The Owner",
      hostelName: room.hostel.name,
      roomNumber: room.room_no,
      roomRent: Number(monthly_rent),
      activationLink,
    });
    if (!emailResult.sent) {
      logger.error(`Failed to send invitation email to ${normalizedEmail}: ${String(emailResult.error || "unknown")}`);
      throw new Error("INTERNAL_ERROR: EMAIL_DELIVERY_FAILED");
    }
    logger.info(`Successfully queued invitation email for ${normalizedEmail}`);

    return {
      student_id: newStudent.id,
      email: normalizedEmail,
      activation_link: activationLink, // For dev/testing purposes
      action: "INVITED",
    };
  }

  async activateTenant(token: string, password: string) {
    logger.info(`Attempting to activate account with token: ${token}`);
    // 1. Resolve student by invitation token
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

    const student = await prisma.student.findUnique({
        where: { profile_id: profile.id }
    });

    if (!student) {
        logger.error(`No student record found for profile ${profile.id} during activation.`);
        throw new Error("INTERNAL_ERROR: Could not find associated student record.");
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

    await prisma.student.update({
      where: { id: student.id },
      data: { status: "ACTIVE" },
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
    // 1. Find the student by email
    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      include: { student_details: true },
    });
    if (!profile || !profile.student_details) {
      logger.warn(`Resend failed: User not found for email ${normalizedEmail}`);
      throw new Error("NOT_FOUND: User not found");
    }

    if (actor?.role === "OWNER" && profile.owner_id !== actor.id) {
      logger.warn(`Owner ${actor.id} attempted resend for foreign tenant ${normalizedEmail}`);
      throw new Error("FORBIDDEN: You can only resend invitations for your own tenants");
    }

    if (profile.student_details.status !== "INVITED") {
      logger.warn(`Resend failed: Student ${normalizedEmail} is not in INVITED state.`);
      throw new Error("BAD_REQUEST: Student is already active or left");
    }

    // Optional metadata updates when resend is triggered from invite flow.
    const roomIdOverride = overrides?.room_id ? String(overrides.room_id) : undefined;
    if (overrides?.name || typeof overrides?.phone !== "undefined" || typeof overrides?.monthly_rent !== "undefined" || roomIdOverride) {
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
          await tx.student.update({
            where: { id: profile.student_details!.id },
            data: { monthly_rent: Number(overrides.monthly_rent) },
          });
        }

        if (roomIdOverride) {
          const targetRoom = await tx.room.findUnique({
            where: { id: roomIdOverride },
            include: { hostel: true },
          });
          if (!targetRoom || !targetRoom.hostel) {
            throw new Error("NOT_FOUND: Target room not found");
          }
          if (profile.owner_id && targetRoom.hostel.owner_id !== profile.owner_id) {
            throw new Error("FORBIDDEN: Cannot assign room from another owner");
          }

          const activeAllocation = await tx.roomAllocation.findFirst({
            where: { student_id: profile.student_details!.id, is_active: true },
          });

          if (activeAllocation) {
            await tx.roomAllocation.update({
              where: { id: activeAllocation.id },
              data: { room_id: roomIdOverride, start_date: new Date() },
            });
          } else {
            await tx.roomAllocation.create({
              data: {
                student_id: profile.student_details!.id,
                room_id: roomIdOverride,
                start_date: new Date(),
                is_active: true,
              },
            });
          }
        }
      });
    }

    // Additional details needed for email
    const allocation = await prisma.roomAllocation.findFirst({
      where: { student_id: profile.student_details.id, is_active: true },
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
    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${baseUrl}/auth/activate?token=${token}`;

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
      roomRent: Number(profile.student_details.monthly_rent),
      activationLink,
    });
    if (!emailResult.sent) {
      logger.error(`Failed to resend invitation email to ${normalizedEmail}: ${String(emailResult.error || "unknown")}`);
      throw new Error("INTERNAL_ERROR: EMAIL_DELIVERY_FAILED");
    }
    
    logger.info(`Successfully resent invitation to ${normalizedEmail}`);

    return {
      message: "Invitation resent successfully",
      action: "RESENT",
      email: normalizedEmail,
      activation_link: activationLink,
    };
  }
}

export const invitationService = new InvitationService();
