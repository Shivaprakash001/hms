import { prisma, supabase } from "../db";
import { verifyPassword, hashPassword, generateToken } from "../auth";
import { z } from "zod";
import { LoginSchema } from "../validators";
import { randomUUID } from "crypto";

export class AuthService {
  private async verifyOrMigrateLegacyPassword(profile: { id: string; password_hash: string | null }, inputPassword: string) {
    const stored = profile.password_hash;
    if (!stored) return false;

    try {
      return await verifyPassword(inputPassword, stored);
    } catch {
      // Preserve compatibility with legacy bad rows where a plain-text password
      // or malformed hash was stored by older backend code.
      if (stored === inputPassword) {
        const newHash = await hashPassword(inputPassword);
        await prisma.profile.update({
          where: { id: profile.id },
          data: { password_hash: newHash },
        });
        return true;
      }

      return false;
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
    });

    if (!profile) throw new Error("UNAUTHORIZED: Invalid email or password");
    if (!profile.is_active) throw new Error("FORBIDDEN: Account is disabled");

    const isValid = await this.verifyOrMigrateLegacyPassword(profile, password);
    if (!isValid) throw new Error("UNAUTHORIZED: Invalid email or password");

    let tenantId = null;
    let studentProfileCompleted = null;

    if (profile.role === "TENANT") {
      const tenant = await prisma.tenant.findUnique({
        where: { profile_id: profile.id },
        select: {
          id: true,
          profile_completed: true,
          status: true,
        }
      });
      if (tenant) {
        tenantId = tenant.id;
        studentProfileCompleted = tenant.profile_completed;
        if (tenant.status === "INVITED") {
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
      tenant_id: tenantId,
      is_profile_completed: tenantId ? studentProfileCompleted : profile.is_profile_completed,
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

    // 2. Prefer creating Supabase Auth user for shared UUIDs.
    // If admin auth is misconfigured in an environment, fall back to local UUID
    // so registration is not blocked.
    let userId: string = randomUUID();
    let createdSupabaseUser = false;

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: data.password,
        email_confirm: true,
      });

      if (!authError && authData.user?.id) {
        userId = authData.user.id;
        createdSupabaseUser = true;
      } else {
        console.warn("Supabase auth admin createUser failed, using local UUID fallback", authError?.message);
      }
    } catch (supabaseCreateError: any) {
      console.warn("Supabase auth admin createUser threw, using local UUID fallback", supabaseCreateError?.message);
    }

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
      if (createdSupabaseUser) {
        await supabase.auth.admin.deleteUser(userId);
      }
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
  async googleLogin(code: string, redirectUri?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const effectiveRedirectUri = redirectUri || process.env.GOOGLE_REDIRECT_URI || "https://hms-sand-five.vercel.app/callback";

    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: effectiveRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error("UNAUTHORIZED: Failed to exchange Google code");
    }

    const { access_token } = await tokenRes.json();

    // 2. Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      throw new Error("UNAUTHORIZED: Failed to get Google user info");
    }

    const { email, name } = await userRes.json();
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Find or Create Profile
    let profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      include: { tenant_details: true }
    });

    if (!profile) {
      // Create new profile for first-time Google login (default to OWNER/ADMIN for now as per Python)
      profile = await prisma.profile.create({
        data: {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          name: name || "User",
          role: "OWNER",
          is_active: true,
        },
        include: { tenant_details: true }
      });
    }

    // 4. Create local JWT
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
      tenant_id: profile.tenant_details?.id || null,
      is_profile_completed: profile.tenant_details ? profile.tenant_details.profile_completed : profile.is_profile_completed,
    };
  }
}

export const authService = new AuthService();

