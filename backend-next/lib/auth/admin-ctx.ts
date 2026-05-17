import type { NextRequest } from "next/server";
import { getSession } from "../auth";

export interface AdminCtx {
  adminId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Admin gate for /api/admin/** routes.
 *
 * Returns an AdminCtx (admin id + ip + user-agent) or `null` when the
 * caller is not an authenticated ADMIN. Route handlers should reply
 * 401/403 in the null case.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminCtx | null> {
  const session = await getSession(req);
  if (!session || session.role !== "ADMIN") return null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  return { adminId: session.sub, ip, userAgent };
}
