/**
 * Event bus owner isolation regression.
 * Run: node ./node_modules/.bin/tsx lib/events/event-bus.test.ts
 */

import { addClient, broadcast, removeClient } from "./event-bus";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail = "") {
  if (condition) {
    console.log(`  OK ${name}`);
    passed++;
    return;
  }
  console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  failed++;
}

async function main() {
  console.log("\nEvent bus owner isolation");
  const ownerAEvents: any[] = [];
  const ownerBEvents: any[] = [];
  const unscopedEvents: any[] = [];

  const ownerA = { ownerId: "owner-a", send: (data: any) => ownerAEvents.push(data) };
  const ownerB = { ownerId: "owner-b", send: (data: any) => ownerBEvents.push(data) };
  const unscoped = { send: (data: any) => unscopedEvents.push(data) };

  addClient(ownerA);
  addClient(ownerB);
  addClient(unscoped);

  try {
    broadcast("owner-a", { type: "PAYMENT_RECORDED" });
    assert(ownerAEvents.length === 1, "matching owner receives event");
    assert(ownerBEvents.length === 0, "other owner does not receive event");
    assert(unscopedEvents.length === 0, "unscoped client does not receive owner event");
  } finally {
    removeClient(ownerA);
    removeClient(ownerB);
    removeClient(unscoped);
  }

  console.log(`\nEvent bus isolation: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });

export {};
