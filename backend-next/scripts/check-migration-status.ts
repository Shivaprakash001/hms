import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    // Check if we have any tenant_advance_ledger records at all
    const total = await prisma.tenantAdvanceLedger.count();
    console.log('Total tenant_advance_ledger records:', total);
    
    // Check if we can query for records (this will tell us if constraint is enforced)
    const allRecords = await prisma.tenantAdvanceLedger.findMany({
      select: { id: true, hostel_id: true },
      take: 5
    });
    
    console.log('Sample records:');
    allRecords.forEach((r, i) => {
      console.log(`  ${i + 1}. hostel_id:`, r.hostel_id || 'NULL');
    });
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
