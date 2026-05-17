/**
 * PhonePe Environment Resolution
 *
 * Single source of truth for PHONEPE_ENV parsing.
 * No implicit fallback to SANDBOX — missing or invalid values throw
 * immediately so production traffic never silently hits sandbox endpoints.
 *
 * Accepted values (case-insensitive):
 *   - "production"  →  live PhonePe OAuth + checkout endpoints
 *   - "sandbox"     →  UAT/preprod endpoints (test credentials only)
 *
 * Previously accepted aliases ("prod", "live") are intentionally rejected to
 * prevent ambiguity.  Update any deployment config to use the canonical values.
 */

export type PhonePeResolvedEnv = "production" | "sandbox";

const VALID_VALUES = ["production", "sandbox"] as const;

/** Memoised result — validation runs exactly once per process lifetime. */
let _cached: PhonePeResolvedEnv | null = null;

/**
 * Validate and return the resolved PhonePe runtime environment.
 *
 * Throws CONFIG_ERROR when:
 *   - PHONEPE_ENV is unset or empty
 *   - PHONEPE_ENV holds an unrecognised value (e.g. "prod", "live", "UAT")
 *
 * On first successful call emits:
 *   [PhonePe] Runtime environment resolved: PRODUCTION | SANDBOX
 */
export function resolvePhonePeEnvironment(): PhonePeResolvedEnv {
  if (_cached !== null) return _cached;

  const raw = process.env.PHONEPE_ENV;

  if (!raw || raw.trim() === "") {
    throw new Error(
      "CONFIG_ERROR: PHONEPE_ENV is not set. " +
      "Set PHONEPE_ENV=production for live payments or PHONEPE_ENV=sandbox for testing. " +
      "Implicit SANDBOX fallback has been removed to prevent silent production misconfiguration."
    );
  }

  const normalised = raw.trim().toLowerCase();

  if (normalised !== "production" && normalised !== "sandbox") {
    throw new Error(
      `CONFIG_ERROR: PHONEPE_ENV="${raw}" is not a recognised value. ` +
      `Accepted values: ${VALID_VALUES.join(", ")}. ` +
      "Previously accepted aliases (prod, live) are no longer supported — use 'production'."
    );
  }

  _cached = normalised as PhonePeResolvedEnv;

  console.info(`[PhonePe] Runtime environment resolved: ${_cached.toUpperCase()}`);

  return _cached;
}

/**
 * Reset the memoised environment value.
 * TEST USE ONLY — do not call in production code.
 */
export function _resetPhonePeEnvironmentCache(): void {
  _cached = null;
}
