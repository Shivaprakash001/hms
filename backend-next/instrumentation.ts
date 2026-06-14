/**
 * Next.js Instrumentation Hook
 *
 * Runs once on server startup. Used for boot-time security assertions
 * and system integrity checks.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run security checks on the Node.js server, not on Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { assertOwnerIntegrity } = await import("./lib/security/owner-integrity-guard");
      await assertOwnerIntegrity();
    } catch (err: any) {
      console.error("[instrumentation] Owner integrity check failed:", err?.message || err);
    }
  }
}
