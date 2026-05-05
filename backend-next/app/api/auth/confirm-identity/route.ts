export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { generateIdentityToken } from "@/lib/auth-edge";
import { apiError } from "@/lib/utils/api-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("auth.confirm-identity");

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX       = 5;       // max attempts per window

// Simple in-memory attempt tracker — good enough for a Node.js single-process route.
// For multi-instance deployments this should be moved to Redis or action_logs table.
const attemptMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = attemptMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attemptMap.set(userId, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

/**
 * POST /api/auth/confirm-identity
 *
 * Step 1 of secure offline payment flow.
 * Verifies the authenticated owner's password and issues a short-lived
 * identity token (2 min, purpose-scoped to OFFLINE_PAYMENT).
 *
 * The token:
 *  - Cannot be used as a session token (no role/email claims)
 *  - Cannot be reused after expiry
 *  - Is scoped to a single purpose — useless for any other endpoint
 *  - Is signed with the same JWT_SECRET so it degrades to zero-trust if the
 *    secret rotates (which automatically invalidates all tokens)
 *
 * Security:
 *  - Requires valid session (middleware enforces JWT auth)
 *  - Rate-limited: max 5 wrong-password attempts per minute
 *  - Wrong password → generic 401 (no user enumeration)
 */
export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) return apiError("Unauthorized", "UNAUTHORIZED", 401);
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return apiError("Only owners can perform this action", "FORBIDDEN", 403);
    }

    if (isRateLimited(user.id)) {
      logger.warn("auth.confirm_identity.rate_limited", { user_id: user.id });
      return apiError("Too many attempts. Please wait a moment.", "RATE_LIMIT", 429);
    }

    const body = await req.json().catch(() => ({}));
    const { password } = body;

    if (!password || typeof password !== "string" || password.length < 1) {
      return apiError("Password is required", "VALIDATION_ERROR", 400);
    }

    const isValid = await authService.verifyUserPassword(user.id, password);

    if (!isValid) {
      logger.warn("auth.confirm_identity.invalid_password", { user_id: user.id });
      return apiError("Invalid credentials", "UNAUTHORIZED", 401);
    }

    // Clear the rate-limit counter on success (optional — prevents lockout on one typo)
    attemptMap.delete(user.id);

    const identityToken = await generateIdentityToken(user.id, "OFFLINE_PAYMENT");

    logger.info("auth.confirm_identity.issued", { user_id: user.id });

    return NextResponse.json({
      identity_token: identityToken,
      expires_in: 120,
      purpose: "OFFLINE_PAYMENT",
    });
  } catch (error: any) {
    logger.error("auth.confirm_identity.error", { error: error.message });
    return apiError("Identity confirmation failed", "INTERNAL_ERROR", 500);
  }
}
