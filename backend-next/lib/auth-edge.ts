/**
 * Edge-compatible auth utilities.
 * This file MUST NOT import any Node.js-only modules (e.g. bcryptjs).
 * It is used by middleware.ts which runs in the Edge Runtime.
 */
import { jwtVerify, SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default_hms_secret_key_change_me");

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
  owner_id?: string | null;
  tenant_id?: string | null;
  sid?: string | null;
  iat?: number;
}

function assertOwnerPayload(payload: AuthPayload) {
  if (payload.role === "OWNER" && !payload.owner_id) {
    throw new Error("Invalid OWNER: missing owner_id");
  }
}

export async function generateToken(payload: AuthPayload) {
  assertOwnerPayload(payload);
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("20m")
    .sign(JWT_SECRET);
}

/**
 * Generate a short-lived token (60s) for SSE connections.
 * Even if URL-logged, it expires almost immediately.
 */
export async function generateShortToken(payload: AuthPayload) {
  assertOwnerPayload(payload);
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(JWT_SECRET);
}

/**
 * Verify JWT token without DB checks (Edge compatible)
 */
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Session helper — reads user context from headers set by middleware.
 */
export async function getSession(req: NextRequest): Promise<AuthPayload | null> {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role");
  const userEmail = req.headers.get("x-user-email");
  const ownerId = req.headers.get("x-owner-id");
  const tenantId = req.headers.get("x-tenant-id");

  if (!userId || !userRole) return null;

  return {
    sub: userId,
    role: userRole,
    email: userEmail || "",
    owner_id: ownerId,
    tenant_id: tenantId,
    sid: req.headers.get("x-session-id"),
  };
}

/**
 * Generate a 2-minute single-use identity confirmation token.
 *
 * Claims:
 *  - jti:     unique token ID — persisted in DB and consumed on first use
 *  - purpose: broad scope ("OFFLINE_PAYMENT") — matches DB record
 *  - action:  specific operation ("record_offline_payment") — prevents reuse
 *             across future sensitive actions even with the same purpose
 *
 * A regular session token never carries these claims, and this token never
 * carries role/email — the two types are fully disjoint.
 */
export async function generateIdentityToken(
  userId: string,
  purpose: string,
  jti: string,
  action: string
): Promise<string> {
  return new SignJWT({ sub: userId, purpose, action, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(JWT_SECRET);
}

/**
 * Verify an identity token and confirm purpose + action claims.
 * Returns { userId, jti, action } on success; null on any failure.
 * The caller is responsible for DB-level single-use enforcement using the jti.
 */
export async function verifyIdentityToken(
  token: string,
  expectedPurpose: string,
  expectedAction: string
): Promise<{ userId: string; jti: string; action: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.purpose !== expectedPurpose) return null;
    if (payload.action !== expectedAction) return null;
    if (!payload.sub || !payload.jti) return null;
    return {
      userId: payload.sub as string,
      jti: payload.jti as string,
      action: payload.action as string,
    };
  } catch {
    return null;
  }
}

export function apiResponse(data: any, status = 200) {
  return NextResponse.json({
    success: true,
    ...(typeof data === 'object' && !Array.isArray(data) ? data : { data })
  }, { status });
}

export function apiError(message: string, code = "ERROR", status = 500) {
  return NextResponse.json({ 
    success: false,
    error: { message, code } 
  }, { status });
}
