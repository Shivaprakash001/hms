import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    const columns: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tenant_advance_ledger'
      ORDER BY ordinal_position
    `;
    
    console.log('\n📋 tenant_advance_ledger columns:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    columns.forEach(c => {
      console.log(`${c.column_name.padEnd(20)} ${c.data_type.padEnd(15)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('');
    
    const hasHostelId = columns.some(c => c.column_name === 'hostel_id');
    console.log(hasHostelId ? '✅ hostel_id column exists' : '❌ hostel_id column MISSING');
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
