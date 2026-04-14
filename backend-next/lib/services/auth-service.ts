import { prisma } from "../db";
import { verifyPassword, hashPassword, generateToken } from "../auth";
import { z } from "zod";
import { AuthSchema } from "../validators";
import { eventSystem } from "../events";

export class AuthService {
  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
    });

    if (!profile) throw new Error("UNAUTHORIZED: Invalid email or password");
    if (!profile.is_active) throw new Error("FORBIDDEN: Account is disabled");

    const isValid = await verifyPassword(password, profile.password_hash || "");
    if (!isValid) throw new Error("UNAUTHORIZED: Invalid email or password");

    let studentId = null;
    let studentProfileCompleted = null;

    if (profile.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { profile_id: profile.id },
      });
      if (student) {
        studentId = student.id;
        studentProfileCompleted = student.profile_completed;
        if (student.status === "INVITED") {
          throw new Error("FORBIDDEN: Account not activated. Please check your email.");
        }
      }
    }

    const token = await generateToken({
      sub: profile.id,
      role: profile.role,
      email: profile.email,
      studentId,
    });

    return {
      access_token: token,
      token_type: "bearer",
      role: profile.role,
      name: profile.name,
      user_id: profile.id,
      student_id: studentId,
      is_profile_completed: studentId ? studentProfileCompleted : profile.is_profile_completed,
    };
  }

  async registerOwner(data: any) {
    const existing = await prisma.profile.findUnique({ where: { email: data.email } });
    if (existing) throw new Error("ALREADY_EXISTS: Email already registered");

    const hashedPassword = await hashPassword(data.password);

    const profile = await prisma.profile.create({
      data: {
        email: data.email,
        password_hash: hashedPassword,
        name: data.name,
        phone: data.phone,
        role: "OWNER",
        hostels: data.hostel_name ? {
          create: {
            name: data.hostel_name,
            phone: data.hostel_phone || data.phone,
            address: data.hostel_address || "",
            city: data.hostel_city,
          }
        } : undefined
      },
    });

    await eventSystem.trigger("owner_registered", { profileId: profile.id });
    return profile;
  }

  async logout(token: string) {
    // In JWT setup, we typically blacklist or just rely on client side deletion.
    // The FastAPI version inserts into token_blacklist.
    await prisma.tokenBlacklist.create({
      data: {
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24h
      }
    });
    return { success: true };
  }
}

export const authService = new AuthService();
