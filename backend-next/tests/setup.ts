import { beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

async function resetDatabase() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('CRITICAL: Attempted to reset database outside of test environment!');
  }

  // Get all table names in the test schema
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'test';
  `;

  const tableNames = tables
    .map(t => t.tablename)
    .filter(name => !name.startsWith('_prisma_migrations') && name !== 'spatial_ref_sys'); // Ignore prisma migrations

  if (tableNames.length > 0) {
    const truncateQuery = `TRUNCATE TABLE ${tableNames.map(t => `"test"."${t}"`).join(', ')} CASCADE;`;
    await prisma.$executeRawUnsafe(truncateQuery);
  }
}

beforeAll(async () => {
  // Ensure we are connected
  await prisma.$connect();
  
  // Clean before all tests
  await resetDatabase();
});

// Removed afterEach to prevent deadlocks on TRUNCATE during concurrent background queries

afterAll(async () => {
  await prisma.$disconnect();
});
