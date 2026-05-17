/**
 * Invariant tests: PhonePe environment resolution
 *
 * Run: npx tsx src/services/payments/phonepe-env.test.ts
 *
 * These tests guard against:
 *   - Silent SANDBOX fallback on unset / invalid env
 *   - Acceptance of deprecated aliases (prod, live)
 *   - Case-sensitivity regressions
 *   - Memoisation correctness
 */
import { resolvePhonePeEnvironment, _resetPhonePeEnvironmentCache } from "./phonepe-env";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function reset() {
  _resetPhonePeEnvironmentCache();
  delete process.env.PHONEPE_ENV;
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const msg = `  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    failures.push(msg);
    console.error(msg);
  }
}

function expectThrow(fn: () => unknown, pattern: RegExp, label: string) {
  try {
    fn();
    failed++;
    const msg = `  ✗ ${label}: expected throw but resolved successfully`;
    failures.push(msg);
    console.error(msg);
  } catch (err: any) {
    if (pattern.test(String(err))) {
      passed++;
      console.log(`  ✓ ${label}`);
    } else {
      failed++;
      const msg = `  ✗ ${label}: expected pattern ${pattern}, got: ${String(err)}`;
      failures.push(msg);
      console.error(msg);
    }
  }
}

// ── Valid values ──────────────────────────────────────────────────────────────

console.log("\nValid values:");

reset();
process.env.PHONEPE_ENV = "production";
assertEq(resolvePhonePeEnvironment(), "production", '"production" resolves to "production"');

reset();
process.env.PHONEPE_ENV = "PRODUCTION";
assertEq(resolvePhonePeEnvironment(), "production", '"PRODUCTION" (uppercase) resolves to "production"');

reset();
process.env.PHONEPE_ENV = "Production";
assertEq(resolvePhonePeEnvironment(), "production", '"Production" (mixed case) resolves to "production"');

reset();
process.env.PHONEPE_ENV = "  production  ";
assertEq(resolvePhonePeEnvironment(), "production", '"  production  " (whitespace padded) resolves to "production"');

reset();
process.env.PHONEPE_ENV = "sandbox";
assertEq(resolvePhonePeEnvironment(), "sandbox", '"sandbox" resolves to "sandbox"');

reset();
process.env.PHONEPE_ENV = "SANDBOX";
assertEq(resolvePhonePeEnvironment(), "sandbox", '"SANDBOX" (uppercase) resolves to "sandbox"');

reset();
process.env.PHONEPE_ENV = "  SANDBOX  ";
assertEq(resolvePhonePeEnvironment(), "sandbox", '"  SANDBOX  " (whitespace padded) resolves to "sandbox"');

// ── Missing / empty — must throw, never fall back ─────────────────────────────

console.log("\nMissing / empty (must throw — no silent fallback):");

reset();
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*PHONEPE_ENV is not set/,
  "unset PHONEPE_ENV throws CONFIG_ERROR"
);

reset();
process.env.PHONEPE_ENV = "";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*PHONEPE_ENV is not set/,
  'empty string "" throws CONFIG_ERROR'
);

reset();
process.env.PHONEPE_ENV = "   ";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*PHONEPE_ENV is not set/,
  'whitespace-only "   " throws CONFIG_ERROR'
);

// ── Deprecated aliases — must throw ──────────────────────────────────────────

console.log("\nDeprecated / unrecognised values (must throw):");

reset();
process.env.PHONEPE_ENV = "prod";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*not a recognised value/,
  '"prod" (deprecated alias) throws CONFIG_ERROR'
);

reset();
process.env.PHONEPE_ENV = "live";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*not a recognised value/,
  '"live" (deprecated alias) throws CONFIG_ERROR'
);

reset();
process.env.PHONEPE_ENV = "UAT";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*not a recognised value/,
  '"UAT" throws CONFIG_ERROR'
);

reset();
process.env.PHONEPE_ENV = "test";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*not a recognised value/,
  '"test" throws CONFIG_ERROR'
);

reset();
process.env.PHONEPE_ENV = "1";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /CONFIG_ERROR.*not a recognised value/,
  '"1" throws CONFIG_ERROR'
);

// ── Memoisation ───────────────────────────────────────────────────────────────

console.log("\nMemoisation:");

reset();
process.env.PHONEPE_ENV = "production";
const first = resolvePhonePeEnvironment();
process.env.PHONEPE_ENV = "sandbox"; // change env after first call
const second = resolvePhonePeEnvironment();
assertEq(second, first, "subsequent call returns cached value, ignores env change");

// ── Error message quality ─────────────────────────────────────────────────────

console.log("\nError message quality:");

reset();
process.env.PHONEPE_ENV = "prod";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /Accepted values: production, sandbox/,
  'error message lists accepted values'
);

reset();
process.env.PHONEPE_ENV = "live";
expectThrow(
  () => resolvePhonePeEnvironment(),
  /Previously accepted aliases \(prod, live\) are no longer supported/,
  'error message mentions deprecated aliases'
);

reset();
expectThrow(
  () => resolvePhonePeEnvironment(),
  /Implicit SANDBOX fallback has been removed/,
  'missing env error explains why fallback was removed'
);

// ── Summary ───────────────────────────────────────────────────────────────────

reset(); // clean up env after tests
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  failures.forEach((f) => console.error(f));
  process.exit(1);
}
console.log("All phonepe-env invariant tests passed.\n");
