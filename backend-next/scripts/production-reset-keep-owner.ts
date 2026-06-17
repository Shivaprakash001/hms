import { prisma } from "../lib/db";
import { invalidateOwnerDashboardCache, invalidatePortfolioCache } from "../lib/cache/dashboard-cache";
import type { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const RESET_CONFIRMATION = process.env.HMS_PRODUCTION_RESET_CONFIRMATION;
const TARGET_REF_ID = "iogmfxedhfcdtxoywwve";

type DbClient = PrismaClient | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const PRESERVED_TABLES = [
  "_prisma_migrations",
  "profiles", // Handled manually to preserve ONLY the single OWNER profile
  "hostels",
  "floors",
  "rooms",
  "AgreementTemplate",
  "RuleVersion",
  "owner_whatsapp_identities",
  "whatsapp_owner_sessions",
  "message_packs",
  "system_locks"
];

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function countTable(table: string, db: DbClient = prisma) {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `select count(*)::bigint as count from ${quoteIdent(table)}`
    );
    return Number(rows[0]?.count || 0);
  } catch {
    return 0;
  }
}

async function getTablesToDelete() {
  const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `select tablename
     from pg_tables
     where schemaname = 'public'
       and tablename not in (${PRESERVED_TABLES.map((t, idx) => `$${idx + 1}`).join(", ")})
     order by tablename`,
    ...PRESERVED_TABLES
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

async function validatePreservedConfigurations(db: DbClient = prisma) {
  console.log("=== Validating Preserved Configurations ===");
  
  // 1. Check OWNER profiles
  const ownerCount = await db.profile.count({
    where: { role: "OWNER" }
  });
  console.log(`  - Preserved OWNER Profiles: ${ownerCount}`);
  if (ownerCount === 0) {
    throw new Error("Missing OWNER profile configuration!");
  }

  // 2. Check Hostels
  const hostelsCount = await db.hostels.count();
  console.log(`  - Hostels: ${hostelsCount}`);
  if (hostelsCount === 0) {
    throw new Error("Missing hostels configuration!");
  }

  // 3. Check Floors
  const floorsCount = await db.floors.count();
  console.log(`  - Floors: ${floorsCount}`);
  if (floorsCount === 0) {
    throw new Error("Missing floors configuration!");
  }

  // 4. Check Rooms
  const roomsCount = await db.rooms.count();
  console.log(`  - Rooms: ${roomsCount}`);
  if (roomsCount === 0) {
    throw new Error("Missing rooms configuration!");
  }

  // 5. Check AgreementTemplate
  const templatesCount = await db.agreementTemplate.count();
  console.log(`  - Agreement Templates: ${templatesCount}`);
  if (templatesCount === 0) {
    throw new Error("Missing agreement templates configuration!");
  }

  // 6. Check RuleVersion
  const rulesCount = await db.ruleVersion.count();
  console.log(`  - Rule Versions: ${rulesCount}`);
  if (rulesCount === 0) {
    throw new Error("Missing rule versions configuration!");
  }

  console.log("✅ Preserved configurations validation passed.");
}

async function runFinalRoleAudit(db: DbClient = prisma) {
  console.log("=== Running Final Role Audit ===");
  const roles = await db.profile.groupBy({
    by: ['role'],
    _count: true
  });

  const auditResult: Record<string, number> = {
    OWNER: 0,
    ADMIN: 0,
    WARDEN: 0,
    TENANT: 0
  };

  for (const r of roles) {
    auditResult[r.role] = r._count;
  }

  console.log(JSON.stringify(auditResult, null, 2));

  // Fail validation if non-owner accounts remain
  if (auditResult.ADMIN > 0 || auditResult.WARDEN > 0 || auditResult.TENANT > 0) {
    throw new Error(`Validation failed: Non-owner accounts found! ADMIN: ${auditResult.ADMIN}, WARDEN: ${auditResult.WARDEN}, TENANT: ${auditResult.TENANT}`);
  }

  if (auditResult.OWNER !== 1) {
    throw new Error(`Validation failed: Expected exactly 1 OWNER, found ${auditResult.OWNER}`);
  }

  console.log("✅ Final Role Audit validation passed (only 1 OWNER remaining, all others 0).");
}

async function main() {
  const tables = await getTablesToDelete();
  const orderedTables = await deletionOrder(tables);

  const beforeCounts: Record<string, number> = {
    profiles_total: await countTable("profiles"),
    profiles_OWNER: await prisma.profile.count({ where: { role: "OWNER" } }),
    profiles_ADMIN: await prisma.profile.count({ where: { role: "ADMIN" } }),
    profiles_WARDEN: await prisma.profile.count({ where: { role: "WARDEN" } }),
    profiles_TENANT: await prisma.profile.count({ where: { role: "TENANT" } }),
  };

  for (const table of tables) {
    beforeCounts[table] = await countTable(table);
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: "DRY_RUN",
      target_ref_id: TARGET_REF_ID,
      preserved_tables: PRESERVED_TABLES,
      tables_to_delete_ordered: orderedTables,
      before_counts: beforeCounts,
      apply_command: "HMS_PRODUCTION_RESET_CONFIRMATION=iogmfxedhfcdtxoywwve npm run reset:production:keep-owner -- --apply",
    }, null, 2));

    await validatePreservedConfigurations();
    return;
  }

  if (RESET_CONFIRMATION !== TARGET_REF_ID) {
    console.error(`❌ Error: HMS_PRODUCTION_RESET_CONFIRMATION must match target reference ID '${TARGET_REF_ID}'`);
    process.exit(1);
  }

  // Pre-reset validations
  await validatePreservedConfigurations();

  console.log("\n🚀 Starting destructive launch reset inside a transaction...");
  const result = await prisma.$transaction(async (tx) => {
    const deletedRowCounts: Record<string, number> = {};

    // 1. Disable user triggers on the payments table (specifically user triggers to avoid system constraint errors)
    if (orderedTables.includes("payments")) {
      console.log("  - Disabling user triggers on 'payments' table to bypass ledger protections...");
      await tx.$executeRawUnsafe('ALTER TABLE "payments" DISABLE TRIGGER USER');
    }

    // 2. Remove foreign key relations pointing to imports
    await tx.$executeRawUnsafe(`update "profiles" set import_batch_id = null where import_batch_id is not null`);

    // 3. Delete operational data tables in topological order
    for (const table of orderedTables) {
      const count = await countTable(table, tx);
      await tx.$executeRawUnsafe("delete from " + quoteIdent(table));
      deletedRowCounts[table] = count;
      console.log(`  - Deleted ${count} rows from ${table}`);
    }

    // 4. Delete non-owner profiles (ADMIN, WARDEN, TENANT)
    const nonOwnerCount = await tx.profile.count({ where: { role: { not: "OWNER" } } });
    await tx.$executeRawUnsafe(`delete from "profiles" where role <> 'OWNER'`);
    deletedRowCounts["profiles_NON_OWNERS"] = nonOwnerCount;
    console.log(`  - Deleted ${nonOwnerCount} non-owner profiles`);

    // 5. Purge credentials from auth.users for deleted profiles
    try {
      const activeIds = await tx.profile.findMany({
        select: { id: true }
      });
      const idList = activeIds.map((p) => p.id);
      if (idList.length > 0) {
        await tx.$executeRawUnsafe(
          `delete from auth.users where id not in (${idList.map((_, idx) => `$${idx + 1}::uuid`).join(", ")})`,
          ...idList
        );
        console.log(`  - Cleaned up credentials from auth.users`);
      }
    } catch (authErr: any) {
      console.log(`  - Note: auth.users cleanup skipped or not supported in this context (${authErr.message || authErr})`);
      // Since it's inside transaction, we cannot allow the error to abort transaction if we want to bypass. 
      // But adding ::uuid typecast will make it succeed, so we don't expect it to fail now.
      throw authErr;
    }

    // 6. Re-enable user triggers on 'payments'
    if (orderedTables.includes("payments")) {
      console.log("  - Re-enabling user triggers on 'payments' table...");
      await tx.$executeRawUnsafe('ALTER TABLE "payments" ENABLE TRIGGER USER');
    }

    // 7. Post-reset validations inside transaction
    await validatePreservedConfigurations(tx);
    await runFinalRoleAudit(tx);

    const afterCounts: Record<string, number> = {
      profiles_total: await countTable("profiles", tx),
      profiles_OWNER: await tx.profile.count({ where: { role: "OWNER" } }),
      profiles_ADMIN: await tx.profile.count({ where: { role: "ADMIN" } }),
      profiles_WARDEN: await tx.profile.count({ where: { role: "WARDEN" } }),
      profiles_TENANT: await tx.profile.count({ where: { role: "TENANT" } }),
    };
    for (const table of tables) {
      afterCounts[table] = await countTable(table, tx);
    }

    return { deletedRowCounts, afterCounts };
  }, { maxWait: 15000, timeout: 120000 });

  const owners = await prisma.profile.findMany({
    where: { role: "OWNER" },
    select: { id: true }
  });
  for (const o of owners) {
    invalidateOwnerDashboardCache(o.id);
    invalidatePortfolioCache(o.id);
  }

  console.log("\n=== RESET APPLIED SUCCESSFULLY ===");
  console.log(JSON.stringify({
    mode: "APPLIED",
    deleted_row_counts: result.deletedRowCounts,
    after_counts: result.afterCounts
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("❌ Reset script failed:", error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
