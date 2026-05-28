import { prisma, supabase } from "../db";
import { verifyPassword, hashPassword, generateToken } from "../auth";
import { z } from "zod";
import { LoginSchema } from "../validators";
import { randomUUID } from "crypto";
import { getGoogleRedirectUri } from "../config/domains";
import { sessionLifecycleService } from "./session-lifecycle-service";

type AuthSessionMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class AuthService {
  private getGoogleCodeRedirectUri(redirectUri?: string) {
    if (!redirectUri) {
      return getGoogleRedirectUri();
    }
    return redirectUri;
  }

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

  async login(email: string, password: string, meta: AuthSessionMeta = {}) {
    const normalizedEmail = email.trim().toLowerCase();

    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
    });

    if (!profile) throw new Error("UNAUTHORIZED: Invalid email or password");
    if (!profile.is_active) throw new Error("FORBIDDEN: Account is disabled");

    const isValid = await this.verifyOrMigrateLegacyPassword(profile, password);
    if (!isValid) throw new Error("UNAUTHORIZED: Invalid email or password");

    if (profile.password_reset_required) {
      throw new Error("PASSWORD_RESET_REQUIRED: You must reset your password on first login");
    }

    let tenantId = null;
    let tenantProfileCompleted = null;

    if (profile.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: profile.id },
        select: {
          id: true,
          profile_completed: true,
          status: true,
        }
      });
      if (tenant) {
        tenantId = tenant.id;
        tenantProfileCompleted = tenant.profile_completed;
        if (tenant.status === "INVITED") {
          throw new Error("FORBIDDEN: Account not activated. Please check your email.");
        }
      }
    }

    let effectiveOwnerId = profile.owner_id;
    if (profile.role === "OWNER" && (!effectiveOwnerId || effectiveOwnerId.trim() === "")) {
      console.warn("[auth.login] repairing missing owner_id for OWNER", { user_id: profile.id });
      const updated = await prisma.profile.update({
        where: { id: profile.id },
        data: { owner_id: profile.id },
        select: { owner_id: true },
      });
      effectiveOwnerId = updated.owner_id;
    }

    if (profile.role === "OWNER" && !effectiveOwnerId) {
      throw new Error("UNAUTHORIZED: Invalid OWNER: missing owner_id");
    }

    const session = await sessionLifecycleService.createSession(profile, meta);

    const token = await generateToken({
      sub: profile.id,
      role: profile.role,
      email: profile.email,
      owner_id: effectiveOwnerId || null,
      tenant_id: tenantId,
      sid: session.sessionId,
    });

    return {
      access_token: token,
      refresh_token: session.refreshToken,
      token_type: "bearer",
      role: profile.role,
      name: profile.name,
      user_id: profile.id,
      owner_id: effectiveOwnerId || null,
      tenant_id: tenantId,
      is_profile_completed: tenantId ? tenantProfileCompleted : profile.is_profile_completed,
    };
  }

  async loginWithPhone(phone: string, password: string, meta: AuthSessionMeta = {}) {
    const normalizedPhone = phone.trim();

    const profile = await prisma.profile.findFirst({
      where: {
        phone: normalizedPhone,
        role: "TENANT",
      },
    });

    if (!profile) throw new Error("UNAUTHORIZED: Invalid phone or password");
    if (!profile.is_active) throw new Error("FORBIDDEN: Account is disabled");

    const isValid = await this.verifyOrMigrateLegacyPassword(profile, password);
    if (!isValid) throw new Error("UNAUTHORIZED: Invalid phone or password");

    if (profile.password_reset_required) {
      if (profile.onboarding_expires_at && profile.onboarding_expires_at < new Date()) {
        throw new Error("ONBOARDING_EXPIRED: Your onboarding credentials have expired. Please contact the hostel owner for assistance.");
      }
      throw new Error("PASSWORD_RESET_REQUIRED: You must reset your password on first login");
    }

    const tenant = await prisma.tenants.findUnique({
      where: { profile_id: profile.id },
      select: {
        id: true,
        profile_completed: true,
        status: true,
      },
    });

    if (!tenant) {
      throw new Error("UNAUTHORIZED: Tenant record not found");
    }

    if (tenant.status === "INVITED") {
      throw new Error("FORBIDDEN: Account not activated. Please check your email.");
    }

    if (tenant.status !== "ACTIVE") {
      throw new Error("FORBIDDEN: Account is not active");
    }

    const session = await sessionLifecycleService.createSession(profile, meta);

    const token = await generateToken({
      sub: profile.id,
      role: profile.role,
      email: profile.email,
      owner_id: profile.owner_id || null,
      tenant_id: tenant.id,
      sid: session.sessionId,
    });

    return {
      access_token: token,
      refresh_token: session.refreshToken,
      token_type: "bearer",
      role: profile.role,
      name: profile.name,
      user_id: profile.id,
      owner_id: profile.owner_id || null,
      tenant_id: tenant.id,
      is_profile_completed: tenant.profile_completed,
      password_reset_required: profile.password_reset_required,
      is_imported: profile.is_imported,
    };
  }

  async resetOnboardingPassword(
    phone: string,
    currentPassword: string,
    newPassword: string
  ) {
    const normalizedPhone = phone.trim();

    const profile = await prisma.profile.findFirst({
      where: {
        phone: normalizedPhone,
        role: "TENANT",
        password_reset_required: true,
      },
    });

    if (!profile) {
      throw new Error("UNAUTHORIZED: Invalid request or password already reset");
    }

    const isValid = await this.verifyOrMigrateLegacyPassword(profile, currentPassword);
    if (!isValid) {
      throw new Error("UNAUTHORIZED: Current password is incorrect");
    }

    if (newPassword.length < 8) {
      throw new Error("VALIDATION_ERROR: New password must be at least 8 characters");
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      throw new Error("VALIDATION_ERROR: Password must contain at least one letter and one number");
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        password_hash: hashedNewPassword,
        password_reset_required: false,
        password_reset_at: new Date(),
        onboarding_expires_at: null,
      },
    });

    return {
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    };
  }

  async registerOwner(data: {
    email:    string;
    password: string;
    name:     string;
    phone?:   string;

    role?:    string;
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

    // 3. Hash password and create profile (no hostel — captured in onboarding step 2)
    const hashedPassword = await hashPassword(data.password);

    try {
      const profile = await prisma.profile.create({
        data: {
          id:       userId,
          email:    normalizedEmail,
          password_hash: hashedPassword,
          name:     data.name,
          phone:    data.phone || null,

          role:     "OWNER",
          is_active: true,
          owner_id:  userId,
        },
      });

      // Every new owner gets a FREE subscription row immediately.
      // Without this, all plan enforcement throws "No subscription found".
      await prisma.owner_subscriptions.upsert({
        where:  { owner_id: userId },
        update: {},
        create: {
          owner_id:   userId,
          plan_id:    "FREE",
          status:     "FREE",
          start_date: new Date(),
          auto_renew: false,
        },
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
    await prisma.token_blacklist.create({
      data: {
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { success: true };
  }

  async verifyUserPassword(userId: string, password: string): Promise<boolean> {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, password_hash: true },
    });
    if (!profile) return false;
    return this.verifyOrMigrateLegacyPassword(profile, password);
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
  async googleLogin(code: string, redirectUri?: string, meta: AuthSessionMeta = {}) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const effectiveRedirectUri = this.getGoogleCodeRedirectUri(redirectUri);

    if (!clientId || !clientSecret) {
      console.error("[auth.googleLogin] Google OAuth env vars missing", {
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
      });
      throw new Error("UNAUTHORIZED: Google login is not configured");
    }

    const exchangeCode = async (exchangeRedirectUri: string) => {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: exchangeRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (response.ok) return { response, redirectUri: exchangeRedirectUri, error: null as any };

      let error: any = null;
      try {
        error = await response.json();
      } catch {
        error = { statusText: response.statusText };
      }

      return { response, redirectUri: exchangeRedirectUri, error };
    };

    const exchangeRedirectUris: string[] = [effectiveRedirectUri];

    try {
      const parsed = new URL(effectiveRedirectUri);
      if (parsed.pathname === "/callback" && !parsed.search && !parsed.hash) {
        exchangeRedirectUris.push(parsed.origin);
      }
    } catch {
      // Non-URL redirect values such as "postmessage" are valid for Google token exchange.
    }

    // Google Identity Services popup code flow can require this sentinel redirect_uri.
    exchangeRedirectUris.push("postmessage");

    // 1. Exchange code for tokens. Try the exact redirect binding first, then
    // safe compatibility fallbacks for popup/browser-delivered auth codes.
    const uniqueRedirectUris = Array.from(new Set(exchangeRedirectUris.filter(Boolean)));
    let tokenExchange = await exchangeCode(uniqueRedirectUris[0]);
    const failedExchanges: Array<{ status: number; error?: string; error_description?: string; redirect_uri: string }> = [];

    if (!tokenExchange.response.ok) {
      failedExchanges.push({
        status: tokenExchange.response.status,
        error: tokenExchange.error?.error,
        error_description: tokenExchange.error?.error_description,
        redirect_uri: tokenExchange.redirectUri,
      });

      for (const fallbackRedirectUri of uniqueRedirectUris.slice(1)) {
        const fallbackExchange = await exchangeCode(fallbackRedirectUri);
        if (fallbackExchange.response.ok) {
          tokenExchange = fallbackExchange;
          break;
        }
        failedExchanges.push({
          status: fallbackExchange.response.status,
          error: fallbackExchange.error?.error,
          error_description: fallbackExchange.error?.error_description,
          redirect_uri: fallbackExchange.redirectUri,
        });
      }
    }

    if (!tokenExchange.response.ok) {
      const googleError = tokenExchange.error;
      console.error("[auth.googleLogin] Google code exchange failed", {
        status: tokenExchange.response.status,
        error: googleError?.error,
        error_description: googleError?.error_description,
        redirect_uri: tokenExchange.redirectUri,
        attempts: failedExchanges,
      });
      throw new Error("UNAUTHORIZED: Failed to exchange Google code");
    }

    const { access_token } = await tokenExchange.response.json();

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
      include: { tenants: true }
    });

    if (!profile) {
      // Create new profile for first-time Google login (default to OWNER/ADMIN for now as per Python)
      const newProfileId = crypto.randomUUID();
      profile = await prisma.profile.create({
        data: {
          id: newProfileId,
          email: normalizedEmail,
          name: name || "User",
          role: "OWNER",
          is_active: true,
          owner_id: newProfileId,
        },
        include: { tenants: true }
      });

      // Bootstrap FREE subscription for Google OAuth owners, same as email registration.
      await prisma.owner_subscriptions.upsert({
        where: { owner_id: newProfileId },
        update: {},
        create: {
          owner_id: newProfileId,
          plan_id: "FREE",
          status: "FREE",
          start_date: new Date(),
          auto_renew: false,
        },
      });
    }

    if (!profile.is_active) {
      throw new Error("FORBIDDEN: Account is disabled");
    }

    let tenantId = profile.tenants?.id || null;
    let tenantProfileCompleted = profile.tenants ? profile.tenants.profile_completed : profile.is_profile_completed;

    if (profile.role === "TENANT" && profile.tenants?.status === "INVITED") {
      throw new Error("FORBIDDEN: Account not activated. Please check your email.");
    }

    let effectiveOwnerId = profile.owner_id;
    if (profile.role === "OWNER" && (!effectiveOwnerId || effectiveOwnerId.trim() === "")) {
      console.warn("[auth.googleLogin] repairing missing owner_id for OWNER", { user_id: profile.id });
      const updated = await prisma.profile.update({
        where: { id: profile.id },
        data: { owner_id: profile.id },
        select: { owner_id: true },
      });
      effectiveOwnerId = updated.owner_id;
    }

    if (profile.role === "OWNER" && !effectiveOwnerId) {
      throw new Error("UNAUTHORIZED: Invalid OWNER: missing owner_id");
    }

    const session = await sessionLifecycleService.createSession(profile, meta);

    // 4. Create local JWT
    const token = await generateToken({
      sub: profile.id,
      role: profile.role,
      email: profile.email,
      owner_id: effectiveOwnerId || null,
      tenant_id: tenantId,
      sid: session.sessionId,
    });

    return {
      access_token: token,
      refresh_token: session.refreshToken,
      token_type: "bearer",
      role: profile.role,
      name: profile.name,
      user_id: profile.id,
      owner_id: effectiveOwnerId || null,
      tenant_id: tenantId,
      is_profile_completed: tenantProfileCompleted,
    };
  }
}

export const authService = new AuthService();
