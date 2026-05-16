/**
 * Merchant context regression suite.
 *
 * Run:
 *   DOTENV_CONFIG_PATH=../.env node -r dotenv/config ./node_modules/.bin/tsx \
 *     lib/services/payments/merchant-context.test.ts
 */

import { getProviderContext } from "./merchant-context";
import { PAYMENT_DOMAIN, PAYMENT_FLOW, PAYMENT_SCOPE, MERCHANT_CONTEXT } from "./financial-domain";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  OK ${name}`);
    passed++;
  } else {
    const msg = `  FAIL ${name}${detail ? ` — ${detail}` : ""}`;
    console.error(msg);
    failures.push(msg);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, name: string) {
  assert(actual === expected, name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function expectThrow(fn: () => Promise<any>, match: RegExp, name: string) {
  try {
    await fn();
  } catch (err: any) {
    if (match.test(String(err?.message ?? err))) {
      console.log(`  OK ${name}`);
      passed++;
      return;
    }
    const msg = `  FAIL ${name} — wrong message: ${err?.message ?? err}`;
    console.error(msg);
    failures.push(msg);
    failed++;
    return;
  }
  const msg = `  FAIL ${name} — no throw`;
  console.error(msg);
  failures.push(msg);
  failed++;
}

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const HOSTEL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function installPrismaHostelStub(ownerId = OWNER_A) {
  const dbModule: any = await import("../../db");
  dbModule.prisma.hostels.findUnique = async ({ where }: any) => {
    if (where?.id !== HOSTEL_A) return null;
    return {
      id: HOSTEL_A,
      owner_id: ownerId,
      name: "Treasury Hostel",
      upi_id: null,
      phonepe_merchant_id: null,
      owner: { id: ownerId, name: "Owner" },
    };
  };
}

function installPhonePeEnv() {
  process.env.PHONEPE_CLIENT_ID = "client-id";
  process.env.PHONEPE_CLIENT_SECRET = "client-secret";
  process.env.PHONEPE_CLIENT_VERSION = "1";
  process.env.PHONEPE_MERCHANT_ID = "merchant-id";
  process.env.PHONEPE_ENV = "SANDBOX";
}

async function test_rent_collection_uses_hms_treasury_context() {
  installPhonePeEnv();
  await installPrismaHostelStub(OWNER_A);

  const ctx = await getProviderContext({
    paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
    flowType: PAYMENT_FLOW.RENT,
    operationalOwnerId: OWNER_A,
    financialOwnerId: OWNER_A,
    hostelId: HOSTEL_A,
    scopeType: PAYMENT_SCOPE.HOSTEL,
  });

  assertEq(ctx.provider, "PHONEPE", "treasury rent: provider");
  assertEq(ctx.payment_domain, PAYMENT_DOMAIN.RENT_COLLECTION, "treasury rent: domain");
  assertEq(ctx.scope_type, PAYMENT_SCOPE.HOSTEL, "treasury rent: hostel scope");
  assertEq(ctx.merchant_context_type, MERCHANT_CONTEXT.HMS_TREASURY, "treasury rent: merchant context");
  assertEq(ctx.merchant_context_id, MERCHANT_CONTEXT.HMS_TREASURY, "treasury rent: merchant context id");
  assertEq(ctx.operational_owner_id, OWNER_A, "treasury rent: operational owner retained");
  assertEq(ctx.financial_owner_id, OWNER_A, "treasury rent: owner liability retained");
  assertEq(ctx.hostel_id, HOSTEL_A, "treasury rent: hostel retained");
  assertEq(ctx.config.clientId, "client-id", "treasury rent: PhonePe client id");
  assertEq(ctx.config.treasuryMode, true, "treasury rent: treasury mode flag");
}

async function test_advance_collection_uses_hms_treasury_context() {
  installPhonePeEnv();
  await installPrismaHostelStub(OWNER_A);

  const ctx = await getProviderContext({
    paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
    flowType: PAYMENT_FLOW.ADVANCE,
    operationalOwnerId: OWNER_A,
    hostelId: HOSTEL_A,
    scopeType: PAYMENT_SCOPE.HOSTEL,
  });

  assertEq(ctx.merchant_context_type, MERCHANT_CONTEXT.HMS_TREASURY, "treasury advance: merchant context");
  assertEq(ctx.financial_owner_id, OWNER_A, "treasury advance: owner liability retained");
}

async function test_cross_owner_hostel_rejected() {
  installPhonePeEnv();
  await installPrismaHostelStub(OWNER_B);

  await expectThrow(
    () => getProviderContext({
      paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
      flowType: PAYMENT_FLOW.RENT,
      operationalOwnerId: OWNER_A,
      hostelId: HOSTEL_A,
      scopeType: PAYMENT_SCOPE.HOSTEL,
    }),
    /HOSTEL_ACCESS_DENIED/,
    "treasury rent: cross-owner hostel rejected"
  );
}

async function test_missing_treasury_credentials_rejected() {
  await installPrismaHostelStub(OWNER_A);
  delete process.env.PHONEPE_CLIENT_ID;
  delete process.env.PHONEPE_CLIENT_SECRET;

  await expectThrow(
    () => getProviderContext({
      paymentDomain: PAYMENT_DOMAIN.RENT_COLLECTION,
      flowType: PAYMENT_FLOW.RENT,
      operationalOwnerId: OWNER_A,
      hostelId: HOSTEL_A,
      scopeType: PAYMENT_SCOPE.HOSTEL,
    }),
    /HMS treasury PhonePe credentials/,
    "treasury rent: missing credentials rejected"
  );
}

async function main() {
  console.log("Merchant context treasury-mode tests");
  await test_rent_collection_uses_hms_treasury_context();
  await test_advance_collection_uses_hms_treasury_context();
  await test_cross_owner_hostel_rejected();
  await test_missing_treasury_credentials_rejected();

  if (failed > 0) {
    console.error(`\n${failed} failed, ${passed} passed`);
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }
  console.log(`\nAll ${passed} merchant-context tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
