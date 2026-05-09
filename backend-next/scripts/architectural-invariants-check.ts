import fs from "fs";
import path from "path";

const root = process.cwd();

const checks: Array<{
  name: string;
  roots: string[];
  pattern: RegExp;
  allow?: RegExp[];
}> = [
  {
    name: "frontend must not use active hostel localStorage helpers",
    roots: ["../frontend/src"],
    pattern: /\bgetActiveHostelId\b|\bsetActiveHostelId\b|\bclearActiveHostelIds\b|activeHostel:\$\{/,
    allow: [/context\/HostelContext\.jsx$/],
  },
  {
    name: "operational backend must not invalidate dashboard by owner",
    roots: ["lib/services", "app/api"],
    pattern: /invalidateDashboardCache\(/,
    allow: [/lib\/cache\/dashboard-cache\.ts$/],
  },
  {
    name: "operational backend must not use optional hostelId service contracts",
    roots: ["lib/services", "app/api/dashboard", "app/api/analytics", "app/api/rooms", "app/api/tenants", "app/api/payments", "app/api/expenses"],
    pattern: /hostelId\?:\s*string|hostelId\?:\s*string\s*\|/,
    allow: [
      /architectural-invariants-check\.ts$/,
      /lib\/services\/rent-generation-service\.test\.ts$/,
    ],
  },
  {
    name: "operational code must not select first hostel as fallback",
    roots: ["lib/services", "app/api/dashboard", "app/api/analytics", "app/api/rooms", "app/api/tenants", "app/api/payments", "app/api/expenses"],
    pattern: /findFirst\([\s\S]{0,220}owner_id[\s\S]{0,220}hostel|hostels\s*\[\s*0\s*\]/,
    allow: [
      /architectural-invariants-check\.ts$/,
      /lib\/services\/activation-service\.ts$/,
      /lib\/services\/deterministic-context\.test\.ts$/,
      /lib\/services\/hostel-billing-preferences-service\.ts$/,
      /lib\/services\/invitation-service\.ts$/,
      /lib\/services\/payment-service\.ts$/,
      /lib\/services\/reminder-service\.ts$/,
      /lib\/services\/tenant-service\.ts$/,
    ],
  },
];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage"].includes(entry.name)) return [];
      return walk(full);
    }
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

let failed = 0;

for (const check of checks) {
  const offenders: string[] = [];
  for (const relativeRoot of check.roots) {
    for (const file of walk(path.resolve(root, relativeRoot))) {
      const relative = path.relative(root, file).replaceAll(path.sep, "/");
      if (check.allow?.some((rule) => rule.test(relative))) continue;
      const contents = fs.readFileSync(file, "utf8");
      if (check.pattern.test(contents)) offenders.push(relative);
    }
  }

  if (offenders.length) {
    failed++;
    console.error(`FAIL ${check.name}`);
    offenders.forEach((file) => console.error(`  - ${file}`));
  } else {
    console.log(`OK ${check.name}`);
  }
}

if (failed) process.exit(1);
