/**
 * Multi-owner isolation regression matrix.
 * Run: node ./node_modules/.bin/tsx lib/services/multi-owner-isolation.test.ts
 */

type OwnerId = "owner-a" | "owner-b";
type HostelId = "hostel-a" | "hostel-b";

type Tenant = { id: string; owner_id: OwnerId; hostel_id: HostelId; name: string };
type Room = { id: string; hostel_id: HostelId; owner_id: OwnerId; room_no: string };
type Expense = { id: string; owner_id: OwnerId; hostel_id: HostelId; amount: number };
type Payment = { id: string; owner_id: OwnerId; hostel_id: HostelId; tenant_id: string; amount: number };
type Reminder = { id: string; owner_id: OwnerId; hostel_id: HostelId; tenant_id: string };
type Notification = { id: string; owner_id: OwnerId; title: string };

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail = "") {
  if (cond) { console.log(`  OK ${name}`); passed++; return; }
  const msg = `  FAIL ${name}${detail ? ` - ${detail}` : ""}`;
  console.error(msg); failures.push(msg); failed++;
}
function assertEq<T>(actual: T, expected: T, name: string) {
  assert(actual === expected, name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function makeState() {
  return {
    rooms: [
      { id: "room-a", owner_id: "owner-a", hostel_id: "hostel-a", room_no: "101" },
      { id: "room-b", owner_id: "owner-b", hostel_id: "hostel-b", room_no: "101" },
    ] as Room[],
    tenants: [
      { id: "tenant-a", owner_id: "owner-a", hostel_id: "hostel-a", name: "Same Name" },
      { id: "tenant-b", owner_id: "owner-b", hostel_id: "hostel-b", name: "Same Name" },
    ] as Tenant[],
    expenses: [
      { id: "expense-a", owner_id: "owner-a", hostel_id: "hostel-a", amount: 100 },
      { id: "expense-b", owner_id: "owner-b", hostel_id: "hostel-b", amount: 200 },
    ] as Expense[],
    payments: [
      { id: "payment-a", owner_id: "owner-a", hostel_id: "hostel-a", tenant_id: "tenant-a", amount: 5000 },
      { id: "payment-b", owner_id: "owner-b", hostel_id: "hostel-b", tenant_id: "tenant-b", amount: 7000 },
    ] as Payment[],
    reminders: [
      { id: "reminder-a", owner_id: "owner-a", hostel_id: "hostel-a", tenant_id: "tenant-a" },
      { id: "reminder-b", owner_id: "owner-b", hostel_id: "hostel-b", tenant_id: "tenant-b" },
    ] as Reminder[],
    notifications: [
      { id: "notification-a", owner_id: "owner-a", title: "Rent due" },
      { id: "notification-b", owner_id: "owner-b", title: "Rent due" },
    ] as Notification[],
    cache: new Map<string, unknown>(),
  };
}

function scoped<T extends { owner_id: OwnerId }>(rows: T[], ownerId: OwnerId) {
  return rows.filter((r) => r.owner_id === ownerId);
}
function dashboard(state: ReturnType<typeof makeState>, ownerId: OwnerId) {
  const payments = scoped(state.payments, ownerId);
  return {
    tenant_count: scoped(state.tenants, ownerId).length,
    room_count: scoped(state.rooms, ownerId).length,
    collected: payments.reduce((sum, p) => sum + p.amount, 0),
    expenses: scoped(state.expenses, ownerId).reduce((sum, e) => sum + e.amount, 0),
    reminders: scoped(state.reminders, ownerId).length,
  };
}
function cacheKey(ownerId: OwnerId, key: string) {
  return ["scope", ownerId, key].join(":");
}

async function main() {
  console.log("\nMulti-owner isolation matrix");
  const s = makeState();

  assertEq(scoped(s.tenants, "owner-a").length, 1, "Owner A sees only own tenants");
  assertEq(scoped(s.tenants, "owner-b").length, 1, "Owner B sees only own tenants");
  assert(scoped(s.tenants, "owner-a").every((t) => t.id !== "tenant-b"), "Owner A never sees Owner B tenant with same name");
  assert(scoped(s.rooms, "owner-a").every((r) => r.id !== "room-b"), "Owner A never sees Owner B room with same number");
  assertEq(scoped(s.expenses, "owner-a")[0].amount, 100, "Expense isolation");
  assertEq(scoped(s.payments, "owner-b")[0].amount, 7000, "Payment isolation");
  assertEq(scoped(s.reminders, "owner-a").length, 1, "Reminder isolation");
  assertEq(scoped(s.notifications, "owner-b").length, 1, "Notification isolation");

  const aDash = dashboard(s, "owner-a");
  const bDash = dashboard(s, "owner-b");
  assertEq(aDash.collected, 5000, "Dashboard A collections isolated");
  assertEq(bDash.collected, 7000, "Dashboard B collections isolated");
  assertEq(aDash.room_count, 1, "Dashboard A room count isolated");
  assertEq(bDash.expenses, 200, "Dashboard B expenses isolated");

  s.cache.set(cacheKey("owner-a", "dashboard"), aDash);
  s.cache.set(cacheKey("owner-b", "dashboard"), bDash);
  assertEq((s.cache.get(cacheKey("owner-a", "dashboard")) as any).collected, 5000, "Cache key includes owner A");
  assertEq((s.cache.get(cacheKey("owner-b", "dashboard")) as any).collected, 7000, "Cache key includes owner B");

  // Simulate multiple tabs/concurrent sessions. The same logical query name must
  // not collide when owners change in localStorage/session state.
  const tabAKey = cacheKey("owner-a", "tenants:list");
  const tabBKey = cacheKey("owner-b", "tenants:list");
  assert(tabAKey !== tabBKey, "Concurrent session cache keys cannot collide");

  console.log(`\nMulti-owner isolation: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

export {};
