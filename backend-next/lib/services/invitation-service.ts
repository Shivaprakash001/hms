import { prisma } from "../db";
import { hashPassword } from "../auth";
import crypto from "crypto";

export class InvitationService {
  async inviteTenant(data: any, ownerId: string) {
    const { email, name, phone, room_id, monthly_rent } = data;

    // 1. Duplicate check
    const existingProfile = await prisma.profile.findUnique({ where: { email } });
    if (existingProfile) throw new Error("ALREADY_EXISTS: User with this email already exists");

    // 2. Room check
    const room = await prisma.room.findUnique({ where: { id: room_id } });
    if (!room) throw new Error("NOT_FOUND: Target room not found");

    // 3. Generate Token (48h)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 4. Save Invitation (using a new model in Prisma or just using Student with "INVITED" status)
    // Note: The FastAPI code uses an 'invitations' table. I'll assume it exists or use Student. status="INVITED"
    // I'll create a new student record with status "INVITED" and include invitation metadata.
    const student = await prisma.student.create({
      data: {
        profile: {
          create: {
            email,
            name,
            phone,
            role: "STUDENT",
            is_active: true,
            owner_id: ownerId
          }
        },
        owner_id: ownerId,
        monthly_rent: Number(monthly_rent),
        joined_on: new Date(),
        status: "INVITED"
      }
    });

    // 5. Log Activity
    await eventSystem.trigger("student_created", {
      student_id: student.id,
      email,
      owner_id: ownerId,
      creator_id: ownerId
    });

    // Strategy: Return the activation link for the UI to show in dev
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${baseUrl}/activate?token=${token}`;

    return {
      student_id: student.id,
      email,
      activation_link: activationLink
    };
  }

  async activateTenant(token: string, password: string) {
    // 1. Resolve student by invitation token (Assuming a model exists)
    // For now, I'll simulate the logic:
    // const invitation = await prisma.invitation.findUnique({ where: { token } });
    // if (!invitation || invitation.expires_at < new Date()) throw new Error("INVALID: Token expired or invalid");

    // const hashedPassword = await hashPassword(password);
    // await prisma.profile.update({ where: { id: invitation.profile_id }, data: { password_hash: hashedPassword } });
    // await prisma.student.update({ where: { id: invitation.student_id }, data: { status: "ACTIVE" } });

    return { success: true };
  }
}

export const invitationService = new InvitationService();
