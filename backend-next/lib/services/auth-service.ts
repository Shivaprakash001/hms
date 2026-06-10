import { prisma, supabase } from "../db";
import { verifyPassword, hashPassword, generateToken, generateResetToken, verifyResetToken } from "../auth";
import { EmailService } from "./email-service";
import { z } from "zod";
import { LoginSchema } from "../validators";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { frontendUrl, getGoogleRedirectUri } from "../config/domains";
import { sessionLifecycleService } from "./session-lifecycle-service";
import { eventLog } from "./event-log-service";
import { setOneTimeLock } from "@/lib/redis/rate-limit";
import { redisKeys } from "@/lib/redis/keys";

type AuthSessionMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type CompletePasswordResetInput = {
  code?: string;
  accessToken?: string;
  newPassword: string;
  meta?: AuthSessionMeta;
};

const GENERIC_RESET_RESPONSE = {
  success: true,
  message: "If an account exists for this email, Supabase will send password reset instructions.",
};

function tokenFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isolatedSupabaseAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

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

  async login(emailOrPhone: string, password: string, meta: AuthSessionMeta = {}) {
    const cleanIdentifier = emailOrPhone.trim();
    let profile;
    if (cleanIdentifier.includes("@")) {
      profile = await prisma.profile.findUnique({
        where: { email: cleanIdentifier.toLowerCase() },
      });
    } else {
      const cleanPhone = cleanIdentifier.replace(/[^\d+]/g, "");
      const searchPhones = [cleanPhone];
      if (cleanPhone.startsWith("+91")) {
        searchPhones.push(cleanPhone.substring(1), cleanPhone.substring(3));
      } else if (cleanPhone.startsWith("91") && cleanPhone.length === 12) {
        searchPhones.push("+" + cleanPhone, cleanPhone.substring(2));
      } else if (cleanPhone.length === 10) {
        searchPhones.push("+91" + cleanPhone, "91" + cleanPhone);
      }
      profile = await prisma.profile.findFirst({
        where: {
          phone: {
            in: searchPhones
          }
        }
      });
    }

    if (!profile) throw new Error("UNAUTHORIZED: Invalid email, phone, or password");
    if (!profile.is_active) throw new Error("FORBIDDEN: Account is disabled");

    const isValid = await this.verifyOrMigrateLegacyPassword(profile, password);
    if (!isValid) throw new Error("UNAUTHORIZED: Invalid email, phone, or password");

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

    const sessionProfile = { ...profile, owner_id: effectiveOwnerId || null };
    const session = await sessionLifecycleService.createSession(sessionProfile, meta);

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

    const sessionProfile = { ...profile, owner_id: profile.owner_id || null };
    const session = await sessionLifecycleService.createSession(sessionProfile, meta);

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

  private async ensureSupabaseResetIdentity(email: string) {
    const password = `${randomBytes(24).toString("base64url")}Aa1!`;
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { hms_password_reset_only: true },
    });

    if (!error) return;
    const message = String(error.message || "").toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return;
    }
    throw error;
  }

  async requestPasswordReset(email: string, meta: AuthSessionMeta = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, role: true, owner_id: true, is_active: true, name: true },
    });

    if (!profile || !profile.is_active) {
      return GENERIC_RESET_RESPONSE;
    }

    try {
      const resetToken = await generateResetToken(normalizedEmail);
      const resetLink = frontendUrl(`/reset-password?access_token=${resetToken}`);

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;border:1px solid #eadfce;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1B2D5B,#2a427e);padding:28px 24px;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;color:#ffffff;">Reset Your Password</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:14px;color:#eadfce;">Sri Adithya Hostels Account Recovery</p>
          </div>
          <div style="padding:24px;color:#1e293b;line-height:1.6;background:#FFFDF5;">
            <p>Hello <strong>${profile.name || "User"}</strong>,</p>
            <p>We received a request to reset the password for your account. Click the button below to choose a new password. This link is valid for 1 hour.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${resetLink}" target="_blank" style="display:inline-block;background:#F07B1D;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px;">
                Reset Password
              </a>
            </div>
            <p style="font-size:12px;color:#94a3b8;text-align:center;">If you did not request this, you can safely ignore this email.</p>
          </div>
        </div>
      `;

      await EmailService.sendEmail(normalizedEmail, "Reset your Sri Adithya Hostels password", html);

      await eventLog.log("PASSWORD_RESET_REQUESTED", profile.owner_id || profile.id, {
        profile_id: profile.id,
        role: profile.role,
        email: normalizedEmail,
        ip_address: meta.ipAddress || null,
        user_agent: meta.userAgent || null,
      });
    } catch (error) {
      console.error("[auth.requestPasswordReset] Custom reset email failed", {
        email: normalizedEmail,
        profile_id: profile.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return GENERIC_RESET_RESPONSE;
  }

  async completePasswordReset(input: CompletePasswordResetInput) {
    if (input.newPassword.length < 8) {
      throw new Error("VALIDATION_ERROR: Password must be at least 8 characters");
    }

    const token = input.code || input.accessToken;
    if (!token) {
      throw new Error("VALIDATION_ERROR: Reset token is required");
    }

    const resetPayload = await verifyResetToken(token);
    if (!resetPayload || !resetPayload.email) {
      throw new Error("VALIDATION_ERROR: Reset link is invalid or expired");
    }

    const fingerprint = tokenFingerprint(token);
    const firstUse = await setOneTimeLock(redisKeys.passwordReset.usedToken(fingerprint), 60 * 60);
    if (!firstUse) {
      throw new Error("VALIDATION_ERROR: Reset link has already been used");
    }

    const normalizedEmail = resetPayload.email.trim().toLowerCase();
    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, role: true, owner_id: true, is_active: true },
    });

    if (!profile || !profile.is_active) {
      throw new Error("VALIDATION_ERROR: Reset link is invalid or expired");
    }

    const newHash = await hashPassword(input.newPassword);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        password_hash: newHash,
        password_reset_required: false,
        password_reset_at: new Date(),
      },
    });

    await sessionLifecycleService.revokeSession(undefined, profile.id);

    try {
      const authClient = isolatedSupabaseAuthClient();
      const { data: userData } = await authClient.auth.admin.listUsers();
      const sbUser = userData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
      if (sbUser) {
        await authClient.auth.admin.updateUserById(sbUser.id, {
          password: input.newPassword,
        });
      }
    } catch (e) {
      console.warn("[auth.completePasswordReset] Supabase sync skipped/failed", e);
    }

    await eventLog.log("PASSWORD_RESET_COMPLETED", profile.owner_id || profile.id, {
      profile_id: profile.id,
      role: profile.role,
      email: normalizedEmail,
      ip_address: input.meta?.ipAddress || null,
      user_agent: input.meta?.userAgent || null,
    });

    return {
      success: true,
      message: "Password reset successfully. Please sign in with your new password.",
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

    const sessionProfile = { ...profile, owner_id: effectiveOwnerId || null };
    const session = await sessionLifecycleService.createSession(sessionProfile, meta);

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
