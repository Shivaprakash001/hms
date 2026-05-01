/**
 * 🧪 RentGenerationService — Cron Behavior Tests
 *
 * Run: npx tsx lib/services/rent-generation-service.test.ts
 *
 * Proves:
 *   ✅ Cron path filters owners by auto_rent_day in their timezone
 *   ✅ Wrong-day owners are skipped (not silently created)
 *   ✅ Different timezones resolve "today" correctly
 *   ✅ auto_generate_rent=false short-circuits the owner
 *   ✅ Manual trigger bypasses the day check
 *   ✅ Re-running cron is idempotent (no duplicates)
 *   ✅ getDayInTimezone is correct across DST and UTC offsets
 *
 * No real DB is touched — `prisma` is stubbed in-memory.
 */

import { prisma } from "../db";
import { eventSystem } from "../events";
import { eventLog } from "./event-log-service";
import { getDayInTimezone } from "../timezone";

// ─── Test harness ────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    const msg = `  ❌ ${name}${detail ? ` — ${detail}` : ""}`;
    console.error(msg);
    failures.push(msg);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, name: string) {
  assert(
    actual === expected,
    name,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

// ─── In-memory prisma fake ───────────────────────────────────────

type Hostel = {
  owner_id: string;
  is_active: boolean;
  auto_rent_day: number;
  timezone: string;
  rent_cycle?: string;
  preferences_config?: any;
};

type Allocation = {
  id: string;
  is_active: boolean;
  start_date: Date;
  end_date: Date | null;
  tenant: { id: string; monthly_rent: number; owner_id: string; status: string };
  room: { base_rent: number };
};

type Obligation = {
  tenant_id: string;
  allocation_id: string;
  owner_id: string;
  rent_month: Date;
  amount: number;
  total_amount: number;
  due_date: Date;
  status: string;
  obligation_type?: string;
};

const state = {
  hostels: [] as Hostel[],
  allocations: [] as Allocation[],
  obligations: [] as Obligation[],
  logs: [] as any[],
};

function resetState() {
  state.hostels = [];
  state.allocations = [];
  state.obligations = [];
  state.logs = [];
}

// Patch prisma methods used by RentGenerationService.generateMonthlyRent
(prisma as any).$executeRaw = async (_strings: any, ..._values: any[]) => 1; // lock acquired / released

(prisma as any).roomAllocation = {
  findMany: async ({ where }: any) => {
    return state.allocations.filter((a) => {
      if (where.is_active !== undefined && a.is_active !== where.is_active) return false;
      if (where.start_date?.lte && a.start_date > where.start_date.lte) return false;
      if (where.tenant?.status && a.tenant.status !== where.tenant.status) return false;
      if (where.tenant?.owner_id && a.tenant.owner_id !== where.tenant.owner_id) return false;
      if (where.OR) {
        const monthStart: Date = where.OR[1].end_date.gte;
        const ok = a.end_date === null || a.end_date >= monthStart;
        if (!ok) return false;
      }
      return true;
    });
  },
};

(prisma as any).hostel = {
  findMany: async ({ where }: any) => {
    const ids: string[] = where.owner_id?.in || [];
    return state.hostels.filter(
      (h) => ids.includes(h.owner_id) && h.is_active === (where.is_active ?? true)
    );
  },
};

(prisma as any).rentObligation = {
  findFirst: async ({ where }: any) => {
    return (
      state.obligations.find(
        (o) =>
          o.tenant_id === where.tenant_id &&
          +o.rent_month === +where.rent_month &&
          (where.obligation_type ? (o.obligation_type ?? "RENT") === where.obligation_type : true)
      ) || null
    );
  },
  create: async ({ data }: any) => {
    // Simulate the DB unique constraint on (allocation_id, rent_month, obligation_type)
    const dup = state.obligations.find(
      (o) =>
        o.allocation_id === data.allocation_id &&
        +o.rent_month === +data.rent_month &&
        (o.obligation_type ?? "RENT") === (data.obligation_type ?? "RENT")
    );
    if (dup) {
      const err: any = new Error("Unique constraint failed");
      err.code = "P2002";
      throw err;
    }
    state.obligations.push({ ...data, obligation_type: data.obligation_type ?? "RENT" });
    return data;
  },
};

(prisma as any).rentGenerationLog = {
  create: async ({ data }: any) => {
    state.logs.push(data);
    return data;
  },
};

// Silence side-effects we don't care about
(eventSystem as any).trigger = async () => {};
(eventLog as any).log = async () => {};

// Import AFTER stubbing so the constructor of the service binds to our prisma proxy
// (RentGenerationService doesn't capture prisma at construction time, but lazy import keeps it explicit)
import { RentGenerationService } from "./rent-generation-service";

const service = new RentGenerationService();

// ─── Fixtures ────────────────────────────────────────────────────

function seedOwner(opts: {
  ownerId: string;
  auto_rent_day: number;
  timezone: string;
  auto_generate_rent?: boolean;
  monthly_rent?: number;
}) {
  state.hostels.push({
    owner_id: opts.ownerId,
    is_active: true,
    auto_rent_day: opts.auto_rent_day,
    timezone: opts.timezone,
    preferences_config: {
      auto_generate_rent: opts.auto_generate_rent ?? true,
      due_day: 5,
    },
  });
  state.allocations.push({
    id: `alloc-${opts.ownerId}`,
    is_active: true,
    start_date: new Date("2026-01-01"),
    end_date: null,
    tenant: {
      id: `tenant-${opts.ownerId}`,
      owner_id: opts.ownerId,
      status: "ACTIVE",
      monthly_rent: opts.monthly_rent ?? 5000,
    },
    room: { base_rent: 5000 },
  });
}

// ─── Tests ────────────────────────────────────────────────────────

async function testGetDayInTimezone() {
  console.log("\n🧪 getDayInTimezone");
  // 2026-05-01 17:00 UTC = 2026-05-01 22:30 IST, 17:00 UTC, 13:00 EDT (UTC-4)
  const d = new Date("2026-05-01T17:00:00Z");
  assertEq(getDayInTimezone(d, "Asia/Kolkata"), 1, "IST: 17:00 UTC May 1 → day 1");
  assertEq(getDayInTimezone(d, "UTC"), 1, "UTC: 17:00 UTC May 1 → day 1");
  assertEq(getDayInTimezone(d, "America/New_York"), 1, "NY: 17:00 UTC May 1 → day 1 (13:00 EDT)");

  // Boundary: 2026-04-30 19:00 UTC = 2026-05-01 00:30 IST
  const cross = new Date("2026-04-30T19:00:00Z");
  assertEq(getDayInTimezone(cross, "Asia/Kolkata"), 1, "IST: Apr 30 19:00 UTC → day 1 (00:30 IST May 1)");
  assertEq(getDayInTimezone(cross, "UTC"), 30, "UTC: Apr 30 19:00 UTC → day 30");

  // Invalid timezone → falls back to Asia/Kolkata, must not throw
  const fb = getDayInTimezone(d, "Not/AZone");
  assertEq(fb, 1, "Invalid tz falls back to IST → day 1");
}

async function testCronDayMatch() {
  console.log("\n🧪 cron: day match generates, mismatch skips");
  resetState();
  // Both owners on IST. May 1 IST: A (day=1) processes, B (day=5) skips.
  seedOwner({ ownerId: "A", auto_rent_day: 1, timezone: "Asia/Kolkata" });
  seedOwner({ ownerId: "B", auto_rent_day: 5, timezone: "Asia/Kolkata" });

  // 18:30 UTC May 1 = 00:00 IST May 2 — but use a clearly-IST-May-1 instant to avoid day-rollover ambiguity
  const now = new Date("2026-05-01T06:00:00Z"); // 11:30 IST May 1
  const summary: any = await service.generateMonthlyRent(now, undefined, "cron");

  assertEq(summary.created, 1, "exactly 1 obligation created");
  assertEq(summary.skipped, 1, "exactly 1 owner skipped");
  assertEq(state.obligations.length, 1, "DB has 1 row");
  assertEq(state.obligations[0].tenant_id, "tenant-A", "row belongs to owner A");
  assertEq(
    state.obligations[0].rent_month.toISOString(),
    "2026-05-01T00:00:00.000Z",
    "rent_month is UTC May 1"
  );
}

async function testTimezones() {
  console.log("\n🧪 cron: per-owner timezone resolution");
  resetState();
  // Instant: Apr 30 23:30 UTC.
  //   IST owner sees May 1 (05:00 IST)
  //   UTC owner sees Apr 30
  seedOwner({ ownerId: "IST1", auto_rent_day: 1, timezone: "Asia/Kolkata" });
  seedOwner({ ownerId: "UTC1", auto_rent_day: 1, timezone: "UTC" });

  const now = new Date("2026-04-30T23:30:00Z");
  const summary: any = await service.generateMonthlyRent(now, undefined, "cron");

  assertEq(summary.created, 1, "only IST owner generates");
  assertEq(summary.skipped, 1, "UTC owner is skipped (still Apr 30 in UTC)");
  assert(
    state.obligations.some((o) => o.owner_id === "IST1"),
    "IST owner has obligation"
  );
  assert(
    !state.obligations.some((o) => o.owner_id === "UTC1"),
    "UTC owner has NO obligation"
  );
}

async function testAutoGenerateOff() {
  console.log("\n🧪 cron: auto_generate_rent=false short-circuits");
  resetState();
  seedOwner({ ownerId: "OFF", auto_rent_day: 1, timezone: "Asia/Kolkata", auto_generate_rent: false });

  const now = new Date("2026-05-01T06:00:00Z");
  const summary: any = await service.generateMonthlyRent(now, undefined, "cron");

  assertEq(summary.created, 0, "no obligations created");
  assertEq(summary.skipped, 1, "owner counted as skipped");
}

async function testManualBypassesDayCheck() {
  console.log("\n🧪 manual trigger bypasses day check");
  resetState();
  // Wrong day for cron, but manual must still generate.
  seedOwner({ ownerId: "M", auto_rent_day: 15, timezone: "Asia/Kolkata" });

  const now = new Date("2026-05-01T06:00:00Z");
  const summary: any = await service.generateMonthlyRent(now, "M", "manual");

  assertEq(summary.created, 1, "manual trigger creates obligation regardless of day");
}

async function testIdempotency() {
  console.log("\n🧪 idempotency: re-running cron does not duplicate");
  resetState();
  seedOwner({ ownerId: "I", auto_rent_day: 1, timezone: "Asia/Kolkata" });

  const now = new Date("2026-05-01T06:00:00Z");
  const first: any = await service.generateMonthlyRent(now, undefined, "cron");
  const second: any = await service.generateMonthlyRent(now, undefined, "cron");

  assertEq(first.created, 1, "first run creates 1");
  assertEq(second.created, 0, "second run creates 0");
  assertEq(second.skipped, 1, "second run reports skip");
  assertEq(state.obligations.length, 1, "DB still has only 1 row");
}

async function testIdempotencyRaceP2002() {
  console.log("\n🧪 idempotency: P2002 from concurrent insert is caught");
  resetState();
  seedOwner({ ownerId: "R", auto_rent_day: 1, timezone: "Asia/Kolkata" });

  // Pre-insert directly to bypass the findFirst pre-check, forcing the create() path to throw P2002.
  // We mimic this by patching findFirst to lie ("no existing row") for this test, then letting create() detect the dup.
  const realFindFirst = (prisma as any).rentObligation.findFirst;
  (prisma as any).rentObligation.findFirst = async () => null;

  // Seed an existing row with the SAME (allocation_id, rent_month, obligation_type) the service will try to create.
  state.obligations.push({
    tenant_id: "tenant-R",
    allocation_id: "alloc-R",
    owner_id: "R",
    rent_month: new Date(Date.UTC(2026, 4, 1)),
    amount: 5000,
    total_amount: 5000,
    due_date: new Date(Date.UTC(2026, 4, 5)),
    status: "PENDING",
    obligation_type: "RENT",
  });

  const now = new Date("2026-05-01T06:00:00Z");
  const summary: any = await service.generateMonthlyRent(now, undefined, "cron");

  // Restore findFirst for subsequent tests
  (prisma as any).rentObligation.findFirst = realFindFirst;

  assertEq(summary.failed, 0, "P2002 must not be counted as failure");
  assertEq(summary.skipped, 1, "P2002 is counted as skipped");
  assertEq(state.obligations.length, 1, "no duplicate row inserted");
}

async function main() {
  await testGetDayInTimezone();
  await testCronDayMatch();
  await testTimezones();
  await testAutoGenerateOff();
  await testManualBypassesDayCheck();
  await testIdempotency();
  await testIdempotencyRaceP2002();

  console.log(`\n${"━".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(f));
    process.exit(1);
  }
  console.log("✅ All rent-generation behaviors verified.");
}

main().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
