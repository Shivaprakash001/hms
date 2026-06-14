/**
 * 🛡️ Authentication Hardening Security Tests
 *
 * These tests enforce the Single Owner Controlled Authentication Model.
 * They verify that:
 *   1. Google OAuth CANNOT auto-create any accounts
 *   2. Google OAuth CANNOT create OWNER accounts
 *   3. Owner registration is blocked without bootstrap flag
 *   4. Tenant login paths never create accounts
 *   5. Legacy migration code is disabled
 *   6. No public route can escalate to OWNER role
 *
 * These are architectural invariant tests — they read source code to prove
 * that dangerous patterns do not exist, regardless of runtime conditions.
 */

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Google OAuth — No Auto-Provisioning
// ────────────────────────────────────────────────────────────────────────────

describe("Google OAuth security: no auto-provisioning", () => {
  const authService = read("lib/services/auth-service.ts");
  // googleLogin is the last method — extract from its start to end of file
  const methodStart = authService.indexOf("async googleLogin(");
  const methodBody = authService.slice(methodStart);

  it("googleLogin method exists", () => {
    expect(methodStart).toBeGreaterThan(-1);
  });

  it("googleLogin does NOT contain profile.create", () => {
    expect(methodBody).not.toContain("profile.create");
    expect(methodBody).not.toContain("prisma.profile.create");
  });

  it("googleLogin does NOT contain findOrCreate pattern", () => {
    expect(methodBody).not.toMatch(/create\s+new\s+profile/i);
    expect(methodBody).not.toMatch(/first.time.*login/i);
    expect(methodBody).not.toMatch(/default\s+to\s+OWNER/i);
  });

  it("googleLogin rejects unknown emails with UNAUTHORIZED", () => {
    expect(methodBody).toContain("UNAUTHORIZED");
    expect(methodBody).toMatch(/no\s+account\s+found/i);
  });

  it("googleLogin rejects TENANT accounts from Google OAuth", () => {
    expect(methodBody).toContain("TENANT");
    expect(methodBody).toMatch(/Google sign-in is not available for tenant/i);
  });

  it("googleLogin logs rejected attempts to event log", () => {
    expect(methodBody).toContain("AUTH_GOOGLE_REJECTED");
    expect(methodBody).toContain("NO_EXISTING_ACCOUNT");
    expect(methodBody).toContain("ACCOUNT_DISABLED");
    expect(methodBody).toContain("TENANT_GOOGLE_NOT_ALLOWED");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Google OAuth Callback Route — No Bypass
// ────────────────────────────────────────────────────────────────────────────

describe("Google OAuth callback route security", () => {
  const callbackRoute = read("app/api/auth/google-callback/route.ts");

  it("delegates to authService.googleLogin only (no inline creation)", () => {
    expect(callbackRoute).toContain("authService.googleLogin");
    expect(callbackRoute).not.toContain("profile.create");
    expect(callbackRoute).not.toContain("prisma");
  });

  it("does not import prisma directly", () => {
    expect(callbackRoute).not.toMatch(/import.*prisma/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Owner Registration — Bootstrap-Only Guard
// ────────────────────────────────────────────────────────────────────────────

describe("Owner registration is bootstrap-only", () => {
  const authService = read("lib/services/auth-service.ts");

  it("registerOwner checks for ALLOW_OWNER_BOOTSTRAP env var", () => {
    const methodStart = authService.indexOf("async registerOwner(");
    expect(methodStart).toBeGreaterThan(-1);
    const methodBody = authService.slice(methodStart, methodStart + 2000);

    expect(methodBody).toContain("ALLOW_OWNER_BOOTSTRAP");
    expect(methodBody).toContain("FORBIDDEN");
  });

  it("registerOwner logs blocked attempts", () => {
    const methodStart = authService.indexOf("async registerOwner(");
    const methodBody = authService.slice(methodStart, methodStart + 2000);

    expect(methodBody).toContain("OWNER_CREATION_BLOCKED");
  });

  it("register route requires ADMIN role", () => {
    const registerRoute = read("app/api/auth/register/route.ts");

    expect(registerRoute).toContain("ADMIN");
    expect(registerRoute).toMatch(/role.*ADMIN|session.*role/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Email/Password Login — No Account Creation
// ────────────────────────────────────────────────────────────────────────────

describe("Email/password login: no account creation", () => {
  const authService = read("lib/services/auth-service.ts");

  it("login method does not create profiles", () => {
    // The login method is the first significant method in the class
    const loginStart = authService.indexOf("async login(");
    expect(loginStart).toBeGreaterThan(-1);

    // Extract until the next async method
    const nextMethod = authService.indexOf("async ", loginStart + 20);
    const loginBody = authService.slice(loginStart, nextMethod);

    expect(loginBody).not.toContain("profile.create");
    expect(loginBody).not.toContain("prisma.profile.create");
  });

  it("loginWithPhone does not create profiles", () => {
    const methodStart = authService.indexOf("async loginWithPhone(");
    expect(methodStart).toBeGreaterThan(-1);

    const nextMethod = authService.indexOf("async ", methodStart + 20);
    const methodBody = authService.slice(methodStart, nextMethod);

    expect(methodBody).not.toContain("profile.create");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Legacy Migration — Permanently Disabled
// ────────────────────────────────────────────────────────────────────────────

describe("Legacy tenant migration is permanently disabled", () => {
  const migrationService = read("lib/services/tenant-migration-service.ts");

  it("does not contain active profile creation code", () => {
    expect(migrationService).not.toContain("prisma.profile.create");
    expect(migrationService).not.toContain("tx.profile.create");
    expect(migrationService).not.toContain("prisma.tenants.create");
  });

  it("createMigrationTenant throws LEGACY_IMPORT_DISABLED", () => {
    expect(migrationService).toContain("LEGACY_IMPORT_DISABLED");
  });

  it("bulkImportTenants throws LEGACY_IMPORT_DISABLED", () => {
    // Count occurrences - both methods should throw
    const matches = migrationService.match(/LEGACY_IMPORT_DISABLED/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Tenant Lifecycle — Invitation-Only Profile Creation
// ────────────────────────────────────────────────────────────────────────────

describe("Tenant profiles are only created through invitation lifecycle", () => {
  it("invitation lifecycle only creates TENANT role profiles", () => {
    const lifecycleService = read("src/services/tenants/tenant-invitation-lifecycle-service.ts");

    // Every profile.create in this service must specify role: "TENANT"
    const createBlocks = lifecycleService.match(/profile\.create\(\{[\s\S]*?\}\)/g) || [];
    for (const block of createBlocks) {
      expect(block).toContain("TENANT");
      expect(block).not.toContain('"OWNER"');
      expect(block).not.toContain('"ADMIN"');
    }
  });

  it("invitation service requires owner_id context", () => {
    const invitationService = read("src/services/tenants/invitation-service.ts");

    // profile.create calls must include owner_id
    const createBlocks = invitationService.match(/profile\.create\(\{[\s\S]*?\}\)/g) || [];
    for (const block of createBlocks) {
      expect(block).toContain("owner_id");
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Boot-Time Security Guard
// ────────────────────────────────────────────────────────────────────────────

describe("Boot-time owner integrity guard exists", () => {
  it("owner-integrity-guard module exists", () => {
    const guardPath = path.join(root, "lib/security/owner-integrity-guard.ts");
    expect(fs.existsSync(guardPath)).toBe(true);
  });

  it("assertOwnerIntegrity function is exported", () => {
    const guard = read("lib/security/owner-integrity-guard.ts");
    expect(guard).toContain("export async function assertOwnerIntegrity");
  });

  it("checks for unexpected owner count", () => {
    const guard = read("lib/security/owner-integrity-guard.ts");
    expect(guard).toContain("MAX_EXPECTED_OWNERS");
    expect(guard).toContain("OWNER_INTEGRITY_VIOLATION");
  });

  it("instrumentation.ts calls assertOwnerIntegrity on startup", () => {
    const instrumentation = read("instrumentation.ts");
    expect(instrumentation).toContain("assertOwnerIntegrity");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. No Public Route Creates OWNER Profiles
// ────────────────────────────────────────────────────────────────────────────

describe("No public auth route creates OWNER profiles", () => {
  const publicRoutes = [
    "app/api/auth/login/route.ts",
    "app/api/auth/onboarding-login/route.ts",
    "app/api/auth/google-callback/route.ts",
  ];

  for (const routePath of publicRoutes) {
    it(`${routePath} does not contain profile.create`, () => {
      const source = read(routePath);
      expect(source).not.toContain("profile.create");
      expect(source).not.toContain("prisma.profile.create");
    });

    it(`${routePath} does not assign OWNER role`, () => {
      const source = read(routePath);
      // Route handlers should never directly assign roles
      expect(source).not.toMatch(/role.*["']OWNER["']/);
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Operational Scope Guards Exist
// ────────────────────────────────────────────────────────────────────────────

describe("Operational scope guards enforce role boundaries", () => {
  const scopeModule = read("lib/auth/resolve-operational-scope.ts");

  it("resolveOwnerScope requires OWNER role", () => {
    expect(scopeModule).toContain("Owner access required");
  });

  it("resolveOwnerScope validates owner_id matches session.sub", () => {
    expect(scopeModule).toContain("owner_id mismatch");
  });

  it("resolveTenantScope requires TENANT role", () => {
    expect(scopeModule).toContain("Tenant access required");
  });
});
