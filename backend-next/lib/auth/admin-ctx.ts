import type { NextRequest } from "next/server";
import { getSession } from "../auth";
import type { AdminCtx } from "../services/settlement-batch-service";

/**
 * Admin gate for /api/admin/** settlement routes.
 *
 * Returns an AdminCtx (admin id + ip + user-agent) ready to pass into
 * settlementBatchService methods, OR `null` when the caller is not an
 * authenticated ADMIN. Route handlers should reply 401/403 in the null case.
 *
 * The IP and user-agent are captured for the audit log so we have a complete
 * trail of who initiated each treasury action and from where.
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
