/**
 * Full auth utilities (Node.js runtime only).
 * Re-exports everything from auth-edge + adds bcrypt password functions.
 * API route handlers should import from here.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Re-export all Edge-compatible utilities
export {
  verifyToken,
  generateToken,
  generateShortToken,
  getSession,
  apiResponse,
  apiError,
} from "./auth-edge";

export type { AuthPayload } from "./auth-edge";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
