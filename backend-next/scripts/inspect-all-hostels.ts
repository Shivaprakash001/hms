import { PrismaClient } from "@prisma/client";
import { resolvePreferences } from "../lib/preferences";

const prisma = new PrismaClient();

async function main() {
  const hostels = await prisma.hostels.findMany({
    select: { id: true, name: true, is_active: true, preferences_config: true }
  });
  console.log("=== Hostels ===");
  for (const h of hostels) {
    const prefs = resolvePreferences(h);
    console.log(`Hostel ID: ${h.id}`);
    console.log(`Name: ${h.name}`);
    console.log(`Active: ${h.is_active}`);
    console.log(`advance_enabled in prefs: ${prefs.advance_enabled}`);
    console.log(`preferences_config:`, JSON.stringify(h.preferences_config, null, 2));
    console.log("-------------------");
  }

  const tenants = await prisma.tenants.findMany({
    select: { id: true, hostel_id: true, owner_id: true, status: true, profiles: { select: { name: true } } }
  });
  console.log("=== Tenants ===");
  console.log(JSON.stringify(tenants, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
