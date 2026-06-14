import { prisma } from "@/lib/db";
import { invalidateOwnerDashboardCache, invalidatePortfolioCache } from "@/lib/cache/dashboard-cache";
import type { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const RESET_TOKEN = process.env.HMS_PRODUCTION_RESET_CONFIRMATION;
const REQUIRED_TOKEN = "CONFIRM_PRODUCTION_RESET_KEEP_OWNER";

type DbClient = PrismaClient | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const FRESH_HOSTEL = {
  name: process.env.HMS_RESET_HOSTEL_NAME || "Sri Adithya Test Hostel",
  phone: process.env.HMS_RESET_HOSTEL_PHONE || "9999999999",
  address: process.env.HMS_RESET_HOSTEL_ADDRESS || "Fresh test hostel for full move-in to move-out cycle",
  city: process.env.HMS_RESET_HOSTEL_CITY || "Hyderabad",
  state: process.env.HMS_RESET_HOSTEL_STATE || "Telangana",
  pincode: process.env.HMS_RESET_HOSTEL_PINCODE || "500001",
};

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function countTable(table: string, db: DbClient = prisma) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `select count(*)::bigint as count from ${quoteIdent(table)}`
  );
  return Number(rows[0]?.count || 0);
}

async function tableNames() {
  const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `select tablename
     from pg_tables
     where schemaname = 'public'
       and tablename not in ('_prisma_migrations', 'profiles')
     order by tablename`
  );
  return rows.map((row) => row.tablename);
}

async function deletionOrder(tables: string[]) {
  const rows = await prisma.$queryRawUnsafe<Array<{ child: string; parent: string }>>(
    `select child.relname as child, parent.relname as parent
     from pg_constraint constraint_info
     join pg_class child on child.oid = constraint_info.conrelid
     join pg_namespace child_ns on child_ns.oid = child.relnamespace
     join pg_class parent on parent.oid = constraint_info.confrelid
     join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
     where constraint_info.contype = 'f'
       and child_ns.nspname = 'public'
       and parent_ns.nspname = 'public'`
  );

  const tableSet = new Set(tables);
  const childrenByParent = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.child === row.parent) continue;
    if (!tableSet.has(row.child) || !tableSet.has(row.parent)) continue;
    const children = childrenByParent.get(row.parent) || new Set<string>();
    children.add(row.child);
    childrenByParent.set(row.parent, children);
  }

  const ordered: string[] = [];
  const temporary = new Set<string>();
  const permanent = new Set<string>();

  function visit(table: string) {
    if (permanent.has(table)) return;
    if (temporary.has(table)) return;
    temporary.add(table);
    for (const child of childrenByParent.get(table) || []) {
      visit(child);
    }
    temporary.delete(table);
    permanent.add(table);
    ordered.push(table);
  }

  for (const table of tables) {
    visit(table);
  }

  return ordered;
}

async function snapshot(label: string, tables: string[], db: DbClient = prisma) {
  const counts: Record<string, number> = {
    profiles_OWNER: await db.profile.count({ where: { role: "OWNER" } }),
    profiles_ADMIN: await db.profile.count({ where: { role: "ADMIN" } }),
    profiles_TENANT: await db.profile.count({ where: { role: "TENANT" } }),
  };

  for (const table of tables) {
    counts[table] = await countTable(table, db);
  }

  return { label, counts };
}

async function deleteOperationalData(tables: string[], preservedOwnerId: string, db: DbClient = prisma) {
  const deleted: Record<string, number> = {};
  const orderedTables = await deletionOrder(tables);

  for (const table of tables) {
    deleted[`table:${table}`] = await countTable(table, db);
  }

  await db.$executeRawUnsafe(`update "profiles" set import_batch_id = null where import_batch_id is not null`);

  for (const table of orderedTables) {
    await db.$executeRawUnsafe(`delete from ${quoteIdent(table)}`);
  }

  deleted.profiles_non_preserved_owner_or_admin = await db.$executeRawUnsafe(
    `delete from "profiles" where role <> 'ADMIN' and id <> $1::uuid`,
    preservedOwnerId
  );

  return deleted;
}

async function seedFreshHostel(owner: { id: string; phone: string | null; name: string }, db: DbClient = prisma) {
  const hostel = await db.hostels.create({
    data: {
      owner_id: owner.id,
      name: FRESH_HOSTEL.name,
      phone: FRESH_HOSTEL.phone || owner.phone || "9999999999",
      address: FRESH_HOSTEL.address,
      city: FRESH_HOSTEL.city,
      state: FRESH_HOSTEL.state,
      pincode: FRESH_HOSTEL.pincode,
      currency: "INR",
      rent_cycle: "MONTHLY",
      receipt_prefix: "TEST",
      timezone: "Asia/Kolkata",
      auto_rent_day: 1,
      public_slug: "sri-adithya-test-hostel",
      admissions_enabled: true,
      preferences_config: {
        renewal_grace_period_days: 30,
      },
    },
  });

  const ground = await db.floors.create({
    data: {
      hostel_id: hostel.id,
      owner_id: owner.id,
      name: "Ground Floor",
      sort_order: 0,
    },
  });
  const first = await db.floors.create({
    data: {
      hostel_id: hostel.id,
      owner_id: owner.id,
      name: "First Floor",
      sort_order: 1,
    },
  });

  const rooms = await Promise.all([
    db.rooms.create({
      data: { hostel_id: hostel.id, floor_id: ground.id, floor: 0, room_no: "G1", capacity: 2, room_type: "Twin Sharing", base_rent: 8500, is_active: true },
    }),
    db.rooms.create({
      data: { hostel_id: hostel.id, floor_id: ground.id, floor: 0, room_no: "G2", capacity: 2, room_type: "Twin Sharing", base_rent: 8500, is_active: true },
    }),
    db.rooms.create({
      data: { hostel_id: hostel.id, floor_id: ground.id, floor: 0, room_no: "G3", capacity: 3, room_type: "Triple Sharing", base_rent: 7500, is_active: true },
    }),
    db.rooms.create({
      data: { hostel_id: hostel.id, floor_id: first.id, floor: 1, room_no: "F1", capacity: 2, room_type: "Twin Sharing", base_rent: 9000, is_active: true },
    }),
    db.rooms.create({
      data: { hostel_id: hostel.id, floor_id: first.id, floor: 1, room_no: "F2", capacity: 2, room_type: "Twin Sharing", base_rent: 9000, is_active: true },
    }),
    db.rooms.create({
      data: { hostel_id: hostel.id, floor_id: first.id, floor: 1, room_no: "F3", capacity: 3, room_type: "Triple Sharing", base_rent: 8000, is_active: true },
    }),
  ]);

  const agreementTemplate = await db.agreementTemplate.create({
    data: {
      hostel_id: hostel.id,
      version: "test-2026-v1",
      title: "Standard Tenant Agreement",
      custom_rules: "Fresh test-cycle template for validating move-in, billing, renewal, and move-out.",
      owner_name: owner.name,
      is_active: true,
    },
  });

  const ruleVersion = await db.ruleVersion.create({
    data: {
      hostel_id: hostel.id,
      version: "test-2026-v1",
      title: "Standard Hostel Rules",
      active: true,
      is_active: true,
      content_snapshot: {
        quiet_hours: "10:00 PM - 6:00 AM",
        rent_due_day: 1,
        move_out_notice_days: 30,
        test_cycle: true,
      },
      content: {
        rules: [
          "Pay rent on time.",
          "Keep rooms clean.",
          "Follow visitor and quiet-hour rules.",
          "Submit move-out requests before vacating.",
        ],
      },
    },
  });

  await db.usage_tracking.upsert({
    where: { owner_id: owner.id },
    create: { owner_id: owner.id, hostels_count: 1, tenants_count: 0 },
    update: { hostels_count: 1, tenants_count: 0 },
  });

  return {
    hostel,
    floors: [ground, first],
    rooms,
    agreementTemplate,
    ruleVersion,
  };
}

async function main() {
  const owners = await prisma.profile.findMany({
    where: { role: "OWNER", is_active: true },
    select: { id: true, email: true, name: true, phone: true, owner_id: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  if (owners.length === 0) {
    throw new Error("No active OWNER profile found. Refusing reset because owner login would be unavailable.");
  }

  const owner = owners[0];
  const tables = await tableNames();
  const before = await snapshot("before", tables);

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: "DRY_RUN",
      owner_preserved: owner,
      additional_active_owners_deleted_on_apply: owners.slice(1),
      fresh_hostel: FRESH_HOSTEL,
      before,
      apply_command: "HMS_PRODUCTION_RESET_CONFIRMATION=CONFIRM_PRODUCTION_RESET_KEEP_OWNER npm run reset:production:keep-owner -- --apply",
    }, null, 2));
    return;
  }

  if (RESET_TOKEN !== REQUIRED_TOKEN) {
    throw new Error(`Missing HMS_PRODUCTION_RESET_CONFIRMATION=${REQUIRED_TOKEN}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentOwner = await tx.profile.findUnique({
      where: { id: owner.id },
      select: { id: true, owner_id: true, role: true },
    });
    if (!currentOwner || currentOwner.role !== "OWNER") {
      throw new Error("Owner changed before reset. Refusing apply.");
    }
    if (currentOwner.owner_id !== currentOwner.id) {
      await tx.profile.update({ where: { id: currentOwner.id }, data: { owner_id: currentOwner.id } });
    }

    const deleted = await deleteOperationalData(tables, owner.id, tx);
    await tx.profile.update({ where: { id: owner.id }, data: { owner_id: owner.id, is_active: true } });
    const seeded = await seedFreshHostel(owner, tx);
    const after = await snapshot("after", tables, tx);

    return { deleted, seeded, after };
  }, { maxWait: 10000, timeout: 120000 });

  const { deleted, seeded, after } = result;
  invalidateOwnerDashboardCache(owner.id);
  invalidatePortfolioCache(owner.id);

  console.log(JSON.stringify({
    mode: "APPLIED",
    owner_preserved: owner,
    additional_active_owners_deleted: owners.slice(1),
    deleted,
    seeded: {
      hostel: { id: seeded.hostel.id, name: seeded.hostel.name },
      floors: seeded.floors.map((floor) => ({ id: floor.id, name: floor.name })),
      rooms: seeded.rooms.map((room) => ({
        id: room.id,
        room_no: room.room_no,
        capacity: room.capacity,
        base_rent: room.base_rent,
      })),
      agreement_template_id: seeded.agreementTemplate.id,
      rule_version_id: seeded.ruleVersion.id,
    },
    after,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      mode: APPLY ? "APPLY_FAILED" : "DRY_RUN_FAILED",
      error: error.message || String(error),
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
