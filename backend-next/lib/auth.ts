/**
 * Full auth utilities (Node.js runtime only).
 * Re-exports everything from auth-edge + adds bcrypt password functions.
 * API route handlers should import from here.
 */
import bcrypt from "bcryptjs";

// Re-export all Edge-compatible utilities
export {
  verifyToken,
  generateToken,
  getSession,
  apiResponse,
  apiError,
} from "./auth-edge";

export type { AuthPayload } from "./auth-edge";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
