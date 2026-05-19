import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const failures = [];

const legacyPortalAllowlist = new Set([
  'src/portal/README.md',
  'src/portal/TenantPortalLayout.tsx',
  'src/portal/components/QrCodeImage.tsx',
  'src/portal/components/TenantActionCenter.tsx',
  'src/portal/components/TenantAnnouncements.tsx',
  'src/portal/components/TenantDocumentStatus.tsx',
  'src/portal/components/TenantPaymentModal.tsx',
  'src/portal/components/TenantPriorityStrip.tsx',
  'src/portal/components/TenantScorePanel.tsx',
  'src/portal/components/profile/ProfileSection.tsx',
  'src/portal/pages/ActivateAccountPage.tsx',
  'src/portal/pages/CompleteProfilePage.tsx',
  'src/portal/pages/TenantDashboardPage.tsx',
  'src/portal/pages/TenantFinancialsPage.tsx',
  'src/portal/pages/TenantMoveOutPage.tsx',
  'src/portal/pages/TenantPaymentReturnPage.tsx',
  'src/portal/pages/TenantPaymentsPage.tsx',
  'src/portal/pages/TenantProfilePortalPage.tsx',
  'src/portal/pages/TenantRoomPage.tsx',
  'src/portal/utils/payableObligations.ts',
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['dist', 'node_modules'].includes(entry.name)) return [];
      return walk(fullPath);
    }
    return [fullPath];
  });
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function isSourceFile(file) {
  return /\.(tsx?|jsx?)$/.test(file);
}

for (const file of walk(path.join(srcRoot, 'portal'))) {
  const relative = rel(file);
  if (!legacyPortalAllowlist.has(relative)) {
    failures.push(`${relative}: src/portal is frozen; new tenant code belongs in src/platforms/tenant or src/domains`);
  }
}

const uiSurfaceRoots = [
  path.join(srcRoot, 'app'),
  path.join(srcRoot, 'platforms'),
  path.join(srcRoot, 'shared', 'ui'),
];

for (const rootDir of uiSurfaceRoots) {
  for (const file of walk(rootDir).filter(isSourceFile)) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = rel(file);
    if (/\bfetch\s*\(/.test(source)) {
      failures.push(`${relative}: direct fetch() is not allowed in UI/platform code; use a domain api module`);
    }
    if (/from ['"]axios['"]/.test(source) || /\baxios\./.test(source)) {
      failures.push(`${relative}: direct axios usage is not allowed in UI/platform code; use infrastructure/api or domain api`);
    }
  }
}

for (const file of walk(path.join(srcRoot, 'shared')).filter(isSourceFile)) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = rel(file);
  if (/^src\/shared\/ui\/(?:[^/]+\/)?index\.ts$/.test(relative)) continue;
  if (/from ['"]@\/(app|platforms|portal|features|domains|services)\//.test(source)) {
    failures.push(`${relative}: shared code must not import app/platform/portal/feature/domain code`);
  }
}

if (failures.length) {
  console.error(`Architecture boundary check failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Architecture boundary check passed');
