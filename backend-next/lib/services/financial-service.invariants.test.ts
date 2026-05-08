import { operationalPendingInvariantHolds } from "./financial-invariants";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  OK: ${name}`);
    return;
  }
  failed++;
  console.error(`  FAIL: ${name}`);
}

console.log("\nRunning financial invariants tests\n");

assert(
  operationalPendingInvariantHolds(0, 0),
  "pending=0 allows unpaid_tenant_count=0",
);

assert(
  !operationalPendingInvariantHolds(0, 1),
  "pending=0 rejects unpaid_tenant_count>0",
);

assert(
  operationalPendingInvariantHolds(1500, 1),
  "pending>0 allows unpaid_tenant_count>0",
);

assert(
  operationalPendingInvariantHolds(1500, 0),
  "pending>0 does not force non-zero tenant count",
);

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}\n`);

if (failed > 0) process.exit(1);
