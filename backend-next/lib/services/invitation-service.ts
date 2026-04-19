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

    logger.info(`Starting invitation process for email: ${email} by owner: ${ownerId}`);

    // 1. Duplicate check
    const existingProfile = await prisma.profile.findUnique({ where: { email } });
    if (existingProfile) {
      logger.warn(`Attempted to invite existing email: ${email}`);
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

    // 4. Create Profile and Student
    const newProfile = await prisma.profile.create({
      data: {
        email,
        name,
        phone,
        role: "STUDENT",
        is_active: false, // Student is not active until they accept invitation
        owner_id: ownerId,
        invitation_token: token,
        invitation_expires_at: expiresAt,
        student_details: {
          create: {
            id: crypto.randomUUID(),
            owner_id: ownerId,
            monthly_rent: Number(monthly_rent),
            joined_on: new Date(),
            status: "INVITED",
          }
        }
      },
      include: {
        student_details: true
      }
    });

    logger.info(`Successfully created profile ${newProfile.id} and student record ${newProfile.student_details?.id} with status INVITED`);

    // 5. Log Activity
    await eventSystem.trigger("student_created", {
      student_id: newProfile.student_details!.id,
      email,
      owner_id: ownerId,
      creator_id: ownerId,
    });

    // 6. Prepare and Send Email
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${baseUrl}/auth/activate?token=${token}`;

    logger.info(`Attempting to send invitation email to ${email}`);
    await EmailService.sendInvitation({
      toEmail: email,
      tenantName: name,
      ownerName: owner.name || "The Owner",
      hostelName: room.hostel.name,
      roomNumber: room.room_no,
      roomRent: Number(monthly_rent),
      activationLink,
    });
    logger.info(`Successfully queued invitation email for ${email}`);

    return {
      student_id: newProfile.student_details!.id,
      email,
      activation_link: activationLink, // For dev/testing purposes
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

  async resendInvitation(email: string) {
    logger.info(`Resending invitation for email: ${email}`);
    // 1. Find the student by email
    const profile = await prisma.profile.findUnique({
      where: { email },
      include: { student_details: true },
    });
    if (!profile || !profile.student_details) {
      logger.warn(`Resend failed: User not found for email ${email}`);
      throw new Error("NOT_FOUND: User not found");
    }

    if (profile.student_details.status !== "INVITED") {
      logger.warn(`Resend failed: Student ${email} is not in INVITED state.`);
      throw new Error("BAD_REQUEST: Student is already active or left");
    }

    // Additional details needed for email
    const allocation = await prisma.roomAllocation.findFirst({
        where: { student_id: profile.student_details.id, is_active: true },
        include: { room: { include: { hostel: true } } }
    });

    if (!allocation || !allocation.room || !allocation.room.hostel) {
        logger.error(`Could not find active allocation/room/hostel for resend to ${email}`);
        throw new Error("INTERNAL_ERROR: Cannot resend, missing allocation details.");
    }
    
    const owner = await prisma.profile.findUnique({ where: { id: profile.owner_id! }});
    if (!owner) {
        logger.error(`Could not find owner ${profile.owner_id} for resend to ${email}`);
        throw new Error("INTERNAL_ERROR: Cannot resend, missing owner details.");
    }

    // 2. Generate new token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${baseUrl}/auth/activate?token=${token}`;

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        invitation_token: token,
        invitation_expires_at: expiresAt,
      },
    });

    await EmailService.sendInvitation({
        toEmail: profile.email,
        tenantName: profile.name,
        ownerName: owner.name,
        hostelName: allocation.room.hostel.name,
        roomNumber: allocation.room.room_no,
        roomRent: Number(profile.student_details.monthly_rent),
        activationLink,
    });
    
    logger.info(`Successfully resent invitation to ${email}`);

    return {
      message: "Invitation resent successfully",
    };
  }
}

export const invitationService = new InvitationService();
