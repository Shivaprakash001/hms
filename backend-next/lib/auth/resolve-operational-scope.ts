import { prisma } from "../db";
import type { AuthPayload } from "../auth-edge";

export type OwnerScope = {
  actor_id: string;
  owner_id: string;
  role: "OWNER" | "ADMIN";
  is_admin: boolean;
};

export type TenantScope = {
  actor_id: string;
  tenant_id: string;
  owner_id: string;
  hostel_id: string | null;
  role: "TENANT";
};

export type AdminScope = {
  actor_id: string;
  role: "ADMIN";
};

function forbidden(message: string) {
  const err: any = new Error(`FORBIDDEN: ${message}`);
  err.code = "FORBIDDEN";
  return err;
}

function unauthorized(message: string) {
  const err: any = new Error(`UNAUTHORIZED: ${message}`);
  err.code = "UNAUTHORIZED";
  return err;
}

/**
 * Resolve the operational owner boundary for owner routes.
 *
 * OWNER sessions are only allowed to operate as themselves. We intentionally do
 * not use `session.owner_id || session.sub`, because that silently converts a
 * malformed token into a global data boundary failure.
 */
export function resolveOwnerScope(session: AuthPayload | null, options: { allowAdmin?: boolean; ownerId?: string } = {}): OwnerScope {
  if (!session) throw unauthorized("Authentication required");

  if (session.role === "OWNER") {
    if (!session.owner_id) throw unauthorized("OWNER token missing owner_id");
    if (session.owner_id !== session.sub) throw unauthorized("OWNER token owner_id mismatch");
    return { actor_id: session.sub, owner_id: session.owner_id, role: "OWNER", is_admin: false };
  }

  if (session.role === "ADMIN" && options.allowAdmin) {
    if (!options.ownerId) throw forbidden("Admin owner scope requires explicit ownerId");
    return { actor_id: session.sub, owner_id: options.ownerId, role: "ADMIN", is_admin: true };
  }

  throw forbidden("Owner access required");
}

/** Resolve tenant scope from the tenant table, not from caller-supplied owner IDs. */
export async function resolveTenantScope(session: AuthPayload | null): Promise<TenantScope> {
  if (!session) throw unauthorized("Authentication required");
  if (session.role !== "TENANT") throw forbidden("Tenant access required");

  const tenant = await prisma.tenants.findUnique({
    where: { profile_id: session.sub },
    select: { id: true, owner_id: true, hostel_id: true },
  });

  if (!tenant || !tenant.owner_id) throw unauthorized("Tenant operational scope unavailable");
  return {
    actor_id: session.sub,
    tenant_id: tenant.id,
    owner_id: tenant.owner_id,
    hostel_id: tenant.hostel_id,
    role: "TENANT",
  };
}

/** Admin bypass is explicit and should only be used from /api/admin/** routes. */
export function resolveAdminScope(session: AuthPayload | null): AdminScope {
  if (!session) throw unauthorized("Authentication required");
  if (session.role !== "ADMIN") throw forbidden("Admin access required");
  return { actor_id: session.sub, role: "ADMIN" };
}
