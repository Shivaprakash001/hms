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
    .setExpirationTime("1h")
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

  if (!userId || !userRole) return null;

  return {
    sub: userId,
    role: userRole,
    email: userEmail || "",
    owner_id: ownerId
  };
}

export function apiResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, code = "ERROR", status = 500) {
  return NextResponse.json({ error: { message, code } }, { status });
}
