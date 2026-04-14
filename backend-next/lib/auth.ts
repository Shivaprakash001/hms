import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default_hms_secret_key_change_me");

export interface AuthPayload {
  sub: string;
  email: string;
  role: string;
  owner_id?: string | null;
  student_id?: string | null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function generateToken(payload: AuthPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
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
 * Legacy session helper (Updated to use headers from middleware)
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
