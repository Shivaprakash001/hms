import { prisma, supabase } from "../db";
import { verifyPassword, hashPassword, generateToken } from "../auth";
import { z } from "zod";
import { LoginSchema } from "../validators";

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

  async registerOwner(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    hostel_name: string;
    hostel_phone: string;
    hostel_address: string;
    hostel_city: string;
    hostel_state: string;
    hostel_pincode: string;
    upi_id?: string;
    gst_number?: string;
  }) {
    const normalizedEmail = data.email.trim().toLowerCase();

    // 1. Check for existing profile
    const existing = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new Error("ALREADY_EXISTS: Email already registered");

    // 2. Create Supabase Auth user to get a UUID
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: data.password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error("INTERNAL: Failed to create auth user");
    }

    const userId = authData.user.id;

    // 3. Hash password and create profile + hostel in one transaction
    const hashedPassword = await hashPassword(data.password);

    try {
      const profile = await prisma.profile.create({
        data: {
          id: userId,
          email: normalizedEmail,
          password_hash: hashedPassword,
          name: data.name,
          phone: data.phone || null,
          role: "OWNER",
          hostels: {
            create: {
              name: data.hostel_name,
              phone: data.hostel_phone,
              address: data.hostel_address,
              city: data.hostel_city,
              state: data.hostel_state,
              pincode: data.hostel_pincode,
              upi_id: data.upi_id || null,
              gst_number: data.gst_number || null,
            },
          },
        },
        include: { hostels: true },
      });
      return profile;
    } catch (dbError) {
      // Rollback Supabase user creation if Prisma transaction fails
      await supabase.auth.admin.deleteUser(userId);
      throw dbError;
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new Error("NOT_FOUND: User not found");

    const isValid = await verifyPassword(oldPassword, profile.password_hash || "");
    if (!isValid) throw new Error("UNAUTHORIZED: Current password is incorrect");

    // Sync new password with Supabase Auth
    const { error: supabaseError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    
    if (supabaseError) {
      throw new Error(`INTERNAL: Failed to update auth provider password: ${supabaseError.message}`);
    }

    const newHash = await hashPassword(newPassword);
    await prisma.profile.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    return { success: true, message: "Password updated successfully" };
  }

  async logout(token: string) {
    await prisma.tokenBlacklist.create({
      data: {
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { success: true };
  }

  async getCurrentUser(req: Request) {
    const { getSession } = await import("../auth-edge");
    const session = await getSession(req as any);
    if (!session) return null;

    return {
      id: session.sub,
      email: session.email,
      role: session.role,
      owner_id: session.owner_id
    };
  }
}

export const authService = new AuthService();


